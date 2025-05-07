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
        self.external_libraries = defaultdict(set)
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
                lib_name = import_path.split('/')[0]
                if lib_name.startswith('@'):
                    if len(import_path.split('/')) > 1:
                        lib_name = '/'.join(import_path.split('/')[:2])
                        
                self.external_libraries[file_path].add(lib_name)
                self.file_structure[file_path]["imports"].append({
                    "type": "external",
                    "path": import_path,
                    "library": lib_name
                })
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

    def _analyze_component_relationships(self):
        component_types = {
            "pages": [],
            "components": [],
            "hooks": [],
            "utils": [],
            "contexts": [],
            "layouts": [],
            "api": []
        }
        
        for file_path in self.file_structure:
            if '/pages/' in file_path or '/app/' in file_path:
                component_types["pages"].append(file_path)
            elif '/components/' in file_path:
                component_types["components"].append(file_path)
            elif '/hooks/' in file_path or file_path.endswith('Hook.js') or file_path.endswith('Hook.tsx'):
                component_types["hooks"].append(file_path)
            elif '/utils/' in file_path or '/lib/' in file_path or '/helpers/' in file_path:
                component_types["utils"].append(file_path)
            elif '/context/' in file_path or '/contexts/' in file_path or 'Provider' in file_path:
                component_types["contexts"].append(file_path)
            elif '/layouts/' in file_path or 'Layout' in file_path:
                component_types["layouts"].append(file_path)
            elif '/api/' in file_path:
                component_types["api"].append(file_path)
        
        return component_types

    def _identify_key_files(self):
        key_files = {
            "entry_points": [],
            "shared_components": [],
            "utility_hubs": []
        }
        
        for file, info in self.file_structure.items():
            if len(info["imported_by"]) > 3 and len(info["imports"]) > 5:
                if '/pages/' in file or '/app/' in file:
                    key_files["entry_points"].append(file)
        
        for file, info in self.file_structure.items():
            if len(info["imported_by"]) > 5:
                if '/components/' in file:
                    key_files["shared_components"].append(file)
        
        for file, info in self.file_structure.items():
            if len(info["imported_by"]) > 4 and len(info["imports"]) < 3:
                if '/utils/' in file or '/lib/' in file or '/helpers/' in file:
                    key_files["utility_hubs"].append(file)
        
        return key_files

    def analyze(self):
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
        
        component_types = self._analyze_component_relationships()
        
        key_files = self._identify_key_files()
        
        dependency_graph = {
            "project": {
                "path": self.repo_url,
                "files": self.file_structure,
                "component_types": component_types,
                "key_files": key_files
            },
            "external_libraries": self._summarize_external_libraries(),
            "metadata": {
                "total_files": len(self.file_structure),
                "total_external_libraries": len(self._get_all_external_libraries()),
                "total_dependencies": sum(len(deps) for deps in self.dependencies.values()),
                "most_imported_files": self._get_most_imported_files(10),
                "most_importing_files": self._get_most_importing_files(10),
                "most_used_libraries": self._get_most_used_libraries(10),
                "project_structure": self._analyze_project_structure()
            },
            "insights": self._generate_insights()
        }
        
        return dependency_graph

    def _summarize_external_libraries(self):
        all_libs = self._get_all_external_libraries()
        
        library_usage = {}
        for lib in all_libs:
            using_files = []
            for file_path, libs in self.external_libraries.items():
                if lib in libs:
                    using_files.append(file_path)
            
            category = self._categorize_library(lib)
            
            library_usage[lib] = {
                "name": lib,
                "category": category,
                "used_by_count": len(using_files),
                "used_by_files": using_files
            }
            
        return library_usage

    def _categorize_library(self, library):
        ui_libs = ['react', 'react-dom', 'next', '@mui', '@chakra', '@emotion', 'styled-components', 'tailwindcss', 'bootstrap']
        state_libs = ['redux', 'zustand', 'recoil', 'jotai', 'mobx', '@reduxjs', 'react-query', 'swr']
        routing_libs = ['next/router', 'next/navigation', 'react-router']
        utility_libs = ['lodash', 'ramda', 'date-fns', 'moment', 'axios', 'qs', 'uuid']
        form_libs = ['formik', 'react-hook-form', 'yup', 'zod']
        testing_libs = ['jest', '@testing-library', 'cypress', 'vitest']
        
        if any(lib in library for lib in ui_libs):
            return "UI/Component"
        elif any(lib in library for lib in state_libs):
            return "State Management"
        elif any(lib in library for lib in routing_libs):
            return "Routing"
        elif any(lib in library for lib in utility_libs):
            return "Utility"
        elif any(lib in library for lib in form_libs):
            return "Form Handling"
        elif any(lib in library for lib in testing_libs):
            return "Testing"
        else:
            return "Other"

    def _get_all_external_libraries(self):
        all_libs = set()
        for libs in self.external_libraries.values():
            all_libs.update(libs)
        return all_libs

    def _get_most_imported_files(self, count=10):
        imported_by_counts = {}
        for file_path, file_info in self.file_structure.items():
            imported_by_counts[file_path] = len(file_info["imported_by"])
            
        sorted_files = sorted(imported_by_counts.items(), 
                             key=lambda x: x[1], reverse=True)
        
        return [{"file": file, "imported_by_count": imported_count} 
                for file, imported_count in sorted_files[:count]]

    def _get_most_importing_files(self, count=10):
        importing_counts = {}
        for file_path, file_info in self.file_structure.items():
            internal_imports = [imp for imp in file_info["imports"] 
                              if imp["type"] == "internal"]
            importing_counts[file_path] = len(internal_imports)
            
        sorted_files = sorted(importing_counts.items(), 
                             key=lambda x: x[1], reverse=True)
        
        return [{"file": file, "imports_count": import_count} 
                for file, import_count in sorted_files[:count]]

    def _get_most_used_libraries(self, count=10):
        lib_counts = {}
        for libs in self.external_libraries.values():
            for lib in libs:
                lib_counts[lib] = lib_counts.get(lib, 0) + 1
                
        sorted_libs = sorted(lib_counts.items(), 
                            key=lambda x: x[1], reverse=True)
        
        return [{"library": lib, "used_by_count": used_count} 
                for lib, used_count in sorted_libs[:count]]

    def _analyze_project_structure(self):
        structure = {
            "has_pages_dir": any('/pages/' in file for file in self.file_structure),
            "has_app_dir": any('/app/' in file for file in self.file_structure),
            "has_api_routes": any('/api/' in file for file in self.file_structure),
            "has_public_dir": any('/public/' in file for file in self.file_structure),
            "has_component_dir": any('/components/' in file for file in self.file_structure),
            "folder_structure": self._analyze_folder_structure()
        }
        
        return structure

    def _analyze_folder_structure(self):
        folders = {}
        
        for file_path in self.file_structure:
            parts = Path(file_path).parts
            current = folders
            
            for i, part in enumerate(parts[:-1]):  
                if part not in current:
                    current[part] = {"_files": 0, "_internal_deps": 0}
                
                current[part]["_files"] += 1
                
                file_info = self.file_structure[file_path]
                internal_deps = [imp for imp in file_info["imports"] if imp["type"] == "internal"]
                current[part]["_internal_deps"] += len(internal_deps)
                
                current = current[part]
        
        return folders

    def _generate_insights(self):
        insights = {
            "architectural_patterns": self._identify_architectural_patterns(),
            "dependency_hotspots": self._identify_dependency_hotspots(),
            "potential_refactorings": self._identify_potential_refactorings(),
            "library_usage_patterns": self._analyze_library_usage_patterns()
        }
        
        return insights

    def _identify_architectural_patterns(self):
        patterns = []
        
        container_count = sum(1 for file in self.file_structure if 'Container' in file)
        if container_count > 2:
            patterns.append("Container/Presentation Pattern")
        
        hooks_count = sum(1 for file in self.file_structure if '/hooks/' in file or file.endswith('Hook.js') or file.endswith('Hook.tsx'))
        if hooks_count > 3:
            patterns.append("Custom Hooks Pattern")
        
        context_count = sum(1 for file in self.file_structure if '/context/' in file or '/contexts/' in file or 'Provider' in file)
        if context_count > 1:
            patterns.append("React Context API")
        
        utils_count = sum(1 for file in self.file_structure if '/utils/' in file or '/helpers/' in file)
        if utils_count > 5:
            patterns.append("Utility-First Approach")
        
        feature_folders = set()
        for file in self.file_structure:
            parts = Path(file).parts
            if len(parts) > 2 and parts[0] in ['src', 'app', 'features']:
                feature_folders.add(parts[1])
        if len(feature_folders) > 3:
            patterns.append("Feature-Based/Modular Architecture")
        
        return patterns

    def _identify_dependency_hotspots(self):
        hotspots = []
        
        for file, info in self.file_structure.items():
            if len(info["imports"]) > 5 and len(info["imported_by"]) > 5:
                hotspots.append({
                    "file": file,
                    "type": "High Coupling",
                    "imports_count": len(info["imports"]),
                    "imported_by_count": len(info["imported_by"])
                })
        
        for file, info in self.file_structure.items():
            for imported_file in (imp["resolved"] for imp in info["imports"] if imp["type"] == "internal"):
                if imported_file in self.file_structure and file in self.file_structure[imported_file]["imported_by"]:
                    hotspots.append({
                        "file": file,
                        "type": "Circular Dependency",
                        "with": imported_file
                    })
        
        return hotspots[:10]  

    def _identify_potential_refactorings(self):
        refactorings = []
        
        for file, libs in self.external_libraries.items():
            if len(libs) > 7:
                refactorings.append({
                    "file": file,
                    "type": "High External Dependencies",
                    "library_count": len(libs)
                })
        
        for file, info in self.file_structure.items():
            if len(info["imported_by"]) <= 1 and len(info["imports"]) > 7:
                refactorings.append({
                    "file": file,
                    "type": "Low Cohesion",
                    "imports_count": len(info["imports"]),
                    "imported_by_count": len(info["imported_by"])
                })
        
        return refactorings[:10] 

    def _analyze_library_usage_patterns(self):
        usage_patterns = {}
        
        lib_to_files = defaultdict(list)
        for file, libs in self.external_libraries.items():
            for lib in libs:
                lib_to_files[lib].append(file)
        
        file_to_libs = {file: set(libs) for file, libs in self.external_libraries.items()}
        lib_combinations = defaultdict(int)
        
        for file, libs in file_to_libs.items():
            if len(libs) >= 2:
                for lib1 in libs:
                    for lib2 in libs:
                        if lib1 < lib2:  
                            lib_combinations[(lib1, lib2)] += 1
        
        top_combinations = sorted(lib_combinations.items(), key=lambda x: x[1], reverse=True)[:5]
        usage_patterns["common_combinations"] = [
            {"libraries": list(combo), "count": count} for combo, count in top_combinations
        ]
        
        dir_to_libs = defaultdict(set)
        for file, libs in self.external_libraries.items():
            directory = str(Path(file).parent)
            dir_to_libs[directory].update(libs)
        
        usage_patterns["directory_specific_libraries"] = [
            {"directory": dir, "libraries": list(libs)} 
            for dir, libs in sorted(dir_to_libs.items(), key=lambda x: len(x[1]), reverse=True)[:5]
        ]
        
        return usage_patterns

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
        summary_lines.append(f"Total external libraries: {dependency_graph['metadata']['total_external_libraries']}")
        summary_lines.append(f"Total internal dependencies: {dependency_graph['metadata']['total_dependencies']}")
        summary_lines.append("")
        summary_lines.append("Most imported files:")
        for item in dependency_graph['metadata']['most_imported_files'][:5]:
            summary_lines.append(f"- {item['file']} (imported by {item['imported_by_count']} files)")
        summary_lines.append("")
        summary_lines.append("Most used libraries:")
        for item in dependency_graph['metadata']['most_used_libraries'][:5]:
            summary_lines.append(f"- {item['library']} (used by {item['used_by_count']} files)")
        summary_lines.append("")
        summary_lines.append("Architectural patterns detected:")
        for pattern in dependency_graph['insights']['architectural_patterns']:
            summary_lines.append(f"- {pattern}")
        
        # Print summary to console
        print("\nProject Summary:")
        print(f"Total files: {dependency_graph['metadata']['total_files']}")
        print(f"Total external libraries: {dependency_graph['metadata']['total_external_libraries']}")
        print(f"Total internal dependencies: {dependency_graph['metadata']['total_dependencies']}")
        
        print("\nMost imported files:")
        for item in dependency_graph['metadata']['most_imported_files'][:5]:
            print(f"- {item['file']} (imported by {item['imported_by_count']} files)")
        
        print("\nMost used libraries:")
        for item in dependency_graph['metadata']['most_used_libraries'][:5]:
            print(f"- {item['library']} (used by {item['used_by_count']} files)")
            
        print("\nArchitectural patterns detected:")
        for pattern in dependency_graph['insights']['architectural_patterns']:
            print(f"- {pattern}")
            
        # Write summary to file
        with open("repo_summary.txt", 'w', encoding='utf-8') as f:
            f.write('\n'.join(summary_lines))
            
    except Exception as e:
        print(f"Error analyzing repository: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()