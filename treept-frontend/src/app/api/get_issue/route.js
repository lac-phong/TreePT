export async function POST(request) {
    try {
      const body = await request.json();
      const { repoUrl, perPage = 10, searchTerm } = body;
      let { page = 1 } = body;
  
      if (!repoUrl || !repoUrl.startsWith("https://github.com/")) {
        return Response.json(
          { error: "Invalid GitHub URL" },
          { status: 400 }
        );
      }
  
      const repoPath = repoUrl.replace("https://github.com/", "");
      const searchQuery = searchTerm 
        ? `repo:${repoPath}+is:issue+is:open+${encodeURIComponent(searchTerm)}+in:title` 
        : `repo:${repoPath}+is:issue+is:open`;
  
      const response = await fetch(`https://api.github.com/search/issues?q=${searchQuery}&per_page=${perPage}&page=${page}`, {
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "GitHub-Issues-Fetcher"
        }
      });
  
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }
  
      const searchData = await response.json();
      const issues = searchData.items;
      const totalCount = searchData.total_count;
  
      return Response.json({ 
        issues: issues,
        totalCount: totalCount,
        page: page,
        perPage: perPage,
        totalPages: Math.ceil(totalCount / perPage)
      });
    } catch (error) {
      console.error(error);
      return Response.json(
        { error: "Invalid URL or GitHub API error" },
        { status: 500 }
      );
    }
  }