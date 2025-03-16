"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Issues() {
  const [repoUrl, setRepoUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [issues, setIssues] = useState<{ id: number; title: string; html_url: string }[]>([]);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [error, setError] = useState<string>("");
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1); // Reset page when issues change
  }, [issues]);

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
        body: JSON.stringify({ 
          repoUrl,
          page: 1,
        }),
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setIssues(data.issues);
        setTotalPages(data.totalPages);
        setIsAnalyzed(true);
      }
    } catch (error) {
      console.error("Error analyzing repository:", error);
      setError("use client");
    }
    setIsAnalyzing(false);
  };


  const fetchPageIssues = async (pageNumber: number) => {
    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          repoUrl,
          page: pageNumber,
        }),
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setIssues(data.issues);
      }
    } catch (error) {
      console.error("Error fetching issues:", error);
      setError("Failed to fetch issues");
    }
    setIsAnalyzing(false);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchPageIssues(page);
  };

  const handleNewRepo = () => {
    setRepoUrl("");
    setIssues([]);
    setIsAnalyzed(false);
    setError(""); 
  };

  // Generate pagination items dynamically
  const renderPaginationItems = () => {
    const items = [];
    const maxPagesToShow = 5; // Maximum number of page numbers to show
    
    // Add Previous button
    items.push(
      <PaginationItem key="prev">
        <PaginationPrevious 
          onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
        />
      </PaginationItem>
    );

    // Logic for showing page numbers with ellipsis
    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is less than max to show
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink 
              isActive={currentPage === i}
              onClick={() => handlePageChange(i)}
              className="cursor-pointer"
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      // Always show first page
      items.push(
        <PaginationItem key={1}>
          <PaginationLink 
            isActive={currentPage === 1}
            onClick={() => handlePageChange(1)}
            className="cursor-pointer"
          >
            1
          </PaginationLink>
        </PaginationItem>
      );

      // Determine range to show based on current page
      let startPage: number, endPage;
      
      if (currentPage <= 3) {
        // Near the beginning
        startPage = 2;
        endPage = 4;
        
        items.push(...Array.from({length: endPage - startPage + 1}, (_, i) => {
          const page = startPage + i;
          return (
            <PaginationItem key={page}>
              <PaginationLink 
                isActive={currentPage === page}
                onClick={() => handlePageChange(page)}
                className="cursor-pointer"
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          );
        }));
        
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
      } else if (currentPage >= totalPages - 2) {
        // Near the end
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
        
        startPage = totalPages - 3;
        endPage = totalPages - 1;
        
        items.push(...Array.from({length: endPage - startPage + 1}, (_, i) => {
          const page = startPage + i;
          return (
            <PaginationItem key={page}>
              <PaginationLink 
                isActive={currentPage === page}
                onClick={() => handlePageChange(page)}
                className="cursor-pointer"
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          );
        }));
      } else {
        // In the middle
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
        
        startPage = currentPage - 1;
        endPage = currentPage + 1;
        
        items.push(...Array.from({length: endPage - startPage + 1}, (_, i) => {
          const page = startPage + i;
          return (
            <PaginationItem key={page}>
              <PaginationLink 
                isActive={currentPage === page}
                onClick={() => handlePageChange(page)}
                className="cursor-pointer"
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          );
        }));
        
        items.push(
          <PaginationItem key="ellipsis2">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Always show last page
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink 
            isActive={currentPage === totalPages}
            onClick={() => handlePageChange(totalPages)}
            className="cursor-pointer"
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }
  // Add Next button
  items.push(
    <PaginationItem key="next">
      <PaginationNext 
        onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
      />
    </PaginationItem>
  );

  return items;
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

            <div className="overflow-y-auto max-h-[600px]">
              {issues.length > 0 ? (
                issues.map((issue: { 
                  id: Key | null | undefined; 
                  html_url: string | undefined; 
                  title: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; 
                }) => (
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
                <p className="text-gray-500">
                  {isAnalyzing ? "Loading issues..." : "No issues found."}
                </p>
              )}
            </div>
            
            {totalPages > 1 && (
              <Pagination className="mt-4">
                <PaginationContent>
                  {renderPaginationItems()}
                </PaginationContent>
              </Pagination>
            )}

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
