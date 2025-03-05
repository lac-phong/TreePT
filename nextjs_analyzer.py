import os
import json
import argparse
from pathlib import Path
import re

# To Run
# python3 nextjs_analyzer.py path -o structure.json

def analyze_nextjs_app(app_dir, output_file="app_structure.json"):
    
    def extract_file_details(file_path):
        if not any(str(file_path).endswith(ext) for ext in ['.js', '.jsx', '.ts', '.tsx']):
            return None
            
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            imports = []
            import_pattern = r'import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+[\'"]([^\'"]+)[\'"]'
            for match in re.finditer(import_pattern, content):
                imports.append(match.group(0))
                
            functions = []
            func_pattern = r'(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)'
            for match in re.finditer(func_pattern, content):
                func_name = match.group(1)
                params = match.group(2).strip()
                functions.append({
                    "name": func_name,
                    "type": "function",
                    "params": [p.strip() for p in params.split(',')] if params else []
                })
                
            arrow_pattern = r'(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>'
            for match in re.finditer(arrow_pattern, content):
                func_name = match.group(1)
                params = match.group(2).strip()
                functions.append({
                    "name": func_name, 
                    "type": "arrow function",
                    "params": [p.strip() for p in params.split(',')] if params else []
                })
                
            props = []
            props_pattern = r'(?:interface|type)\s+(\w+)Props\s*(?:extends[^{]+)?\s*{\s*([^}]+)\s*}'
            for match in re.finditer(props_pattern, content):
                prop_name = match.group(1)
                prop_content = match.group(2)
                prop_items = []
                prop_item_pattern = r'(\w+)(?:\?)?:\s*([^;]+)'
                for prop_match in re.finditer(prop_item_pattern, prop_content):
                    prop_items.append({
                        "name": prop_match.group(1),
                        "type": prop_match.group(2).strip()
                    })
                
                props.append({
                    "component": prop_name,
                    "properties": prop_items
                })
                
            has_default_export = bool(re.search(r'export\s+default', content))
                
            return {
                "imports": imports,
                "functions": functions,
                "props": props,
                "has_default_export": has_default_export
            }
            
        except Exception as e:
            print(f"Error analyzing file {file_path}: {e}")
            return None
    
    def process_directory(path, relative_to):
        relative_path = path.relative_to(relative_to)
        dir_name = path.name
        
        flags = {
            "route_group": dir_name.startswith("(") and dir_name.endswith(")"),
            "dynamic": dir_name.startswith("[") and not dir_name.startswith("[...") and dir_name.endswith("]"),
            "catch_all": dir_name.startswith("[...") and dir_name.endswith("]"),
            "optional_catch_all": dir_name.startswith("[[...") and dir_name.endswith("]]"),
            "parallel": dir_name.startswith("@"),
            "intercepting": bool(re.match(r"^\(\.+\)", dir_name))
        }
        
        keywords = ["auth", "protected", "private", "admin", "dashboard"]
        flags["protected"] = any(keyword in str(relative_path).lower() for keyword in keywords)
        
        result = {
            "name": dir_name,
            "path": str(relative_path),
            "type": "directory",
            "flags": flags,
            "files": [],
            "directories": []
        }
        
        for item in path.iterdir():
            if item.is_file():
                file_type = "regular"
                if item.name.startswith("page."):
                    file_type = "page"
                elif item.name.startswith("layout."):
                    file_type = "layout"
                elif item.name.startswith("loading."):
                    file_type = "loading"
                elif item.name.startswith("error."):
                    file_type = "error"
                elif item.name.startswith("not-found."):
                    file_type = "not-found"
                elif item.name.startswith("route."):
                    file_type = "api"
                elif item.name in ["middleware.js", "middleware.ts"]:
                    file_type = "middleware"
                
                file_info = {
                    "name": item.name,
                    "type": file_type
                }
                
                if file_type in ["page", "layout", "api"]:
                    details = extract_file_details(item)
                    if details:
                        file_info["details"] = details
                
                result["files"].append(file_info)
            elif item.is_dir():
                result["directories"].append(process_directory(item, relative_to))
        
        return result
    
    app_path = Path(app_dir)
    if not app_path.exists() or not app_path.is_dir():
        print(f"Error: {app_dir} is not a valid directory")
        return
    
    structure = process_directory(app_path, app_path.parent)
    
    with open(output_file, 'w') as f:
        json.dump(structure, f, indent=2)
    
    print(f"App structure saved to {output_file}")
    
    generate_component_dependencies(structure, output_file.replace('.json', '.md'))

