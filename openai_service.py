from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
import os
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

@app.post("/generate-solution", response_model=SolutionResponse)
async def generate_solution(issue: IssueRequest):
    try:
        # Create prompt for OpenAI
        prompt = f"""
        You are an expert software developer tasked with providing solutions to GitHub issues.
        
        Repository: {issue.repo_url}
        Issue Title: {issue.title}
        Issue Description:
        {issue.content}
        
        Please provide a comprehensive solution for this issue. Include:
        1. Analysis of the problem
        2. Suggested approach
        3. Code snippets or examples if applicable
        4. References or resources that might be helpful
        """
        
        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-4", # or any other appropriate model
            messages=[
                {"role": "system", "content": "You are a helpful assistant that provides solutions to GitHub issues."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
        )
        
        # Return the solution
        solution = response.choices[0].message.content
        return {
            "solution": "...",
            "related_files": ["src/pages/api/handler.ts", "src/components/Button.tsx"]
        }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 