# next_context.py
import os
import sys
import json
import re
from pathlib import Path
from collections import defaultdict, deque

ES6_IMPORT_REGEX = r'import\s+(?:{[^}]*}|\*\s+as\s+[^,]+|[\w\s,]+)\s+from\s+[\'"]([^\'"]+)[\'"]'
DYNAMIC_IMPORT_REGEX = r'import\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)'
REQUIRE_REGEX = r'require\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)'

class NextJsDependencyAnalyzer:
    def __init__(self, project_path):
        """
        Initializes the NextJs dependency analyzer with the specified project path.
        Sets up data structures to track file relationships, dependencies, and external libraries.
        Initializes a queue for processing files and loads path aliases from configuration files.
        
        Args:
            project_path: Path to the Next.js project to analyze
        """
        self.project_path = Path(project_path).resolve()
        self.file_structure = {}
        self.dependencies = defaultdict(set)
        self.processed_files = set()
        self.file_queue = deque()
        
        self.extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']
        
        self.path_aliases = self._load_path_aliases()

    def _load_path_aliases(self):
        """
        Loads path aliases from tsconfig.json and next.config.js files.
        These aliases are used to resolve import paths that use project-specific aliases.
        
        Returns:
            Dictionary mapping alias prefixes to their target paths
        """
        aliases = {}
        
        tsconfig_path = self.project_path / 'tsconfig.json'
        if tsconfig_path.exists():
            try:
                with open(tsconfig_path, 'r') as f:
                    tsconfig = json.load(f)
                    if 'compilerOptions' in tsconfig and 'paths' in tsconfig['compilerOptions']:
                        paths = tsconfig['compilerOptions']['paths']
                        for alias, paths_list in paths.items():
                            alias = alias.replace('/*', '')
                            if paths_list and len(paths_list) > 0:
                                target = paths_list[0].replace('/*', '')
                                aliases[alias] = target
            except (json.JSONDecodeError, IOError) as e:
                print(f"Warning: Error parsing tsconfig.json: {e}")
        
        next_config_path = self.project_path / 'next.config.js'
        if next_config_path.exists():
            try:
                with open(next_config_path, 'r') as f:
                    content = f.read()
                    alias_match = re.search(r'alias\s*:\s*{([^}]*)}', content)
                    if alias_match:
                        alias_block = alias_match.group(1)
                        for pair in re.finditer(r'[\'"]([\w@/-]+)[\'"]:\s*[\'"]([^\'"]*)[\'"]\s*', alias_block):
                            alias, target = pair.groups()
                            aliases[alias] = target
            except IOError as e:
                print(f"Warning: Error reading next.config.js: {e}")
        
        return aliases

    def _is_external_library(self, import_path):
        """
        Determines if an import path refers to an external library rather than a local file.
        External libraries are typically imported without relative paths (./), absolute paths (/),
        or path aliases.
        
        Args:
            import_path: The import path to check
            
        Returns:
            Boolean indicating whether the import is an external library
        """
        if import_path.startswith('.') or import_path.startswith('/'):
            return False
            
        for alias in self.path_aliases:
            if import_path.startswith(alias):
                return False
                
        return True

    def _resolve_import_path(self, import_path, current_file):
        """
        Resolves an import path to an absolute file path in the project.
        Handles relative imports, absolute imports, and path aliases.
        
        Args:
            import_path: The import path to resolve
            current_file: The file containing the import
            
        Returns:
            Absolute Path object if resolved successfully, None if external or unresolvable
        """
        if self._is_external_library(import_path):
            return None
            
        for alias, target in self.path_aliases.items():
            if import_path.startswith(alias):
                relative_path = import_path.replace(alias, target)
                return (self.project_path / relative_path).resolve()
        
        if import_path.startswith('.'):
            current_dir = current_file.parent
            resolved_path = (current_dir / import_path).resolve()
            return resolved_path
            
        if import_path.startswith('/'):
            import_path = import_path[1:]
            return (self.project_path / import_path).resolve()
            
        for root, _, _ in os.walk(self.project_path):
            root_path = Path(root)
            potential_path = root_path / import_path
            if potential_path.exists():
                return potential_path
                
        return None

    def _find_file_with_extensions(self, base_path):
        """
        Finds the actual file for an import by trying different extensions and index files.
        Handles Next.js specific conventions like dynamic routes with brackets.
        
        Args:
            base_path: The resolved base path without extension
            
        Returns:
            Path to the actual file if found, None otherwise
        """
        if base_path.exists() and base_path.is_file():
            return base_path
            
        for ext in self.extensions:
            path_with_ext = Path(f"{base_path}{ext}")
            if path_with_ext.exists() and path_with_ext.is_file():
                return path_with_ext
                
        if base_path.exists() and base_path.is_dir():
            for ext in self.extensions:
                index_file = base_path / f"index{ext}"
                if index_file.exists() and index_file.is_file():
                    return index_file
        
        for next_dir in ['pages', 'app']:
            if str(base_path).find(f'/{next_dir}/') > -1:
                parent_dir = base_path.parent
                for item in parent_dir.glob(f"[[]*.{base_path.name}]*"):
                    if item.is_file():
                        return item
                        
        return None

    def _extract_imports(self, file_path):
        """
        Extracts all import statements from a file using regex patterns.
        Handles ES6 imports, dynamic imports, and CommonJS requires.
        
        Args:
            file_path: Path to the file to extract imports from
            
        Returns:
            List of import paths found in the file
        """
        imports = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
                es6_imports = re.findall(ES6_IMPORT_REGEX, content)
                imports.extend(es6_imports)
                
                dynamic_imports = re.findall(DYNAMIC_IMPORT_REGEX, content)
                imports.extend(dynamic_imports)
                
                require_imports = re.findall(REQUIRE_REGEX, content)
                imports.extend(require_imports)
                
        except Exception as e:
            print(f"Warning: Could not extract imports from {file_path}: {e}")
            
        return imports

    def _process_file(self, file_path):
        """
        Processes a single file to extract and resolve its imports.
        Tracks internal dependencies and external libraries.
        Adds newly discovered files to the processing queue.
        
        Args:
            file_path: Path to the file to process
        """
        if file_path in self.processed_files:
            return
            
        self.processed_files.add(file_path)
        
        rel_path = file_path.relative_to(self.project_path)
        rel_path_str = str(rel_path)
        
        self.file_structure[rel_path_str] = {
            "path": rel_path_str,
            "imports": [],
            "imported_by": []
        }
        
        imports = self._extract_imports(file_path)
        
        for import_path in imports:
            if self._is_external_library(import_path):
                continue
            else:
                resolved_base = self._resolve_import_path(import_path, file_path)
                if resolved_base:
                    resolved_file = self._find_file_with_extensions(resolved_base)
                    if resolved_file and resolved_file.exists():
                        resolved_rel = resolved_file.relative_to(self.project_path)
                        resolved_rel_str = str(resolved_rel)
                        
                        self.dependencies[rel_path_str].add(resolved_rel_str)
                        
                        self.file_structure[rel_path_str]["imports"].append({
                            "type": "internal",
                            "path": import_path,
                            "resolved": resolved_rel_str
                        })
                        
                        if resolved_file not in self.processed_files:
                            self.file_queue.append(resolved_file)
                    else:
                        self.file_structure[rel_path_str]["imports"].append({
                            "type": "unresolved",
                            "path": import_path,
                            "error": "File not found"
                        })
                else:
                    self.file_structure[rel_path_str]["imports"].append({
                        "type": "unresolved",
                        "path": import_path,
                        "error": "Could not resolve import path"
                    })

    def _find_project_files(self):
        """
        Finds all JavaScript/TypeScript files in the project directory.
        Excludes common directories like node_modules, .git, .next, etc.
        Adds discovered files to the processing queue.
        """
        for root, dirs, files in os.walk(self.project_path):
            if any(ignored in root for ignored in ['node_modules', '.git', '.next', 'out', 'build', 'dist']):
                continue
                
            for file in files:
                if any(file.endswith(ext) for ext in self.extensions):
                    full_path = Path(root) / file
                    self.file_queue.append(full_path)

    def _build_imported_by_relationships(self):
        """
        Builds reverse dependency relationships to track which files import each file.
        Updates the "imported_by" field in the file_structure dictionary.
        """
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
        print(f"Analyzing Next.js project at: {self.project_path}")
        
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
                "path": str(self.project_path),
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
    
    def _extract_keywords(self, issue_text):
        """Extract meaningful keywords from issue text"""
        # Remove common words and code syntax
        cleaned_text = re.sub(r'```[\s\S]*?```', '', issue_text)
        cleaned_text = re.sub(r'`[^`]*`', '', cleaned_text)
        
        # Extract potential component names (capitalized words)
        component_pattern = r'\b([A-Z][a-z0-9]*(?:[A-Z][a-z0-9]*)*)\b'
        components = re.findall(component_pattern, cleaned_text)
        
        # Extract other technical terms
        words = re.findall(r'\b[a-z][a-z0-9]{2,}\b', cleaned_text.lower())
        
        # Filter common words
        common_words = {'the', 'and', 'that', 'this', 'for', 'with', 'when', 'where', 'what', 'how', 'why'}
        keywords = [w for w in words if w not in common_words]
        
        # Add components with higher weight
        all_keywords = components + keywords
        
        # Return unique keywords
        return list(set(all_keywords))

    def _calculate_path_relevance(self, file_path, issue_keywords):
        """Calculate how relevant a file path is to the issue keywords"""
        score = 0
        path_parts = Path(file_path).parts
        
        # Score based on path parts
        for part in path_parts:
            part_lower = part.lower()
            for keyword in issue_keywords:
                keyword_lower = keyword.lower()
                if keyword_lower == part_lower:
                    score += 10  # Exact match
                elif keyword_lower in part_lower:
                    score += 5   # Partial match
        
        # Higher weight for matches in the file name itself
        file_name = Path(file_path).stem.lower()
        for keyword in issue_keywords:
            keyword_lower = keyword.lower()
            if keyword_lower == file_name:
                score += 15  # Exact match with filename
            elif keyword_lower in file_name:
                score += 8   # Partial match with filename
        
        return score

    def _calculate_content_relevance(self, file_path, issue_keywords):
        """Calculate how relevant file content is to the issue keywords"""
        try:
            # Convert relative path to absolute
            abs_path = self.project_path / file_path
            
            with open(abs_path, 'r', encoding='utf-8') as f:
                # Read first chunk of file (to avoid large file processing)
                content = f.read(10000)
            
            score = 0
            
            # Check for keyword matches in important code constructs
            for keyword in issue_keywords:
                keyword_lower = keyword.lower()
                
                # Check for component/class definitions
                class_pattern = fr'class\s+\w*{re.escape(keyword)}\w*'
                if re.search(class_pattern, content, re.IGNORECASE):
                    score += 12
                
                # Check for function/component definitions
                func_pattern = fr'(function|const)\s+\w*{re.escape(keyword)}\w*'
                if re.search(func_pattern, content, re.IGNORECASE):
                    score += 10
                
                # Check for export declarations
                export_pattern = fr'export\s+(?:default\s+)?(?:const\s+)?\w*{re.escape(keyword)}\w*'
                if re.search(export_pattern, content, re.IGNORECASE):
                    score += 15
                
                # Check comments for keywords
                comment_pattern = fr'//.*{re.escape(keyword)}|/\*[\s\S]*?{re.escape(keyword)}[\s\S]*?\*/'
                comment_matches = re.findall(comment_pattern, content, re.IGNORECASE)
                score += len(comment_matches) * 5
                
                # Count overall keyword mentions with diminishing returns
                keyword_count = content.lower().count(keyword_lower)
                score += min(keyword_count, 10) * 0.5
            
            return score
        except Exception as e:
            print(f"Warning: Could not calculate content relevance for {file_path}: {e}")
            return 0

    def _calculate_structural_relevance(self, file_path, issue_keywords):
        """Calculate structural relevance based on dependency patterns"""
        score = 0
        
        # Get direct dependencies
        imports = self.dependencies.get(file_path, set())
        
        # Get files that import this file
        imported_by = []
        for importing_file, imported_files in self.dependencies.items():
            if file_path in imported_files:
                imported_by.append(importing_file)
        
        # Check if any dependencies or importers have high keyword relevance
        for related_file in list(imports) + imported_by:
            related_score = self._calculate_path_relevance(related_file, issue_keywords)
            if related_score > 15:  # High relevance threshold
                score += 5
            elif related_score > 8:  # Medium relevance
                score += 2
        
        # Bonus for files that are central (both import and are imported by others)
        if len(imports) > 0 and len(imported_by) > 0:
            score += min(len(imports), 5) + min(len(imported_by), 5)
        
        return score

    def _get_file_contents(self, file_paths, issue_keywords):
        """
        Get relevant portions of files based on issue keywords.
        Intelligently extracts the most pertinent sections.
        
        Args:
            file_paths: List of file paths to process
            issue_keywords: Keywords extracted from the issue
            
        Returns:
            Dictionary mapping file paths to their relevant content
        """
        contents = {}
        
        for file_path in file_paths:
            try:
                abs_path = self.project_path / file_path
                
                with open(abs_path, 'r', encoding='utf-8') as f:
                    full_content = f.read()
                
                # Always include imports section
                imports_section = self._extract_imports_section(full_content)
                
                # Extract relevant functions/components
                relevant_sections = self._extract_relevant_sections(full_content, issue_keywords)
                
                if relevant_sections:
                    # We found specific relevant sections
                    contents[file_path] = imports_section + "\n\n" + "\n\n".join(relevant_sections)
                    # Add note if we're not including the whole file
                    if len(relevant_sections) < full_content.count('function') + full_content.count('class') + full_content.count('const') - 2:
                        contents[file_path] += "\n\n// Note: Only showing relevant portions of the file"
                else:
                    # If no specific sections found, include the beginning and relevant chunks
                    truncated_content = self._include_relevant_chunks(full_content, issue_keywords)
                    contents[file_path] = truncated_content
                    
            except Exception as e:
                contents[file_path] = f"Error reading file: {e}"
                
        return contents

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

    def _extract_relevant_sections(self, content, keywords):
        """Extract functions or components relevant to the issue keywords"""
        relevant_sections = []
        
        # Different patterns to identify code blocks
        patterns = [
            # Function declaration
            r'(function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\n\})',
            # Arrow function
            r'(const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\n\});?',
            # Class declaration
            r'(class\s+\w+(?:\s+extends\s+\w+)?\s*\{[\s\S]*?\n\})',
            # Object declaration
            r'(const\s+\w+\s*=\s*\{[\s\S]*?\n\});?',
            # React component (function)
            r'(function\s+[A-Z]\w*\s*\([^)]*\)\s*\{[\s\S]*?\n\})',
            # React component (arrow)
            r'(const\s+[A-Z]\w*\s*=\s*(?:\([^)]*\)|)\s*=>\s*\{[\s\S]*?\n\});?'
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, content)
            for match in matches:
                section = match.group(1)
                
                # Check if the section is relevant to any keyword
                score = 0
                for keyword in keywords:
                    # More weight for keywords in the declaration/definition line
                    first_line = section.split('\n')[0].lower()
                    if keyword.lower() in first_line:
                        score += 10
                    
                    # Count keyword occurrences in the entire section
                    keyword_count = section.lower().count(keyword.lower())
                    score += keyword_count
                
                # Include sections with sufficient relevance
                if score > 2:  # Adjust threshold as needed
                    relevant_sections.append(section)
        
        return relevant_sections

    def _include_relevant_chunks(self, content, keywords):
        """Include beginning of file plus chunks containing keywords"""
        lines = content.split('\n')
        
        # Always include first 20 lines (probable imports, setup)
        included_lines = set(range(min(20, len(lines))))
        
        # Find relevant chunks
        for i, line in enumerate(lines):
            if any(keyword.lower() in line.lower() for keyword in keywords):
                # Include 10 lines before and after each match
                for j in range(max(0, i-10), min(len(lines), i+11)):
                    included_lines.add(j)
        
        # Convert to list and sort
        included_line_numbers = sorted(included_lines)
        
        # Build the content with line numbers
        result = []
        current_section = []
        last_line_num = -2
        
        for line_num in included_line_numbers:
            if line_num > last_line_num + 1:
                # Gap detected, complete current section
                if current_section:
                    result.append('\n'.join(current_section))
                    current_section = []
                # Add ellipsis if not at the start
                if result:
                    result.append("\n// ... (code omitted) ...\n")
            
            current_section.append(lines[line_num])
            last_line_num = line_num
        
        # Add the final section
        if current_section:
            result.append('\n'.join(current_section))
        
        return '\n'.join(result)

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
    
    def find_issue_relevant_files(self, issue_text, max_files=15):
        """
        Identifies files most relevant to a GitHub issue using algorithmic scoring.
        
        Args:
            issue_text: The GitHub issue description text
            max_files: Maximum number of files to include
            
        Returns:
            List of file paths relevant to the issue
        """
        # Extract keywords from issue
        issue_keywords = self._extract_keywords(issue_text)
        print(f"Extracted keywords: {issue_keywords}")
        
        if not issue_keywords:
            print("Warning: No meaningful keywords extracted from issue")
            return []
        
        # Score all files by path relevance first
        path_scores = {}
        for file_path in self.file_structure:
            path_score = self._calculate_path_relevance(file_path, issue_keywords)
            path_scores[file_path] = path_score
        
        # Get top matches by path for content analysis
        path_candidates = sorted(path_scores.items(), key=lambda x: x[1], reverse=True)[:50]
        
        # Full relevance scoring for top path candidates
        file_scores = {}
        for file_path, path_score in path_candidates:
            content_score = self._calculate_content_relevance(file_path, issue_keywords)
            structural_score = self._calculate_structural_relevance(file_path, issue_keywords)
            
            # Weighted combination
            total_score = (
                path_score * 0.3 + 
                content_score * 0.5 + 
                structural_score * 0.2
            )
            
            file_scores[file_path] = total_score
        
        # Select top files
        top_files = sorted(file_scores.items(), key=lambda x: x[1], reverse=True)[:max_files]
        
        # Return selected files
        return [file_path for file_path, _ in top_files]

    def prepare_issue_context(self, issue_text):
        """
        Prepares complete context for an issue including relevant files and repo info.
        
        Args:
            issue_text: The GitHub issue description
            
        Returns:
            Dictionary with full context for LLM solution generation
        """
        # Find relevant files
        relevant_files = self.find_issue_relevant_files(issue_text)
        
        if not relevant_files:
            return {
                "error": "Could not identify relevant files for this issue",
                "repository_info": self._generate_repo_fingerprint()
            }
        
        # Get file contents
        # Get file contents
        file_contents = self._get_file_contents(relevant_files, self._extract_keywords(issue_text))
        
        # Prepare dependency summaries
        file_relationships = {}
        for file_path in relevant_files:
            # Get direct dependencies within the relevant files
            imports = [imp["resolved"] for imp in self.file_structure[file_path]["imports"] 
                    if imp["type"] == "internal" and imp["resolved"] in relevant_files]
            
            # Get files that import this file
            imported_by = [f for f in self.file_structure[file_path]["imported_by"] 
                        if f in relevant_files]
            
            if imports or imported_by:
                file_relationships[file_path] = {
                    "imports": imports,
                    "imported_by": imported_by
                }
        
        # Create final context
        issue_context = {
            "issue": issue_text,
            "repository_info": self._generate_repo_fingerprint(),
            "relevant_files": [
                {
                    "path": file_path,
                    "content": file_contents[file_path],
                    "relationships": file_relationships.get(file_path, {})
                }
                for file_path in relevant_files
            ]
        }
        
        return issue_context

