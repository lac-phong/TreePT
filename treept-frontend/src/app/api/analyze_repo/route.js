import { exec, spawn } from 'child_process';
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
      
      // Use spawn instead of exec to get more detailed output
      return new Promise((resolve, reject) => {
        console.log(`Running Python script: ${projectRootDir}/.venv/bin/python ${pythonScriptPath} "${repoUrl}"`);
        
        const pythonProcess = spawn(`${projectRootDir}/.venv/bin/python`, 
          [pythonScriptPath, repoUrl], 
          { cwd: projectRootDir, shell: true }
        );
        
        let stdoutData = '';
        let stderrData = '';
        
        pythonProcess.stdout.on('data', (data) => {
          const chunk = data.toString();
          stdoutData += chunk;
          console.log(`PYTHON STDOUT: ${chunk}`);
        });
        
        pythonProcess.stderr.on('data', (data) => {
          const chunk = data.toString();
          stderrData += chunk;
          console.error(`PYTHON STDERR: ${chunk}`);
        });
        
        pythonProcess.on('close', (code) => {
          console.log(`Python process exited with code ${code}`);
          
          if (code !== 0) {
            console.error(`Full stderr: ${stderrData}`);
            reject(new Error(`Python script failed with code ${code}. Error: ${stderrData}`));
            return;
          }
          
          resolve(Response.json({ 
            message: "Repository analysis complete",
            output: stdoutData
          }));
        });
        
        pythonProcess.on('error', (err) => {
          console.error(`Failed to start Python process: ${err.message}`);
          reject(new Error(`Failed to start Python process: ${err.message}`));
        });
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