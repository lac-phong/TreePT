import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request) {
  // Store the Python process reference
  let pythonProcess = null;
  
  // Handle request aborted event
  request.signal.addEventListener('abort', () => {
    if (pythonProcess) {
      console.log('Request aborted, killing Python process');
      pythonProcess.kill();
    }
  });

  try {
    const body = await request.json();
    const { repoUrl, issueText, issueTitle } = body;

    // Validate inputs
    if (!repoUrl || !repoUrl.startsWith("https://github.com/")) {
      return Response.json(
        { error: "Invalid GitHub URL" },
        { status: 400 }
      );
    }

    if (!issueText) {
      return Response.json(
        { error: "Issue text is required" },
        { status: 400 }
      );
    }
    
    console.log(`Analyzing issue relevance for repository: ${repoUrl}`);
    
    try {
      // Path to the Python script and project root directory
      const projectRootDir = path.join(process.cwd(), '..');
      const pythonScriptPath = path.join(projectRootDir, 'next_context.py');
      
      // Check if the Python script exists
      if (!fs.existsSync(pythonScriptPath)) {
        return Response.json(
          { error: `Python script not found at ${pythonScriptPath}` },
          { status: 500 }
        );
      }
      
      // Create a temporary file to store the issue text
      const issueFilePath = path.join(projectRootDir, 'temp_issue.txt');
      fs.writeFileSync(issueFilePath, issueText);
      
      // Use spawn instead of exec to get more detailed output
      return new Promise((resolve) => {
        console.log(`Running Python script: ${projectRootDir}/.venv/bin/python ${pythonScriptPath} "${repoUrl}" --issue-file "${issueFilePath}"`);
        
        const pythonProcess = spawn('python', 
          [pythonScriptPath, repoUrl, '--issue-file', issueFilePath], 
          { 
            cwd: projectRootDir, 
            shell: true,
            // Increase memory limit for large repos
            env: { 
              ...process.env, 
              NODE_OPTIONS: "--max-old-space-size=4096",
              // Ensure we use the PATH which includes pyenv's Python
              PATH: process.env.PATH 
            }
          }
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
        
        // Add timeout handler for very large repos
        const timeoutMs = 5 * 60 * 1000; // 5 minutes
        const timeout = setTimeout(() => {
          console.error("Python process timed out after 5 minutes");
          pythonProcess.kill();
          resolve(Response.json({ 
            error: "Repository analysis timed out. The repository may be too large for complete analysis."
          }, { status: 500 }));
        }, timeoutMs);
        
        pythonProcess.on('close', (code) => {
          clearTimeout(timeout);
          console.log(`Python process exited with code ${code}`);
          
          // Clean up the temporary file
          try {
            fs.unlinkSync(issueFilePath);
          } catch (err) {
            console.error(`Error deleting temporary file: ${err.message}`);
          }
          
          if (code !== 0) {
            console.error(`Full stderr: ${stderrData}`);
            
            // Check for specific errors and provide more helpful messages
            if (stderrData.includes("ModuleNotFoundError: No module named 'aiohttp'")) {
              resolve(Response.json({ 
                error: "Python dependency 'aiohttp' is missing. Please run 'pip install aiohttp openai requests python-dotenv' in your virtual environment."
              }, { status: 500 }));
            } 
            else if (stderrData.includes("ModuleNotFoundError: No module named 'openai'")) {
              resolve(Response.json({ 
                error: "Python dependency 'openai' is missing. Please run 'pip install openai requests python-dotenv aiohttp' in your virtual environment."
              }, { status: 500 }));
            }
            else if (stderrData.includes("ModuleNotFoundError")) {
              const moduleMatch = stderrData.match(/No module named '([^']+)'/);
              const missingModule = moduleMatch ? moduleMatch[1] : "unknown";
              resolve(Response.json({ 
                error: `Python dependency '${missingModule}' is missing. Please install it with pip.`
              }, { status: 500 }));
            }
            else if (stderrData.includes("Error: OpenAI API key not found")) {
              resolve(Response.json({ 
                error: "OpenAI API key not found. Please set the OPENAI_API_KEY environment variable."
              }, { status: 500 }));
            }
            else if (stderrData.includes("Rate limit exceeded")) {
              resolve(Response.json({ 
                error: "GitHub API rate limit exceeded. Please try again later or provide a GitHub token."
              }, { status: 500 }));
            }
            else if (stderrData.includes("Could not retrieve repository tree")) {
              resolve(Response.json({ 
                error: "Failed to retrieve repository structure. The repository may be too large or private. Try providing a GitHub token."
              }, { status: 500 }));
            }
            else {
              resolve(Response.json({ 
                error: `Python script failed with code ${code}. Error: ${stderrData}`
              }, { status: 500 }));
            }
            return;
          }
          
          resolve(Response.json({ 
            message: "Issue analysis complete",
            output: stdoutData
          }));
        });
        
        pythonProcess.on('error', (err) => {
          clearTimeout(timeout);
          console.error(`Failed to start Python process: ${err.message}`);
          
          // Clean up the temporary file
          try {
            fs.unlinkSync(issueFilePath);
          } catch (cleanupErr) {
            console.error(`Error deleting temporary file: ${cleanupErr.message}`);
          }
          
          // Return a properly formatted JSON error response
          resolve(Response.json({ 
            error: `Failed to start Python process: ${err.message}`
          }, { status: 500 }));
        });

        // Add a handler for the request being aborted
        request.signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          pythonProcess.kill();
          
          // Clean up the temporary file
          try {
            fs.unlinkSync(issueFilePath);
          } catch (err) {
            console.error(`Error deleting temporary file: ${err.message}`);
          }
          
          resolve(new Response(null, { status: 499 })); // 499 is a common status for client closed request
        });
      });
      
    } catch (execError) {
      console.error(`Error running analysis: ${execError.message}`);
      return Response.json(
        { error: `Failed to analyze issue: ${execError.message}` },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error("Error in analyze_issue:", error);
    return Response.json(
      { error: error.message || "Failed to analyze issue" },
      { status: 500 }
    );
  }
}