import os
import sys
import json
import re
import time
import argparse
import signal
import asyncio
import aiohttp
from pathlib import Path
from collections import defaultdict, deque
from urllib.parse import urlparse
import requests
from typing import List, Dict, Any, Optional, Tuple, Set
from concurrent.futures import ThreadPoolExecutor

# Import OpenAI for AI-based analysis
import openai
from openai import OpenAI
from dotenv import load_dotenv
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from tqdm import tqdm 

# Load environment variables
load_dotenv()

# Regular expressions for imports (to extract imports when analyzing files)
ES6_IMPORT_REGEX = r'import\s+(?:{[^}]*}|\*\s+as\s+[^,]+|[\w\s,]+)\s+from\s+[\'"]([^\'"]+)[\'"]'
DYNAMIC_IMPORT_REGEX = r'import\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)'
REQUIRE_REGEX = r'require\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)'
COMMENT_REGEX = r'(?://[^\n]*|/\*[\s\S]*?\*/)'

# Key directories that are likely to contain important code
KEY_DIRECTORIES = [
    "src/", "app/", "pages/", "components/", "lib/", "utils/", 
    "hooks/", "contexts/", "services/", "api/", "routes/", "modules/"
]

# Flag for cancellation
cancelled = False

# Signal handler
def handle_abort_signal(signum, frame):
    global cancelled
    print(f"Received signal {signum}, cancelling...")
    cancelled = True