def generate_component_dependencies(structure, output_file):
    mermaid = ["flowchart LR"]
    
    components = {}  
    
    def get_component_name(file_info):
        if "details" not in file_info or "functions" not in file_info["details"]:
            return None
            
        for func in file_info["details"]["functions"]:
            if func["name"][0].isupper() or func["name"].endswith("Page") or func["name"].endswith("Layout"):
                return func["name"]
                
        if file_info["details"]["functions"]:
            return file_info["details"]["functions"][0]["name"]
            
        return None
    
    def categorize_import(import_str):
        match = re.search(r'from\s+[\'"]([^\'"]+)[\'"]', import_str)
        if not match:
            return None
            
        module = match.group(1)
        
        if module.startswith("react") or module.startswith("next"):
            return "CoreLibraries"
        elif module.startswith("@tanstack") or module.startswith("framer") or "lucide" in module:
            return "ExternalLibraries"
        elif module.startswith("@/components"):
            return "UIComponents"
        elif module.startswith("@/lib") or module.startswith("@/utils"):
            return "Utils"
        elif module.startswith("@/context"):
            return "Contexts"
        elif module.startswith("@/api") or "api" in module:
            return "API"
        else:
            return "Other"
    
    def collect_components(node, path=""):
        current_path = f"{path}/{node['name']}" if path else node['name']
        
        if node["type"] == "directory":
            for file in node["files"]:
                if file["type"] in ["page", "layout"] and "details" in file:
                    component_name = get_component_name(file)
                    if component_name:
                        components[component_name] = {
                            "type": file["type"],
                            "path": current_path,
                            "imports": file["details"]["imports"] if "imports" in file["details"] else [],
                            "functions": file["details"]["functions"] if "functions" in file["details"] else []
                        }
            
            for directory in node["directories"]:
                collect_components(directory, current_path)
    
    collect_components(structure)
    
    dependency_groups = {
        "CoreLibraries": set(),
        "ExternalLibraries": set(),
        "UIComponents": set(),
        "Utils": set(),
        "Contexts": set(),
        "API": set(),
        "Other": set()
    }
    
    component_dependencies = {}
    
    for comp_name, comp_data in components.items():
        component_dependencies[comp_name] = []
        
        for import_str in comp_data["imports"]:
            category = categorize_import(import_str)
            if category:
                dependency_groups[category].add(import_str)
                component_dependencies[comp_name].append(category)
    
    mermaid.append("    %% Main page components")
    for comp_name, comp_data in components.items():
        if comp_data["type"] == "page":
            mermaid.append(f"    {comp_name}[\"{comp_name}()\"]:::page")
    
    mermaid.append("\n    %% Layout components")
    for comp_name, comp_data in components.items():
        if comp_data["type"] == "layout":
            mermaid.append(f"    {comp_name}[\"{comp_name}()\"]:::layout")
    
    for group, imports in dependency_groups.items():
        if imports:  
            mermaid.append(f"\n    %% {group}")
            mermaid.append(f"    {group}[\"{group}\"]:::{group.lower()}")
    
    mermaid.append("\n    %% Dependencies")
    for comp_name, dependencies in component_dependencies.items():
        group_counts = {}
        for dep in dependencies:
            group_counts[dep] = group_counts.get(dep, 0) + 1
        
        for group in set(dependencies):
            mermaid.append(f"    {group} --> {comp_name}")
    
    mermaid.append("\n    %% Styling definitions")
    mermaid.append("    classDef page fill:#d4f0fd,stroke:#333,stroke-width:1px;")
    mermaid.append("    classDef layout fill:#d4fdd4,stroke:#333,stroke-width:1px;")
    mermaid.append("    classDef corelibraries fill:#f9d4fd,stroke:#333,stroke-width:1px;")
    mermaid.append("    classDef externallibraries fill:#d4d4fd,stroke:#333,stroke-width:1px;")
    mermaid.append("    classDef uicomponents fill:#ffd4d4,stroke:#333,stroke-width:1px;")
    mermaid.append("    classDef utils fill:#d4fdf9,stroke:#333,stroke-width:1px;")
    mermaid.append("    classDef contexts fill:#ffffb3,stroke:#333,stroke-width:1px;")
    mermaid.append("    classDef api fill:#f9f9d4,stroke:#333,stroke-width:1px;")
    mermaid.append("    classDef other fill:#f5f5f5,stroke:#333,stroke-width:1px;")
    
    with open(output_file, 'w') as f:
        f.write("\n".join(mermaid))
    
    print(f"Component dependencies diagram saved to {output_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate Next.js app structure with route information")
    parser.add_argument("app_dir", help="Path to the Next.js app directory")
    parser.add_argument("-o", "--output", default="app_structure.json", help="Output JSON file path")
    
    args = parser.parse_args()
    analyze_nextjs_app(args.app_dir, args.output)