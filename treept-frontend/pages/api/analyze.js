export default async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }
  
    try {
      const { repoUrl } = req.body;
      if (!repoUrl || !repoUrl.startsWith("https://github.com/")) {
        return res.status(400).json({ error: "Invalid GitHub URL" });
      }
  
      const repoPath = repoUrl.replace("https://github.com/", "");
      const response = await fetch(`https://api.github.com/repos/${repoPath}/issues`);
      if (!response.ok) {
        throw new Error("GitHub API error");
      }
  
      const issues = await response.json();
      res.status(200).json({ issues });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  