export default async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { repoUrl } = req.body;
    if (!repoUrl || !repoUrl.startsWith("https://github.com/")) {
      return res.status(400).json({ error: "Invalid GitHub URL" });
    }

    const repoPath = repoUrl.replace("https://github.com/", "");
    const response = await fetch(`https://api.github.com/repos/${repoPath}/issues?state=open&per_page=100`, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "GitHub-Issues-Fetcher"
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const issues = await response.json();

    const filteredIssues = issues.filter(issue => !issue.pull_request);

    res.status(200).json({ issues: filteredIssues });
  } catch (error) {
    res.status(500).json({ error: "invalid url" });
  }
}
