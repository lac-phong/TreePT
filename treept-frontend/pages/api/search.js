export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { repoUrl, perPage = 10, searchTerm } = req.body;
    let { page = 1 } = req.body;
    if (!repoUrl || !repoUrl.startsWith("https://github.com/")) {
      return res.status(400).json({ error: "Invalid GitHub URL" });
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

    res.status(200).json({ 
      issues: issues,
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
