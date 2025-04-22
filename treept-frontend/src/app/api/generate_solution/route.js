export async function POST(request) {
  try {
    const body = await request.json();
    const { title, content, repoUrl } = body;

    // Validate inputs
    if (!title || !content || !repoUrl) {
      return Response.json(
        { error: "Missing required fields: title, content, or repoUrl" },
        { status: 400 }
      );
    }

    // Call the FastAPI microservice
    const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
    const response = await fetch(`${fastApiUrl}/generate-solution`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        content,
        repo_url: repoUrl
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to generate solution');
    }

    const data = await response.json();
    return Response.json({ solution: data.solution });
  } catch (error) {
    console.error("Error generating solution:", error);
    return Response.json(
      { error: error.message || "Failed to generate solution" },
      { status: 500 }
    );
  }
} 