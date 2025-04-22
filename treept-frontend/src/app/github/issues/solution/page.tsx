"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function Solution() {
    const [issueTitle, setIssueTitle] = useState("");
    const [issueContent, setIssueContent] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGeneratingSolution, setIsGeneratingSolution] = useState(false);
    const [solution, setSolution] = useState("");
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    
    const searchParams = useSearchParams();
    const clearErrors = () => {
        setError(false);
        setErrorMessage("");
    };
    
    useEffect(() => {
        if (!searchParams) {
            setError(true);
            setErrorMessage("Unable to access URL parameters");
            return;
        }

        const repoUrlParam = searchParams.get("repoUrl");
        const issueNumParam = Number(searchParams.get("issue"));

        if (repoUrlParam && !isNaN(issueNumParam)) {
            getIssue(repoUrlParam, issueNumParam);
        } else {
            setError(true);
            setErrorMessage("Invalid Github URL");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // Effect to generate solution once issue content is loaded
    useEffect(() => {
        if (issueTitle && issueContent) {
            generateSolution();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [issueTitle, issueContent]);

    const getIssue = async (repoUrl: string, issue: number) => {
        setIsAnalyzing(true);
        clearErrors();
        
        try {
            // Encode parameters in the URL
            const queryParams = new URLSearchParams({
            repoUrl: repoUrl,
            issue: issue.toString()
          });
          const response = await fetch(`/api/get_issue?${queryParams.toString()}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });
          const data = await response.json();
          if (data.error) {
            setError(true);
            setErrorMessage(data.error);
          } else {
            setIssueTitle(data.issue.title);
            setIssueContent(data.issue.body_text);
          }
        } catch (error) {
          console.error("Error fetching issues:", error);
          setError(true);
          setErrorMessage("Failed to fetch issues");
        }
        setIsAnalyzing(false);
    };
    
    const generateSolution = async () => {
        if (!issueTitle || !issueContent) return;
        
        const repoUrl = searchParams?.get("repoUrl") || "";
        if (!repoUrl) return;
        
        setIsGeneratingSolution(true);
        try {
            const response = await fetch("/api/generate_solution", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: issueTitle,
                    content: issueContent,
                    repoUrl: repoUrl
                }),
            });
            
            const data = await response.json();
            if (data.error) {
                setError(true);
                setErrorMessage(`Error generating solution: ${data.error}`);
            } else {
                setSolution(data.solution);
            }
        } catch (error) {
            console.error("Error generating solution:", error);
            setError(true);
            setErrorMessage("Failed to generate solution");
        }
        setIsGeneratingSolution(false);
    };

    return (
        <div className="flex flex-col items-center justify-start pt-4 space-y-4">
          
          {/* analyzes github repo to show the issues */}
    
          {/* Error message with dismiss button */}
          {error && (
            <div className="w-full max-w-lg bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-2">
              <span className="block sm:inline">{errorMessage}</span>
              <button 
                onClick={clearErrors}
                className="absolute top-0 bottom-0 right-0 px-4 py-3"
                aria-label="Close"
              >
                <span className="text-xl">&times;</span>
              </button>
            </div>
          )}
          <div className="w-full max-w-5xl flex justify-between items-center">
            <Button asChild className="self-start">
            <Link 
                href={{
                pathname: "/github/issues",
                query: {
                    repoUrl: searchParams.get("repoUrl"),
                    searchQuery: searchParams.get("searchQuery"),
                    page: searchParams.get("page")
                }
                }} 
                className="bg-green-500 text-white hover:bg-green-600"
            >
                Back
            </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
            <div>
              <Card>
                <CardHeader>
                    {issueTitle ? (
                        <CardTitle>{issueTitle}</CardTitle>
                        ) : (
                        <CardTitle>
                            {isAnalyzing ? "Loading title..." : "No title found."}
                        </CardTitle>
                    )}
                </CardHeader>
                <CardContent>
                  <div className="h-96 bg-gray-100 rounded-lg overflow-y-auto p-4">
                  {issueContent ? (
                    <p className="whitespace-pre-wrap">
                        {issueContent}
                    </p>
                    ) : (
                    <p className="text-gray-500">
                        {isAnalyzing ? "Loading content..." : "No content found."}
                    </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>AI-Generated Solution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-96 bg-gray-100 rounded-lg overflow-y-auto p-4">
                    {solution ? (
                      <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                        {solution}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        {isGeneratingSolution ? (
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700 mx-auto mb-2"></div>
                            <p className="text-gray-500">Generating solution...</p>
                          </div>
                        ) : (
                          <p className="text-gray-500">No solution generated yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
    );
}