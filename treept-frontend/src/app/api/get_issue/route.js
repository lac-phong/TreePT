export async function GET(request) {
    try {
    const { searchParams } = new URL(request.url);
    const repoUrl = searchParams.get('repoUrl');
    const issue = searchParams.get('issue');
  
      if (!repoUrl || !repoUrl.startsWith("https://github.com/")) {
        return Response.json(
          { error: "Invalid GitHub URL" },
          { status: 400 }
        );
      }
  
      const repoPath = repoUrl.replace("https://github.com/", "");
  
      const response = await fetch(`https://api.github.com/repos/${repoPath}/issues/${issue}`, {
        headers: {
          "Accept": "application/vnd.github.text+json"
        }
      });
  
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }
  
      const issue_data = await response.json();
  
      return Response.json({ 
        issue: issue_data
      });
    } catch (error) {
      console.error(error);
      return Response.json(
        { error: "Invalid URL or GitHub API error" },
        { status: 500 }
      );
    }
  }