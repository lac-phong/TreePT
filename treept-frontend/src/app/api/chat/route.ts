// /app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

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
};

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

    const { issueTitle, issueContent, solution, relatedFiles, previousMessages } = context;

    const formattedMessages = [
      {
        role: "system",
        content: `You are an AI assistant helping with GitHub issues. 
Current issue: "${issueTitle}"
Issue content: ${issueContent}
Solution: ${solution}
Related files: ${relatedFiles.join(", ")}

Your task is to help the user understand the solution and answer any questions they have about the issue.
Use the context provided to give accurate and helpful answers.
Be concise, technical, and specific in your responses.`
      }
    ];

    previousMessages.forEach(msg => {
      formattedMessages.push({
        role: msg.role,
        content: msg.content
      });
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