class GitHubRepoAnalyzer:
    """Class to handle GitHub repository access and file content retrieval"""
    
    def __init__(self, repo_url: str, branch: str = 'main', github_token: Optional[str] = None):
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
        
        self.file_contents = {}  # Cache for file contents
        self.repo_tree = None
        self.extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']
        
        # For rate limiting
        self.rate_limit_remaining = 5000  # Default GitHub rate limit
        self.rate_limit_reset = 0
        
        # For async operations
        self.session = None

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
        
        print(f"Analyzing repository: {self.owner}/{self.repo}, branch: {self.branch}")

    def github_request(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Make an authenticated request to GitHub API with rate limit handling.
        
        Args:
            endpoint: API endpoint (without the base URL)
            params: Query parameters for the request
            
        Returns:
            Parsed JSON response
        """
        url = f"{self.api_base_url}{endpoint}"
        headers = {}
        
        if self.github_token:
            headers['Authorization'] = f"Bearer {self.github_token}"
        
        # Check if we're close to rate limit and need to wait
        if self.rate_limit_remaining < 10:
            current_time = time.time()
            if current_time < self.rate_limit_reset:
                wait_time = self.rate_limit_reset - current_time + 1  # Add 1 second buffer
                print(f"Rate limit nearly exhausted. Waiting {wait_time:.1f} seconds for reset...")
                time.sleep(wait_time)
        
        try:
            response = requests.get(url, headers=headers, params=params)
            
            # Update rate limit info from headers
            if 'X-RateLimit-Remaining' in response.headers:
                self.rate_limit_remaining = int(response.headers['X-RateLimit-Remaining'])
                
            if 'X-RateLimit-Reset' in response.headers:
                self.rate_limit_reset = int(response.headers['X-RateLimit-Reset'])
            
            if response.status_code == 403 and 'rate limit exceeded' in response.text.lower():
                reset_time = self.rate_limit_reset
                wait_time = reset_time - time.time() + 1  # Add 1 second buffer
                
                if wait_time > 0:
                    print(f"Rate limit exceeded. Waiting {wait_time:.1f} seconds...")
                    time.sleep(wait_time)
                    # Retry the request
                    return self.github_request(endpoint, params)
            
            if response.status_code == 404:
                print(f"Resource not found: {url}")
                return None
                
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            print(f"Error during GitHub API request: {e}")
            # Implement exponential backoff for network errors
            if "429" in str(e):  # Too Many Requests
                wait_time = 30  # Start with 30 seconds
                print(f"Rate limit error. Waiting {wait_time} seconds before retrying...")
                time.sleep(wait_time)
                return self.github_request(endpoint, params)
            raise

    async def init_async_session(self):
        """Initialize aiohttp session for async requests"""
        if self.session is None:
            self.session = aiohttp.ClientSession()
    
    async def close_async_session(self):
        """Close aiohttp session"""
        if self.session is not None:
            await self.session.close()
            self.session = None

    def get_file_content(self, path: str) -> Optional[str]:
        """Get file content from GitHub with caching.
        
        Args:
            path: File path relative to repo root
            
        Returns:
            File content as string
        """
        # Use cached content if available
        if path in self.file_contents:
            return self.file_contents[path]
            
        url = f"{self.raw_base_url}/{path}"
        headers = {}
        
        if self.github_token:
            headers['Authorization'] = f"Bearer {self.github_token}"
            
        try:
            response = requests.get(url, headers=headers)
            
            if response.status_code == 404:
                return None
                
            response.raise_for_status()
            content = response.text
            
            # Cache the content
            self.file_contents[path] = content
            return content
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching file content for {path}: {e}")
            # Implement exponential backoff for network errors
            if "429" in str(e):  # Too Many Requests
                wait_time = 30  # Start with 30 seconds
                print(f"Rate limit error. Waiting {wait_time} seconds before retrying...")
                time.sleep(wait_time)
                return self.get_file_content(path)
            return None

    async def get_file_content_async(self, path: str) -> Optional[str]:
        """Get file content asynchronously from GitHub with caching.
        
        Args:
            path: File path relative to repo root
            
        Returns:
            File content as string
        """
        # Use cached content if available
        if path in self.file_contents:
            return self.file_contents[path]
        
        # Initialize session if needed
        await self.init_async_session()
        
        url = f"{self.raw_base_url}/{path}"
        headers = {}
        
        if self.github_token:
            headers['Authorization'] = f"Bearer {self.github_token}"
        
        try:
            async with self.session.get(url, headers=headers) as response:
                if response.status == 404:
                    return None
                
                response.raise_for_status()
                content = await response.text()
                
                # Cache the content
                self.file_contents[path] = content
                return content
                
        except aiohttp.ClientError as e:
            print(f"Error fetching file content for {path}: {e}")
            # Implement exponential backoff for network errors
            if "429" in str(e):  # Too Many Requests
                wait_time = 30  # Start with 30 seconds
                print(f"Rate limit error. Waiting {wait_time} seconds before retrying...")
                await asyncio.sleep(wait_time)
                return await self.get_file_content_async(path)
            return None

    def explore_repository(self, path="", max_depth=5, visited_dirs=None) -> List[Dict[str, Any]]:
        """Explore repository directory by directory to avoid recursive API limitations.
        
        Args:
            path: Current directory path
            max_depth: Maximum directory depth to explore
            visited_dirs: Set of already visited directories
            
        Returns:
            List of files in the repository
        """
        if visited_dirs is None:
            visited_dirs = set()
            
        if path in visited_dirs or len(path.split('/')) > max_depth:
            return []
            
        visited_dirs.add(path)
        
        endpoint = f"/contents/{path}"
        contents = self.github_request(endpoint)
        
        if not contents:
            return []
            
        # Handle case where contents is a single file
        if not isinstance(contents, list):
            return [{"path": contents["path"], "type": "blob"}] if contents["type"] == "file" else []
            
        all_items = []
        dirs_to_explore = []
        
        for item in contents:
            if item["type"] == "file":
                all_items.append({"path": item["path"], "type": "blob"})
            elif item["type"] == "dir":
                dirs_to_explore.append(item["path"])
        
        # Process directories in parallel
        with ThreadPoolExecutor(max_workers=4) as executor:
            future_results = [
                executor.submit(self.explore_repository, dir_path, max_depth, visited_dirs)
                for dir_path in dirs_to_explore
            ]
            
            for future in future_results:
                all_items.extend(future.result())
        
        return all_items

    def progressive_repo_exploration(self) -> List[Dict[str, Any]]:
        """Explore repository progressively to handle large repositories.
        
        This avoids using the recursive tree API which has limitations.
        
        Returns:
            List of files in the repository
        """
        print("Using progressive repository exploration...")
        
        try:
            # Try to use the git tree API first (it's faster)
            endpoint = f"/git/trees/{self.branch}?recursive=1"
            tree_data = self.github_request(endpoint)
            
            if tree_data and 'tree' in tree_data and not tree_data.get('truncated', False):
                print("Successfully retrieved complete repository tree")
                return tree_data['tree']
                
            # If the tree is truncated, use progressive exploration
            if tree_data and tree_data.get('truncated', False):
                print("Repository tree is truncated. Falling back to directory-by-directory exploration...")
        except Exception as e:
            print(f"Error retrieving repository tree: {e}")
            print("Falling back to directory-by-directory exploration...")
        
        # Explore repository directory by directory
        all_items = self.explore_repository()
        print(f"Found {len(all_items)} items through progressive exploration")
        
        return all_items

    def get_repo_tree(self) -> List[Dict[str, Any]]:
        """Get the full repository tree from GitHub.
        
        Returns:
            List of files in the repository
        """
        if self.repo_tree:
            return self.repo_tree
        
        # Use progressive exploration for potentially large repositories
        self.repo_tree = self.progressive_repo_exploration()
        return self.repo_tree

    def get_relevant_repo_files(self, max_files: int = 300) -> List[str]:
        """Get a list of relevant code files from the repository with smart filtering.
        
        Args:
            max_files: Maximum number of files to return
            
        Returns:
            List of file paths
        """
        tree = self.get_repo_tree()
        
        # Filter to include only code files with supported extensions
        code_files = []
        for item in tree:
            if item['type'] == 'blob':
                path = item['path']
                if any(path.endswith(ext) for ext in self.extensions):
                    # Skip node_modules and other common excluded directories
                    if not any(ignored in path for ignored in [
                        'node_modules/', '.git/', '.next/', 'out/', 'build/', 'dist/',
                        'test/', 'tests/', '__tests__/', '__mocks__/', '.storybook/',
                        'e2e/', '.github/', 'coverage/', 'fixtures/', 'cypress/'
                    ]):
                        code_files.append(path)
        
        total_files = len(code_files)
        print(f"Found {total_files} code files in the repository")
        
        # If we have too many files, use smart sampling
        if total_files > max_files:
            print(f"Repository has {total_files} code files. Using smart sampling...")
            return self._smart_sample_files(code_files, max_files)
        
        return code_files

    def _smart_sample_files(self, code_files: List[str], max_files: int) -> List[str]:
        """Smartly sample files from the repository to ensure good coverage.
        
        Args:
            code_files: List of all code files
            max_files: Maximum number of files to return
            
        Returns:
            Sampled list of file paths
        """
        # 1. First prioritize files in key directories
        key_dir_files = []
        other_files = []
        
        for file_path in code_files:
            if any(file_path.startswith(key_dir) for key_dir in KEY_DIRECTORIES):
                key_dir_files.append(file_path)
            else:
                other_files.append(file_path)
                
        # 2. Sort key directory files by path depth (prefer shallower files)
        key_dir_files.sort(key=lambda p: (len(Path(p).parts), p))
        
        # 3. Balance file types - ensure we have a mix of different file types
        js_files = [f for f in key_dir_files if f.endswith('.js')]
        jsx_files = [f for f in key_dir_files if f.endswith('.jsx')]
        ts_files = [f for f in key_dir_files if f.endswith('.ts')]
        tsx_files = [f for f in key_dir_files if f.endswith('.tsx')]
        other_ext_files = [f for f in key_dir_files if not any(f.endswith(ext) for ext in ['.js', '.jsx', '.ts', '.tsx'])]
        
        # 4. Calculate allocation based on proportion
        total_key_files = len(key_dir_files)
        total_other_files = len(other_files)
        
        # Allocate 80% to key directories, 20% to others, but ensure we get some of each
        key_allocation = min(int(max_files * 0.8), total_key_files)
        other_allocation = min(max_files - key_allocation, total_other_files)
        
        # Adjust if we don't have enough key files
        if key_allocation < total_key_files * 0.5:
            other_allocation = min(max_files - key_allocation, total_other_files)
        
        # 5. Get a balanced selection from each group
        selected_files = []
        
        # Select files from each extension group, proportionally
        file_groups = [js_files, jsx_files, ts_files, tsx_files, other_ext_files]
        group_sizes = [len(group) for group in file_groups]
        total_size = sum(group_sizes)
        
        # Skip empty groups
        file_groups = [group for group, size in zip(file_groups, group_sizes) if size > 0]
        group_sizes = [size for size in group_sizes if size > 0]
        
        if total_size > 0:
            # Calculate allocations for each group
            allocations = [max(1, int(key_allocation * (size / total_size))) for size in group_sizes]
            
            # Adjust to match key_allocation
            while sum(allocations) < key_allocation and any(i < len(g) for i, g in zip(allocations, file_groups)):
                for i in range(len(allocations)):
                    if allocations[i] < len(file_groups[i]):
                        allocations[i] += 1
                        if sum(allocations) >= key_allocation:
                            break
            
            # Take samples from each group
            for group, allocation in zip(file_groups, allocations):
                selected_files.extend(group[:allocation])
        
        # Add other files to reach max_files
        selected_files.extend(other_files[:other_allocation])
        
        # Ensure we don't exceed max_files
        return selected_files[:max_files]

    def extract_imports(self, file_content: str) -> List[str]:
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

class AIIssueAnalyzer:
    """Class that uses OpenAI to analyze GitHub issues and find relevant files"""
    
    def __init__(self, github_analyzer: GitHubRepoAnalyzer):
        """Initialize with a GitHub repository analyzer.
        
        Args:
            github_analyzer: GitHubRepoAnalyzer instance
        """
        self.github_analyzer = github_analyzer
        self._file_embeddings = {}
        
        # Get API key from environment variables
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            raise ValueError("OpenAI API key not found. Set OPENAI_API_KEY environment variable.")
        
        # Initialize OpenAI client
        self.client = OpenAI(api_key=openai_api_key)

    def _get_file_embedding(self, path: str) -> np.ndarray:
        """Fetch or compute embedding for a single file."""
        if path in self._file_embeddings:
            return self._file_embeddings[path]

        content = self.github_analyzer.get_file_content(path) or ""
        # trim very long files if you need to
        snippet = content[:100_000]  
        resp = self.client.embeddings.create(
            model="text-embedding-ada-002", input=snippet
        )
        vec = np.array(resp["data"][0]["embedding"], dtype=np.float32)
        self._file_embeddings[path] = vec
        return vec

    def _get_issue_embedding(self, issue_text: str) -> np.ndarray:
        """Compute a single embedding for the issue text."""
        resp = self.client.embeddings.create(
            model="text-embedding-ada-002", input=issue_text
        )
        return np.array(resp["data"][0]["embedding"], dtype=np.float32)

    def _prefilter_files_by_embedding(
        self,
        issue_text: str,
        all_files: List[str],
        max_sample: int
    ) -> List[str]:
        """
        Rank every file by cosine similarity of its content embedding
        to the issue-text embedding, then return the top `max_sample`.
        """
        # 1) Compute issue vector once
        issue_vec = self._get_issue_embedding(issue_text)

        # 2) Build a matrix of file embeddings
        paths = []
        vectors = []
        for path in tqdm(all_files, desc="Embedding files"):
            vec = self._get_file_embedding(path)
            paths.append(path)
            vectors.append(vec)

        matrix = np.stack(vectors, axis=0)  # shape (N, D)

        # 3) Compute cosine similarities
        sims = cosine_similarity(issue_vec.reshape(1, -1), matrix)[0]

        # 4) Select top-k
        top_idxs = np.argsort(sims)[::-1][:max_sample]
        shortlist = [paths[i] for i in top_idxs]
        return shortlist

    async def analyze_issue(self, issue_text: str, max_files: int = 15) -> Dict[str, Any]:
        """Analyze a GitHub issue and find relevant files with async processing.
        
        Args:
            issue_text: GitHub issue text
            max_files: Maximum number of relevant files to include
            
        Returns:
            Dictionary with issue-focused dependency graph
        """
        print("Starting AI-based issue analysis...")
        
        # Get a list of all code files in the repository
        all_files = self.github_analyzer.get_relevant_repo_files()
        
        # Use OpenAI to identify the most relevant files
        relevant_files = await self.identify_relevant_files(issue_text, all_files, max_files)
        
        if not relevant_files:
            print("No relevant files found for this issue.")
            return {
                "project": {
                    "path": self.github_analyzer.repo_url,
                    "issue": issue_text
                },
                "relevant_files": {},
                "metadata": {
                    "total_relevant_files": 0
                }
            }
        
        # Build the focused dependency graph using async processing
        relevant_file_structure = await self.build_file_structure(relevant_files, issue_text)
        
        # Create the final output structure
        issue_graph = {
            "project": {
                "path": self.github_analyzer.repo_url,
                "issue": issue_text
            },
            "relevant_files": relevant_file_structure,
            "metadata": {
                "total_relevant_files": len(relevant_files)
            }
        }
        
        await self.github_analyzer.close_async_session()
        return issue_graph
    
    async def identify_relevant_files(self, issue_text: str, all_files: List[str], max_files: int) -> List[str]:
        """Use OpenAI to identify files relevant to the issue.
        
        Args:
            issue_text: GitHub issue text
            all_files: List of all file paths in the repository
            max_files: Maximum number of files to return
            
        Returns:
            List of relevant file paths
        """
        global cancelled
        print(f"Identifying relevant files for the issue...")

        if cancelled:
            return []
        
        # For very large repos, first use keyword filtering to reduce the search space
        file_sample = all_files
        if len(all_files) > 1000:
            file_sample = self._prefilter_files_by_embedding(issue_text, all_files, 1000)
            print(f"Pre-filtered to {len(file_sample)} files using keyword matching")
        
        # Format files for the prompt (limit to what will fit in context)
        file_list = "\n".join(file_sample[:1000])
        
        # Improve prompt with keywords and explicit issue details
        issue_lines = issue_text.strip().split('\n')
        issue_title = issue_lines[0] if issue_lines else ""
        issue_body = '\n'.join(issue_lines[1:]) if len(issue_lines) > 1 else ""
        
        # Create the prompt
        prompt = f"""
I need to identify the most relevant files in a codebase for fixing this issue:

ISSUE TITLE: {issue_title}

ISSUE DESCRIPTION:
{issue_body}

Here are the files available in the repository:
{file_list}

Based on this issue, pick only files that need modification or are related to the issue.
You don't need to use all files - only choose files that are truly relevant.
Return ONLY a JSON array of file paths, sorted by relevance (most relevant first).
The JSON should be in this format: ["file1.js", "file2.js", "file3.js"]

Focus on files that would need to be modified to fix the issue, not test files.
Some issues involve interactions between multiple components or subtle implementation details.
Consider both the obvious files based on the issue description AND the underlying components/utilities 
that might control the behavior described.
"""
        
        try:
            # Call OpenAI API
            if cancelled:
                return []

            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a code analysis assistant that helps identify relevant files in a codebase for fixing specific issues. Answer with ONLY the requested JSON format."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=1024
            )

            if cancelled:
                return []
            
            # Extract and parse the response
            content = response.choices[0].message.content.strip()
            
            # Try to find a JSON array in the response
            json_match = re.search(r'\[\s*"[^"]*"(?:\s*,\s*"[^"]*")*\s*\]', content)
            if json_match:
                content = json_match.group(0)
            
            # Parse the JSON array
            try:
                relevant_files = json.loads(content)
                
                # Filter to make sure we only include files that actually exist
                validated_files = [file_path for file_path in relevant_files if file_path in all_files]
                
                if len(validated_files) == 0:
                    print("Warning: OpenAI didn't identify any valid files. Using heuristic approach instead.")
                    # Just return some files as fallback - combining keyword and directory-based approach
                    validated_files = self._fallback_relevant_files(issue_text, all_files, max_files)
                    
                return validated_files[:max_files]
                
            except json.JSONDecodeError:
                print(f"Error: Failed to parse OpenAI response as JSON. Response: {content}")
                # Return fallback files
                return self._fallback_relevant_files(issue_text, all_files, max_files)
                
        except Exception as e:
            if cancelled:
                return []
            print(f"Error during OpenAI API call: {e}")
            # Return fallback files
            return self._fallback_relevant_files(issue_text, all_files, max_files)
    
    def _fallback_relevant_files(self, issue_text: str, all_files: List[str], max_files: int) -> List[str]:
        """Fallback method to find relevant files if OpenAI fails.
        
        Args:
            issue_text: GitHub issue text
            all_files: List of all file paths
            max_files: Maximum number of files to return
            
        Returns:
            List of relevant file paths
        """
        # Combine keyword filtering with key directory prioritization
        keyword_matches = self._prefilter_files_by_keywords(issue_text, all_files, max_files * 2)
        
        # Prioritize files in key directories
        key_dir_files = [f for f in keyword_matches if any(f.startswith(d) for d in KEY_DIRECTORIES)]
        other_files = [f for f in keyword_matches if not any(f.startswith(d) for d in KEY_DIRECTORIES)]
        
        # Sort key directory files by path depth (prefer shallower files)
        key_dir_files.sort(key=lambda p: (len(Path(p).parts), p))
        
        # Combine and limit
        combined_files = key_dir_files + other_files
        return combined_files[:max_files]
    
    async def extract_relevant_code(self, file_path: str, issue_text: str) -> str:
        """Extract relevant code snippets from a file based on the issue.
        
        Args:
            file_path: Path of the file
            issue_text: GitHub issue text
            
        Returns:
            String containing the most relevant code snippets
        """
        global cancelled
        if cancelled:
            return ""
        content = await self.github_analyzer.get_file_content_async(file_path)
        if not content or cancelled:
            return ""
            
        # Extract imports section
        imports_section = self._extract_imports_section(content)
        
        # Create a prompt for OpenAI to identify relevant code snippets
        prompt = f"""
File: {file_path}
Issue: {issue_text}

I need to find the most relevant parts of this code file for fixing the issue described above.
The full file content is:

```
{content}
```

Identify and extract the most relevant code sections (functions, components, or blocks) in this file that would likely need to be modified to fix the issue.
"""
        
        try:
            # Call OpenAI API
            if cancelled:
                return ""
            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a code analysis assistant that helps identify relevant code snippets for fixing specific issues."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=1500
            )

            if cancelled:
                return ""
            
            # Extract the response
            ai_extracted_snippets = response.choices[0].message.content.strip()

            if cancelled:
                return ""
            
            # If OpenAI returns code blocks, try to extract them
            code_blocks = re.findall(r'```(?:[\w]*\n)?([\s\S]*?)```', ai_extracted_snippets)

            if cancelled:
                return ""
            
            if code_blocks:
                # Join the blocks with separators
                return imports_section + "\n\n" + "\n\n".join(code_blocks)
            else:
                # Fall back to a simpler approach - first 20 lines
                first_part = '\n'.join(content.split('\n')[:20])
                if len(content.split('\n')) > 20:
                    first_part += '\n// ... rest of file omitted'
                return imports_section + "\n\n" + first_part
                
        except Exception as e:
            if cancelled:
                return ""
            print(f"Error identifying relevant code snippets with OpenAI: {e}")
            # Fall back to a simpler approach
            first_part = '\n'.join(content.split('\n')[:20])
            if len(content.split('\n')) > 20:
                first_part += '\n// ... rest of file omitted'
            return imports_section + "\n\n" + first_part
    
    def _extract_imports_section(self, content: str) -> str:
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
    
    async def build_file_structure(self, relevant_files: List[str], issue_text: str) -> Dict[str, Any]:
        """Build the file structure for the dependency graph using async processing.
        
        Args:
            relevant_files: List of relevant file paths
            issue_text: GitHub issue text
            
        Returns:
            Dictionary with file structures
        """
        print(f"Building dependency graph for {len(relevant_files)} relevant files...")
        relevant_file_structure = {}
        
        # Track import relationships
        dependencies = defaultdict(set)
        
        # Process files in parallel with asyncio
        async def process_file(file_path):
            global cancelled
            if cancelled:
                return file_path, None
            print(f"Processing file: {file_path}")
            
            # Get file content
            content = await self.github_analyzer.get_file_content_async(file_path)
            if cancelled:
                return file_path, None
            if not content:
                return file_path, None
                
            # Extract imports
            import_paths = self.github_analyzer.extract_imports(content)
            imports = []
            
            # Resolve imports to full paths
            for import_path in import_paths:
                # Skip external libraries
                if import_path.startswith('.') or import_path.startswith('/'):
                    # Simple resolution for relative imports
                    if import_path.startswith('.'):
                        base_dir = Path(file_path).parent
                        resolved_path = str(base_dir / import_path)
                        
                        # Find matching file with extension
                        for ext in self.github_analyzer.extensions:
                            if resolved_path + ext in relevant_files:
                                dependencies[file_path].add(resolved_path + ext)
                                imports.append({
                                    "type": "internal",
                                    "path": import_path,
                                    "resolved": resolved_path + ext
                                })
                                break
            
            # Extract relevant code snippets
            relevant_content = await self.extract_relevant_code(file_path, issue_text)
            if cancelled:
                return file_path, None
            
            # Return the processed data
            return file_path, {
                "path": file_path,
                "relevant_content": relevant_content,
                "imports": imports,
                "imported_by": []
            }
        
        # Process all files concurrently
        tasks = [process_file(file_path) for file_path in relevant_files]

        if cancelled:
            return {}
        
        results = await asyncio.gather(*tasks)
        
        # Add processed files to the structure
        for file_path, file_data in results:
            if file_data:
                relevant_file_structure[file_path] = file_data
        
        # Build imported_by relationships
        for file_path, imported_files in dependencies.items():
            for imported_file in imported_files:
                if imported_file in relevant_file_structure:
                    if "imported_by" not in relevant_file_structure[imported_file]:
                        relevant_file_structure[imported_file]["imported_by"] = []
                    
                    if file_path not in relevant_file_structure[imported_file]["imported_by"]:
                        relevant_file_structure[imported_file]["imported_by"].append(file_path)
        
        return relevant_file_structure

async def async_main(args):
    """Asynchronous main function for better performance"""
    global cancelled
    try:
        github_analyzer = GitHubRepoAnalyzer(args.repo_url, args.branch, args.token)
        ai_analyzer = AIIssueAnalyzer(github_analyzer)

        if cancelled:
            print("Cancelled before starting analysis.")
            return

        dependency_graph = await ai_analyzer.analyze_issue(args.issue_text, args.max_files)

        if cancelled:
            print("Cancelled during analysis.")
            return

        output_file = args.output
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(dependency_graph, f, indent=2, sort_keys=False)
        
        # Print summary
        print("\nIssue Analysis Summary:")
        print(f"Total issue-relevant files: {len(dependency_graph['relevant_files'])}")
        print("\nTop relevant files:")
        for i, file_path in enumerate(dependency_graph['relevant_files'].keys()):
            if i < 10:  # Show top 10
                print(f"- {file_path}")
    except Exception as e:
        print(f"Error analyzing repository: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

def main():
    signal.signal(signal.SIGINT, handle_abort_signal)
    signal.signal(signal.SIGTERM, handle_abort_signal)  # For kill signals
    parser = argparse.ArgumentParser(description='Analyze Next.js project dependencies and find issue-relevant files.')
    parser.add_argument('repo_url', help='GitHub repository URL (e.g. https://github.com/owner/repo)')
    parser.add_argument('--issue', '-i', help='GitHub issue text or description', default=None)
    parser.add_argument('--issue-file', '-f', help='File containing GitHub issue text', default=None)
    parser.add_argument('--output', '-o', help='Output JSON file name', default='nextjs_dependency_graph.json')
    parser.add_argument('--max-files', '-m', type=int, help='Maximum number of relevant files to include', default=15)
    parser.add_argument('--branch', '-b', help='Repository branch to analyze', default='main')
    parser.add_argument('--token', '-t', help='GitHub personal access token', default=None)
    
    args = parser.parse_args()
    
    # Validate repo URL
    if not (args.repo_url.startswith('https://github.com/') or args.repo_url.startswith('http://github.com/')):
        print(f"Error: URL is not a GitHub repository URL: {args.repo_url}")
        print("Expected format: https://github.com/owner/repo")
        sys.exit(1)
    
    # Check for issue text
    issue_text = None
    if args.issue:
        issue_text = args.issue
    elif args.issue_file:
        try:
            with open(args.issue_file, 'r', encoding='utf-8') as f:
                issue_text = f.read()
        except Exception as e:
            print(f"Error reading issue file: {e}")
            sys.exit(1)
    
    if not issue_text:
        print("Error: Issue text is required. Provide it with --issue or --issue-file")
        print("Example: python next_context.py https://github.com/owner/repo --issue 'Bug description'")
        sys.exit(1)
    
    # Store issue text in args for async_main
    args.issue_text = issue_text
    
    # Run the async main function
    if sys.platform == "win32" and sys.version_info >= (3, 8):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    asyncio.run(async_main(args))

if __name__ == "__main__":
    main()