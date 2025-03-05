"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useState, useEffect } from "react";
import { Input } from "components/ui/input";
import { Button } from "components/ui/button";

export default function Issues() {
  const [repoUrl, setRepoUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [issues, setIssues] = useState<{ id: number; title: string; html_url: string }[]>([]);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [error, setError] = useState<string>("");

  const handleAnalyze = async () => {
    setError("");
    if (!repoUrl) {
      setError("invalid url");
      return;
    }

    const isValidUrl = repoUrl.startsWith("https://github.com/");
    if (!isValidUrl) {
      setError("invalid url");
      return;
    }

    setIsAnalyzing(true);
    setIsAnalyzed(false);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setIssues(data.issues);
        setIsAnalyzed(true);
      }
    } catch (error) {
      console.error("Error analyzing repository:", error);
      setError("use client");
    }
    setIsAnalyzing(false);
  };

  const filteredIssues = issues.filter(issue =>
    issue.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNewRepo = () => {
    setRepoUrl("");
    setIssues([]);
    setIsAnalyzed(false);
    setError(""); 
  };


  return (
    <div className="flex flex-col items-center justify-start pt-4 space-y-4">
      
      {/* analyzes github repo to show the issues */}

      {error && <p className="text-red-500">{error}</p>}
      {!isAnalyzed ? (
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Analyze GitHub Repository</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                type="text"
                placeholder="GitHub repository URL"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
              <Button onClick={handleAnalyze} className="bg-green-500 text-white hover:bg-green-600">
                {isAnalyzing ? "Analyzing..." : "Analyze"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        // Section for searching issues
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
          <div className="md:col-span-2 flex flex-col gap-4">
            <Button onClick={handleNewRepo} className="bg-blue-500 text-white hover:bg-blue-600 w-full">
              New Repository
            </Button>

            <Card>
              <CardHeader>
                <CardTitle>Search Issues</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Input
                    type="text"
                    placeholder="Search issues"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="overflow-y-auto max-h-150">
              {filteredIssues.length > 0 ? (
                filteredIssues.map((issue) => (
                  <Card key={issue.id} className="mt-2">
                    <CardContent>
                      <a
                        href={issue.html_url}
                        target="_blank"
                        className="text-blue-600 hover:underline"
                      >
                        {issue.title}
                      </a>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-gray-500">No issues found.</p>
              )}
            </div>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Context Tree</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96 bg-gray-100 flex items-center justify-center rounded-lg">
                  <p className="text-gray-500">Context tree visualization coming soon...</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
