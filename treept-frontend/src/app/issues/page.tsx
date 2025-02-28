"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Issues() {
  const [repoUrl, setRepoUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [issues, setIssues] = useState([]);
  const [isAnalyzed, setIsAnalyzed] = useState(false);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setIsAnalyzed(false);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });
      const data = await response.json();
      setIssues(data.issues);
      setIsAnalyzed(true);
    } catch (error) {
      console.error("Error analyzing repository:", error);
    }
    setIsAnalyzing(false);
  };

  const handleSearch = async () => {
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchQuery }),
      });
      const data = await response.json();
      setIssues(data.issues);
    } catch (error) {
      console.error("Error searching issues:", error);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <Card>
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

        {isAnalyzed && (
          <Card className="mt-8">
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
                <Button onClick={handleSearch} className="bg-green-500 text-white hover:bg-green-600">
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

       {/* Right side: Context tree visualization (placeholder) */}
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
  );
}
