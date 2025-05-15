# next_context.py
import os
import sys
import json
import re
from pathlib import Path
from collections import defaultdict, deque
import requests
from urllib.parse import urlparse

ES6_IMPORT_REGEX = r'import\s+(?:{[^}]*}|\*\s+as\s+[^,]+|[\w\s,]+)\s+from\s+[\'"]([^\'"]+)[\'"]'
DYNAMIC_IMPORT_REGEX = r'import\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)'
REQUIRE_REGEX = r'require\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)'

class NextJsDependencyAnalyzer:
    def __init__(self, repo_url, branch='main', github_token=None):
        """Initialize analyzer with GitHub repository URL.
        
        Args:
            repo_url: GitHub repository URL (e.g., 'https://github.com/owner/repo')
            branch: Repository branch to analyze (default: 'main')
            github_token: GitHub personal access token for API authentication
        """
        self.repo_url = repo_url
        self.branch = branch
        self.github_token = github_token or os.getenv('GITHUB_TOKEN')
        self.parse_repo_url()
       
        self.file_structure = {}
        self.dependencies = defaultdict(set)
        self.processed_files = set()
        self.file_queue = deque()
        
        self.extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']
        
        self.path_aliases = self._load_path_aliases()
        self.repo_tree = None

    def parse_repo_url(self):
        """Parse GitHub repository URL to extract owner and repo name."""
        parsed_url = urlparse(self.repo_url)
        path_parts = parsed_url.path.strip('/').split('/')
        
        if len(path_parts) < 2:
            raise ValueError(f"Invalid GitHub URL: {self.repo_url}")
            
        self.owner = path_parts[0]
        self.repo = path_parts[1]
        self.api_base_url = f"https://api.github.com/repos/{self.owner}/{self.repo}"
        self.raw_base_url = f"https://raw.githubusercontent.com/{self.owner}/{self.repo}/{self.branch}"

    def _github_request(self, endpoint, params=None):
        """Make an authenticated request to GitHub API.
        
        Args:
            endpoint: API endpoint (without the base URL)
            params: Query parameters for the request
            
        Returns:
            Parsed JSON response
        """
        url = f"{self.api_base_url}{endpoint}"
        headers = {}
        
        if self.github_token:
            headers['Authorization'] = f"token {self.github_token}"
            
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 404:
            print(f"Resource not found: {url}")
            return None
            
        response.raise_for_status()
        return response.json()

    def _get_file_content(self, path):
        """Get file content from GitHub.
        
        Args:
            path: File path relative to repo root
            
        Returns:
            File content as string
        """
        url = f"{self.raw_base_url}/{path}"
        headers = {}
        
        if self.github_token:
            headers['Authorization'] = f"token {self.github_token}"
            
        response = requests.get(url, headers=headers)
        
        if response.status_code == 404:
            return None
            
        response.raise_for_status()
        return response.text

    def _get_repo_tree(self):
        """Get the full repository tree from GitHub.
        
        Returns:
            List of files in the repository
        """
        if self.repo_tree:
            return self.repo_tree
            
        endpoint = f"/git/trees/{self.branch}?recursive=1"
        tree_data = self._github_request(endpoint)
        
        if not tree_data or 'tree' not in tree_data:
            raise ValueError(f"Could not retrieve repository tree for {self.owner}/{self.repo}")
            
        self.repo_tree = tree_data['tree']
        return self.repo_tree

    def _load_path_aliases(self):
        """Load path aliases from tsconfig.json and next.config.js.
        
        Returns:
            Dictionary of path aliases
        """
        aliases = {}
        
        # Try to load from tsconfig.json
        tsconfig_content = self._get_file_content('tsconfig.json')
        if tsconfig_content:
            try:
                tsconfig = json.loads(tsconfig_content)
                if 'compilerOptions' in tsconfig and 'paths' in tsconfig['compilerOptions']:
                    paths = tsconfig['compilerOptions']['paths']
                    for alias, paths_list in paths.items():
                        alias = alias.replace('/*', '')
                        if paths_list and len(paths_list) > 0:
                            target = paths_list[0].replace('/*', '')
                            aliases[alias] = target
            except (json.JSONDecodeError, IOError) as e:
                print(f"Warning: Error parsing tsconfig.json: {e}")
        
        # Try to load from next.config.js
        next_config_content = self._get_file_content('next.config.js')
        if next_config_content:
            try:
                alias_match = re.search(r'alias\s*:\s*{([^}]*)}', next_config_content)
                if alias_match:
                    alias_block = alias_match.group(1)
                    for pair in re.finditer(r'[\'"]([\w@/-]+)[\'"]:\s*[\'"]([^\'"]*)[\'"]\s*', alias_block):
                        alias, target = pair.groups()
                        aliases[alias] = target
            except IOError as e:
                print(f"Warning: Error reading next.config.js: {e}")
        
        return aliases

    def _is_external_library(self, import_path):
        """Check if an import path refers to an external library.
        
        Args:
            import_path: Import path to check
            
        Returns:
            Boolean indicating if the import is an external library
        """
        if import_path.startswith('.') or import_path.startswith('/'):
            return False
            
        for alias in self.path_aliases:
            if import_path.startswith(alias):
                return False
                
        return True

    def _resolve_import_path(self, import_path, current_file):
        """Resolve an import path to a file path in the repository.
        
        Args:
            import_path: Import path to resolve
            current_file: Current file path for relative imports
            
        Returns:
            Resolved file path or None if external/unresolvable
        """
        if self._is_external_library(import_path):
            return None
            
        # Handle alias paths
        for alias, target in self.path_aliases.items():
            if import_path.startswith(alias):
                relative_path = import_path.replace(alias, target)
                return relative_path
        
        # Handle relative paths
        if import_path.startswith('.'):
            current_dir = Path(current_file).parent
            resolved_path = (current_dir / import_path).resolve()
            # Convert to relative path in repo
            repo_path = str(resolved_path).replace(str(Path().resolve()), '')
            if repo_path.startswith('/'):
                repo_path = repo_path[1:]
            return repo_path
            
        # Handle absolute paths (relative to repo root)
        if import_path.startswith('/'):
            return import_path[1:]
            
        # Try to find in common directories
        common_dirs = ['src', 'app', 'pages', 'components']
        for dir_name in common_dirs:
            potential_path = f"{dir_name}/{import_path}"
            for file_data in self._get_repo_tree():
                if file_data['path'].startswith(potential_path):
                    return file_data['path']
                
        return None

    def _find_file_with_extensions(self, base_path):
        """Find a file with supported extensions in the repository.
        
        Args:
            base_path: Base path to search for
            
        Returns:
            File path with extension or None if not found
        """
        # Try exact path first
        for file_data in self._get_repo_tree():
            if file_data['path'] == base_path and file_data['type'] == 'blob':
                return base_path
        
        # Try with extensions
        for ext in self.extensions:
            path_with_ext = f"{base_path}{ext}"
            for file_data in self._get_repo_tree():
                if file_data['path'] == path_with_ext:
                    return path_with_ext
        
        # Try index files in directory
        is_dir = any(item['path'].startswith(f"{base_path}/") for item in self._get_repo_tree())
        if is_dir:
            for ext in self.extensions:
                index_file = f"{base_path}/index{ext}"
                for file_data in self._get_repo_tree():
                    if file_data['path'] == index_file:
                        return index_file
        
        # Try Next.js dynamic routes
        for next_dir in ['pages', 'app']:
            if f'/{next_dir}/' in base_path:
                parent_dir = Path(base_path).parent
                parent_path = str(parent_dir)
                for file_data in self._get_repo_tree():
                    file_path = file_data['path']
                    filename = Path(file_path).name
                    if (file_path.startswith(parent_path) and 
                        ('[' in filename and ']' in filename) and
                        Path(base_path).name in filename):
                        return file_path
        
        return None

    def _extract_imports(self, file_content):
        """Extract imports from file content.
        
        Args:
            file_content: File content as string
            
        Returns:
            List of imported paths
        """
        imports = []
        
        if file_content is None:
            return imports
            
        try:
            es6_imports = re.findall(ES6_IMPORT_REGEX, file_content)
            imports.extend(es6_imports)
            
            dynamic_imports = re.findall(DYNAMIC_IMPORT_REGEX, file_content)
            imports.extend(dynamic_imports)
            
            require_imports = re.findall(REQUIRE_REGEX, file_content)
            imports.extend(require_imports)
            
        except Exception as e:
            print(f"Warning: Could not extract imports: {e}")
            
        return imports

    def _process_file(self, file_path):
        """Process a file to extract and resolve its imports.
        
        Args:
            file_path: Path to the file in the repository
        """
        if file_path in self.processed_files:
            return
            
        self.processed_files.add(file_path)
        
        self.file_structure[file_path] = {
            "path": file_path,
            "imports": [],
            "imported_by": []
        }
        
        file_content = self._get_file_content(file_path)
        imports = self._extract_imports(file_content)
        
        for import_path in imports:
            if self._is_external_library(import_path):
                continue
            else:
                resolved_base = self._resolve_import_path(import_path, file_path)
                if resolved_base:
                    resolved_file = self._find_file_with_extensions(resolved_base)
                    if resolved_file:
                        self.dependencies[file_path].add(resolved_file)
                        
                        self.file_structure[file_path]["imports"].append({
                            "type": "internal",
                            "path": import_path,
                            "resolved": resolved_file
                        })
                        
                        if resolved_file not in self.processed_files:
                            self.file_queue.append(resolved_file)
                    else:
                        self.file_structure[file_path]["imports"].append({
                            "type": "unresolved",
                            "path": import_path,
                            "error": "File not found"
                        })
                else:
                    self.file_structure[file_path]["imports"].append({
                        "type": "unresolved",
                        "path": import_path,
                        "error": "Could not resolve import path"
                    })

    def _find_project_files(self):
        """Find all relevant files in the repository to process."""
        tree = self._get_repo_tree()
        
        for item in tree:
            if item['type'] == 'blob':
                path = item['path']
                if any(path.endswith(ext) for ext in self.extensions):
                    # Skip node_modules and other common excluded directories
                    if not any(ignored in path for ignored in ['node_modules/', '.git/', '.next/', 'out/', 'build/', 'dist/']):
                        self.file_queue.append(path)

    def _build_imported_by_relationships(self):
        """Build reverse relationships (which files import each file)."""
        for file_path, imports in self.dependencies.items():
            for imported_file in imports:
                if imported_file in self.file_structure:
                    self.file_structure[imported_file]["imported_by"].append(file_path)

    def _analyze_project_architecture(self):
        """
        Analyzes the project architecture by:
        1. Categorizing files by component type
        2. Identifying architectural patterns
        3. Detecting presence of key Next.js directories
        
        Returns:
            Dictionary with comprehensive architectural analysis
        """
        # Initialize the architecture analysis dictionary
        architecture = {
            "component_types": {
                "pages": [],
                "components": [],
                "hooks": [],
                "utils": [],
                "contexts": [],
                "layouts": [],
                "api": []
            },
            "patterns": [],
            "structure": {
                "has_pages_dir": False,
                "has_app_dir": False,
                "has_api_routes": False,
                "has_public_dir": False,
                "has_component_dir": False
            }
        }
        
        # Counters for pattern detection
        container_count = 0
        hooks_count = 0
        context_count = 0
        utils_count = 0
        feature_folders = set()
        
        # Process all files once to gather all information
        for file_path in self.file_structure:
            # Component type categorization
            if '/pages/' in file_path or '/app/' in file_path:
                architecture["component_types"]["pages"].append(file_path)
                # Update structure detection
                if '/pages/' in file_path:
                    architecture["structure"]["has_pages_dir"] = True
                if '/app/' in file_path:
                    architecture["structure"]["has_app_dir"] = True
            elif '/components/' in file_path:
                architecture["component_types"]["components"].append(file_path)
                architecture["structure"]["has_component_dir"] = True
            elif '/hooks/' in file_path or file_path.endswith('Hook.js') or file_path.endswith('Hook.tsx'):
                architecture["component_types"]["hooks"].append(file_path)
                hooks_count += 1
            elif '/utils/' in file_path or '/lib/' in file_path or '/helpers/' in file_path:
                architecture["component_types"]["utils"].append(file_path)
                if '/utils/' in file_path or '/helpers/' in file_path:
                    utils_count += 1
            elif '/context/' in file_path or '/contexts/' in file_path or 'Provider' in file_path:
                architecture["component_types"]["contexts"].append(file_path)
                context_count += 1
            elif '/layouts/' in file_path or 'Layout' in file_path:
                architecture["component_types"]["layouts"].append(file_path)
            elif '/api/' in file_path:
                architecture["component_types"]["api"].append(file_path)
                architecture["structure"]["has_api_routes"] = True
            
            # Pattern detection
            if 'Container' in file_path:
                container_count += 1
            
            # Public directory detection
            if '/public/' in file_path:
                architecture["structure"]["has_public_dir"] = True
            
            # Feature folder detection
            parts = Path(file_path).parts
            if len(parts) > 2 and parts[0] in ['src', 'app', 'features']:
                feature_folders.add(parts[1])
        
        # Identify architectural patterns based on counters
        if container_count > 2:
            architecture["patterns"].append("Container/Presentation Pattern")
        
        if hooks_count > 3:
            architecture["patterns"].append("Custom Hooks Pattern")
        
        if context_count > 1:
            architecture["patterns"].append("React Context API")
        
        if utils_count > 5:
            architecture["patterns"].append("Utility-First Approach")
        
        if len(feature_folders) > 3:
            architecture["patterns"].append("Feature-Based/Modular Architecture")
        
        return architecture

    def analyze(self):
        """
        Main analysis method that orchestrates the entire dependency analysis process.
        Finds files, processes them, builds relationships, and generates insights.
        
        Returns:
            Comprehensive dependency graph with project metadata and insights
        """
        print(f"Analyzing Next.js project at: {self.repo_url}")
        
        self._find_project_files()
        
        total_files = len(self.file_queue)
        processed = 0
        
        print(f"Found {total_files} files to process")
        
        while self.file_queue:
            file_path = self.file_queue.popleft()
            self._process_file(file_path)
            
            processed += 1
            if processed % 10 == 0:
                print(f"Processed {processed}/{total_files} files")
        
        self._build_imported_by_relationships()
        
        project_architecture = self._analyze_project_architecture()
        
        dependency_graph = {
            "project": {
                "path": self.repo_url,
                "files": self.file_structure,
                "component_types": project_architecture["component_types"],
            },
            "metadata": {
                "total_files": len(self.file_structure),
                "total_dependencies": sum(len(deps) for deps in self.dependencies.values()),
                "project_architecture": project_architecture
            },
            "insights": self._generate_insights()
        }
        
        return dependency_graph

    

    def _generate_insights(self):
        """
        Generates high-level insights about the project architecture.
        Identifies architectural patterns, dependency hotspots, refactoring opportunities,
        and library usage patterns.
        
        Returns:
            Dictionary with project insights
        """
        insights = {
            "dependency_hotspots": self._identify_dependency_hotspots()
        }
        
        return insights

    def _identify_dependency_hotspots(self):
        """
        Identifies dependency hotspots in the project.
        Focuses on circular dependencies, which present significant architectural challenges.
        
        Returns:
            List of files involved in circular dependencies
        """
        circuluar_dependencies = []
        
        for file, info in self.file_structure.items():
            for imported_file in (imp["resolved"] for imp in info["imports"] if imp["type"] == "internal"):
                if imported_file in self.file_structure and file in self.file_structure[imported_file]["imported_by"]:
                    circuluar_dependencies.append({
                        "file": file,
                        "type": "Circular Dependency",
                        "with": imported_file
                    })
        
        return circuluar_dependencies

    def _extract_imports_section(self, content):
        """Extract the imports section of a file"""
        imports = []
        for line in content.split('\n'):
            if re.match(r'^import\s+.+\s+from\s+[\'"]', line) or re.match(r'^const\s+.+\s+=\s+require\([\'"]', line):
                imports.append(line)
            elif imports and not line.strip():
                # Include blank lines within import section
                imports.append(line)
            elif imports:
                # Stop once imports are done
                break
        
        return '\n'.join(imports)

    def _generate_repo_fingerprint(self):
        """Generate a concise repository fingerprint for context"""
        architecture = self._analyze_project_architecture()
        
        fingerprint = {
            "total_files": len(self.file_structure),
            "architecture_patterns": architecture["patterns"],
            "structure": architecture["structure"],
            "file_type_counts": {
                category: len(files) 
                for category, files in architecture["component_types"].items() 
                if files
            },
            "circular_dependencies": len(self._identify_dependency_hotspots())
        }
        
        return fingerprint

