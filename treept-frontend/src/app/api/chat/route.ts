// /app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatContext = {
  issueTitle: string;
  issueContent: string;
  solution: string;
  relatedFiles: string[];
  previousMessages: ChatMessage[];
  repoUrl?: string; // Add repo URL to identify which dependency graph to use
};

/**
 * Get issue-specific dependency graph from the JSON file
 */
function getDependencyGraph(repoUrl?: string) {
  try {
    // The analysis is stored in the project root directory
    const currentDir = process.cwd();
    const jsonPath = path.join(currentDir, "nextjs_dependency_graph.json");
    
    // Read JSON analysis if available
    if (fs.existsSync(jsonPath)) {
      const fileContent = fs.readFileSync(jsonPath, 'utf-8');
      const dependencyGraph = JSON.parse(fileContent);
      
      // Verify this is the right dependency graph for the repo if repoUrl is provided
      if (repoUrl && dependencyGraph.project && dependencyGraph.project.path !== repoUrl) {
        console.warn(`Dependency graph is for ${dependencyGraph.project.path}, but requested for ${repoUrl}`);
      }
      
      return dependencyGraph;
    } else {
      console.warn(`Dependency graph file not found at: ${jsonPath}`);
      return null;
    }
  } catch (error) {
    console.error("Error reading dependency graph file:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, context } = body as { 
      message: string; 
      context: ChatContext;
    };

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("GROQ_API_KEY is not defined in environment variables");
      return NextResponse.json(
        { error: "API configuration error" },
        { status: 500 }
      );
    }

    const { issueTitle, issueContent, solution, relatedFiles, repoUrl, previousMessages } = context;

    // Get dependency graph from file
    const dependencyGraph = getDependencyGraph(repoUrl);
    
    // Format dependency graph information if available
    let dependencyGraphInfo = "";
    if (dependencyGraph && dependencyGraph.relevant_files) {
      dependencyGraphInfo = `
Dependency Graph Information:
${Object.entries(dependencyGraph.relevant_files).slice(0, 5).map(([filePath, fileData]) => {
  const file = fileData as any;
  return `
File: ${file.path}
${file.imports && file.imports.length > 0 ? `Imports: ${file.imports.map((imp: any) => imp.path || imp).join(', ')}` : ''}
${file.imported_by && file.imported_by.length > 0 ? `Imported by: ${file.imported_by.join(', ')}` : ''}
Relevant Content:
\`\`\`
${file.relevant_content.substring(0, 300)}${file.relevant_content.length > 300 ? '...' : ''}
\`\`\`
`;
}).join('\n')}
${Object.keys(dependencyGraph.relevant_files).length > 5 ? `...and ${Object.keys(dependencyGraph.relevant_files).length - 5} more files` : ''}`;
    }

    const formattedMessages = [
      {
        role: "system",
        content: `You are an AI assistant helping with GitHub issues. 
Current issue: "${issueTitle}"
Issue content: ${issueContent}
Solution: ${solution}
Related files: ${relatedFiles.join(", ")}
${dependencyGraphInfo}

Your task is to help the user understand the solution and answer any questions they have about the issue.
Use the context provided (including the dependency graph information) to give accurate and helpful answers.
Be concise, technical, and specific in your responses.
When referencing code, refer to specific files and their relationships shown in the dependency graph when applicable.`
      }
    ];

    previousMessages.forEach(msg => {
      formattedMessages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add the user's current message
    formattedMessages.push({
      role: "user",
      content: message
    });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama3-8b-8192", 
        messages: formattedMessages,
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API error:", data);
      return NextResponse.json(
        { error: `Groq API error: ${data.error?.message || "Unknown error"}` },
        { status: response.status }
      );
    }

    return NextResponse.json({
      response: data.choices[0]?.message?.content || "Sorry, I couldn't generate a response."
    });
  } catch (error) {
    console.error("Error processing chat:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}