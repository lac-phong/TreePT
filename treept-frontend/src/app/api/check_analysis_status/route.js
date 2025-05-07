import fs from 'fs';
import path from 'path';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const repoUrl = searchParams.get('repoUrl');

    if (!repoUrl || !repoUrl.startsWith("https://github.com/")) {
      return Response.json(
        { error: "Invalid GitHub URL" },
        { status: 400 }
      );
    }

    // Check if analysis files exist in project root
    const jsonFilePath = path.join(process.cwd(), '..', 'nextjs_dependency_graph.json');
    const summaryFilePath = path.join(process.cwd(), '..', 'repo_summary.txt');
    
    // Log paths and existence for debugging
    console.log(`Checking for analysis files:`);
    console.log(`JSON path: ${jsonFilePath}, exists: ${fs.existsSync(jsonFilePath)}`);
    console.log(`Summary path: ${summaryFilePath}, exists: ${fs.existsSync(summaryFilePath)}`);
    
    // Check if at least one of the files exists
    const analysisExists = fs.existsSync(jsonFilePath) || fs.existsSync(summaryFilePath);
    
    return Response.json({
      analysisComplete: analysisExists,
      message: analysisExists ? "Analysis is complete" : "Analysis is not complete or hasn't been started"
    });
  } catch (error) {
    console.error("Error checking analysis status:", error);
    return Response.json(
      { error: "Failed to check analysis status" },
      { status: 500 }
    );
  }
} 