def main():
    if len(sys.argv) != 2:
        print("Usage: python next_context.py <github_repo_url>")
        sys.exit(1)
        
    repo_url = sys.argv[1]
    
    # Check if URL is a GitHub URL
    if not (repo_url.startswith('https://github.com/') or repo_url.startswith('http://github.com/')):
        print(f"Error: URL is not a GitHub repository URL: {repo_url}")
        print("Expected format: https://github.com/owner/repo")
        sys.exit(1)
        
    try:
        # Check if requests library is installed
        import requests
    except ImportError:
        print("Error: The requests library is not installed.")
        print("Please install it using: pip install requests")
        sys.exit(1)
        
    try:
        analyzer = NextJsDependencyAnalyzer(repo_url)
        dependency_graph = analyzer.analyze()
        
        output_file = "nextjs_dependency_graph.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(dependency_graph, f, indent=2, sort_keys=False)
            
        print(f"Dependency graph saved to {output_file}")
        
        # Build the summary text
        summary_lines = []
        summary_lines.append("Project Summary:")
        summary_lines.append(f"Total files: {dependency_graph['metadata']['total_files']}")
        summary_lines.append(f"Total internal dependencies: {dependency_graph['metadata']['total_dependencies']}")
        summary_lines.append("")
        
        # Print summary to console
        print("\nProject Summary:")
        print(f"Total files: {dependency_graph['metadata']['total_files']}")
        print(f"Total internal dependencies: {dependency_graph['metadata']['total_dependencies']}")
            
        # Write summary to file
        with open("repo_summary.txt", 'w', encoding='utf-8') as f:
            f.write('\n'.join(summary_lines))
            
    except Exception as e:
        print(f"Error analyzing repository: {e}")
        sys.exit(1)

if __name__ == "__main__":
    import argparse
    main()