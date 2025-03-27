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

        const repoPath = repoUrl.replace("https://github.com/", "");
        
        // Fetch repository contents from GitHub API
        let response = await fetch(`https://api.github.com/repos/${repoPath}/git/trees/main?recursive=1`, {
            headers: {
              "Accept": "application/vnd.github.v3+json",
              "User-Agent": "GitHub-Repo-Structure-Analyzer"
            }
          });
        
        if (!response.ok) {
            // Try with master branch if main doesn't exist
            response = await fetch(`https://api.github.com/repos/${repoPath}/git/trees/master?recursive=1`, {
                headers: {
                  "Accept": "application/vnd.github.v3+json",
                  "User-Agent": "GitHub-Repo-Structure-Analyzer"
                }
            });
            if (!response.ok) {
                return Response.json(
                    { error: "Could not retrieve repository structure. Repository might be private or doesn't exist." },
                    { status: 404 }
                  );
            }
        } 
        const data = await response.json();
        return Response.json({ 
            structure: data
        });
    } catch (err) {
        console.error(error);
        return Response.json(
          { error: "Failed to fetch repository structure" },
          { status: 500 }
        );
    }
  }