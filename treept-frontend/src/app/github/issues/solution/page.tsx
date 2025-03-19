"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function Solution() {
    const [issueTitle, setIssueTitle] = useState("");
    const [issueContent, setIssueContent] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
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

    const getIssue = async (repoUrl: string, issue: number) => {
        setIsAnalyzing(true);
        clearErrors;
        
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
                  <CardTitle>Solution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-96 bg-gray-100 flex items-center justify-center rounded-lg">
                    <p className="text-gray-500">Solution coming soon...</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
    );
}