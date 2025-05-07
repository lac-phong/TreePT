import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request) {
  try {
    const body = await request.json();
    const { repoUrl } = body;

    // Validate URL
    if (!repoUrl || !repoUrl.startsWith("https://github.com/")) {
      return Response.json(
        { error: "Invalid GitHub URL" },
        { status: 400 }
      );
    }
    
    // Run next_context.py with the repo URL
    console.log(`Analyzing repository: ${repoUrl}`);
    
    try {
      // Path to the Python script and project root directory
      const projectRootDir = path.join(process.cwd(), '..');
      const pythonScriptPath = path.join(projectRootDir, 'next_context.py');
      
      // Change working directory to project root before running the script
      // This ensures output files are generated in the project root
      const cmd = `cd ${projectRootDir} && python3 ${pythonScriptPath} "${repoUrl}"`;
      
      // Run the Python script with the repo URL
      const { stdout, stderr } = await execAsync(cmd);
      
      // If there was an error message and it's not just a warning, throw an error
      if (stderr && !stderr.includes("Warning:")) {
        console.error(`Python script error: ${stderr}`);
        throw new Error(stderr);
      }
      
      // The analysis is already generated in the project root directory
      // No need to cache or store it in the frontend
      // The OpenAI service will read these files directly
      
      return Response.json({ 
        message: "Repository analysis complete"
      });
      
    } catch (execError) {
      console.error(`Error running analysis: ${execError.message}`);
      return Response.json(
        { error: `Failed to analyze repository: ${execError.message}` },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error("Error in analyze_repo:", error);
    return Response.json(
      { error: error.message || "Failed to analyze repository" },
      { status: 500 }
    );
  }
} 