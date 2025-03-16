export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { repoUrl, perPage = 10 } = req.body;
    let { page = 1 } = req.body;
    if (!repoUrl || !repoUrl.startsWith("https://github.com/")) {
      return res.status(400).json({ error: "Invalid GitHub URL" });
    }

    const repoPath = repoUrl.replace("https://github.com/", "");
    const countResponse = await fetch(`https://api.github.com/search/issues?q=repo:${repoPath}+is:issue+is:open&per_page=1`, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "GitHub-Issues-Fetcher"
      }
    });

    if (!countResponse.ok) {
      throw new Error(`GitHub API error: ${countResponse.statusText}`);
    }

    const countData = await countResponse.json();
    const totalCount = countData.total_count;

    const response = await fetch(`https://api.github.com/repos/${repoPath}/issues?state=open&per_page=${perPage}&page=${page}`, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "GitHub-Issues-Fetcher"
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const issues = await response.json();

    // Exclude pull requests
    const filteredIssues = issues.filter(issue => !issue.pull_request);

    res.status(200).json({ 
      issues: filteredIssues,
      totalCount: totalCount,
      page: page,
      perPage: perPage,
      totalPages: Math.ceil(totalCount / perPage)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Invalid URL or GitHub API error" });
  }
}
