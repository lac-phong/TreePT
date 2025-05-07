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
    return Response.json({
      solution: data.solution,
      related_files: data.related_files || []
    });
  } catch (error) {
    console.error("Error generating solution:", error);
    return Response.json(
      { error: error.message || "Failed to generate solution" },
      { status: 500 }
    );
  }
} 


// mock code to show node graph
/* 
export async function POST(request) {
  try {
    const mockResponse = {
      solution: "This is a mocked solution.",
      related_files: [
        "pages/index.tsx",
        "components/Navbar.tsx",
        "components/Footer.tsx",
        "utils/helpers.ts",
        "api/route.js"
      ]
    };
    return Response.json(mockResponse);
  } catch (error) {
    return Response.json({ error: "Mock failed" }, { status: 500 });
  }
}
*/