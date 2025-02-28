export default async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }
  
    try {
      const { searchQuery } = req.body;
      if (!searchQuery) {
        return res.status(400).json({ error: "Search query is required" });
      }
  
      // Implement search logic, e.g., filtering from stored issues
      res.status(200).json({ issues: [] }); // Placeholder for actual implementation
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  