def main():
    """
    Main entry point for the script.
    Supports both general repository analysis and issue-specific analysis.
    """
    parser = argparse.ArgumentParser(description='Analyze Next.js project dependencies')
    parser.add_argument('project_path', help='Path to the Next.js project')
    parser.add_argument('--issue', help='GitHub issue text for targeted analysis')
    parser.add_argument('--issue-file', help='File containing GitHub issue text')
    parser.add_argument('--output', default='output.json', help='Output file path')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.project_path):
        print(f"Error: Project path does not exist: {args.project_path}")
        sys.exit(1)
    
    analyzer = NextJsDependencyAnalyzer(args.project_path)
    
    # Analyze full repository structure first
    print(f"Analyzing Next.js project at: {args.project_path}")
    dependency_graph = analyzer.analyze()
    
    # If issue analysis is requested
    if args.issue or args.issue_file:
        issue_text = ""
        if args.issue:
            issue_text = args.issue
        elif args.issue_file:
            try:
                with open(args.issue_file, 'r') as f:
                    issue_text = f.read()
            except Exception as e:
                print(f"Error reading issue file: {e}")
                sys.exit(1)
        
        print(f"Analyzing issue context...")
        issue_context = analyzer.prepare_issue_context(issue_text)
        
        # Save issue context
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(issue_context, f, indent=2, sort_keys=False)
        
        print(f"Issue context saved to {args.output}")
        
        # Print summary of relevant files
        print("\nIssue-relevant files:")
        for i, file_info in enumerate(issue_context["relevant_files"][:5]):
            print(f"{i+1}. {file_info['path']}")
        
        if len(issue_context["relevant_files"]) > 5:
            print(f"   ... and {len(issue_context['relevant_files']) - 5} more files")
    else:
        # Save full dependency graph
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(dependency_graph, f, indent=2, sort_keys=False)
        
        print(f"Dependency graph saved to {args.output}")
        
        # Print repository summary
        print("\nRepository Summary:")
        print(f"Total files: {dependency_graph['metadata']['total_files']}")
        print(f"Total dependencies: {dependency_graph['metadata']['total_dependencies']}")
        print(f"Architectural patterns: {dependency_graph['metadata']['project_architecture']['patterns']}")

if __name__ == "__main__":
    import argparse
    main()