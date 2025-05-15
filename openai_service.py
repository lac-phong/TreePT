from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
import os
import json
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get OpenAI API key from environment variable
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OpenAI API key not found. Set OPENAI_API_KEY environment variable.")

# Initialize OpenAI client
client = openai.OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI()

# Add CORS middleware to allow requests from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class IssueRequest(BaseModel):
    title: str
    content: str
    repo_url: str

class SolutionResponse(BaseModel):
    solution: str

def get_repo_analysis(repo_url):
    """Get repository analysis data for a given repo URL"""
    # Analysis files are in the project root directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(current_dir, "nextjs_dependency_graph.json")
    summary_path = os.path.join(current_dir, "repo_summary.txt")
    
    repo_analysis = None
    repo_summary = None
    
    # Read JSON analysis if available
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r') as f:
                repo_analysis = json.load(f)
        except Exception as e:
            print(f"Error reading analysis file: {e}")
    
    # Read text summary if available
    if os.path.exists(summary_path):
        try:
            with open(summary_path, 'r') as f:
                repo_summary = f.read()
        except Exception as e:
            print(f"Error reading summary file: {e}")

    if not repo_analysis or not repo_summary:
        # print them if they dont exist (None)
        print("Repo analysis:" + repo_analysis)
        print("Repo summary:" + repo_summary)
    
    return repo_analysis, repo_summary

@app.post("/generate-solution", response_model=SolutionResponse)
async def generate_solution(issue: IssueRequest):
    try:
        # Get repository analysis data
        repo_analysis, repo_summary = get_repo_analysis(issue.repo_url)
        
        # Prepare the prompt with available context
        repo_context = ""
        if repo_summary:
            repo_context = f"""
            Repository Analysis:
            {repo_analysis}
            Repository Analysis Summary:
            {repo_summary}
            """
        
        # Build the prompt
        prompt = f"""
        Repository: {issue.repo_url}
        Issue Title: {issue.title}
        Issue Description:
        {issue.content}
        
        {repo_context}
        
        Please provide a comprehensive solution for this issue. Include:
        1. Analysis of the problem
        2. Suggested approach
        3. Code snippets or examples if applicable
        4. Detailed implementation steps
        5. References or resources that might be helpful
        """
        
        if repo_summary:
            prompt += """
            
            Make sure your solution considers the repository structure and architecture described in the analysis summary.
            """
        
        # call OpenAI API
        response = client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that provides solutions to GitHub issues. Use the repository structure information to provide detailed, accurate, and context-aware solutions."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1500,
        )
        
        # Return the solution
        solution = response.choices[0].message.content
        return {
            "solution": solution,
            "related_files": ["src/pages/api/handler.ts", "src/components/Button.tsx"]
        }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 