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
import { Key, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Issues() {
  const [repoUrl, setRepoUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [issues, setIssues] = useState<{ id: number; title: string; html_url: string }[]>([]);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTotal, setSearchTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams) {
      setError(true);
      setErrorMessage("Unable to access URL parameters");
      return;
    }

    const repoUrlParam = searchParams.get("repoUrl");
    if (repoUrlParam) {
      setRepoUrl(repoUrlParam);
    } else {
      setError(true);
      setErrorMessage("Invalid Github URL");
    }
    
    setCurrentPage(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // This will run whenever repoUrl changes
    if (repoUrl) {
      handlePageChange(currentPage, "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoUrl]);

  const clearErrors = () => {
    setError(false);
    setErrorMessage("");
  };

  const searchIssues = async (pageNumber: number, searchTerm: string) => {
    setIsAnalyzing(true);
    setCurrentPage(pageNumber);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          repoUrl,
          searchTerm,
          page: pageNumber,
        }),
      });
      const data = await response.json();
      console.log(data)
      if (data.error) {
        setError(true);
        setErrorMessage(data.error);
      } else {
        setSearchTotal(data.totalPages);
        setIssues(data.issues);
      }
    } catch (error) {
      console.error("Error fetching issues:", error);
      setError(true);
      setErrorMessage("Failed to fetch issues");
    }
    setIsAnalyzing(false);
  };


  const handlePageChange = (page: number, searchTerm: string) => {
    setCurrentPage(page);
    searchIssues(page, searchTerm);
  };

  // Generate pagination items dynamically
  const renderPaginationItems = (totalPages: number, searchTerm: string) => {
    const items = [];
    const maxPagesToShow = 5; // Maximum number of page numbers to show
    
    // Add Previous button
    items.push(
      <PaginationItem key="prev">
        <PaginationPrevious 
          onClick={() => currentPage > 1 && handlePageChange(currentPage - 1, searchTerm)}
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
              onClick={() => handlePageChange(i, searchTerm)}
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
            onClick={() => handlePageChange(1, searchTerm)}
            className="cursor-pointer"
          >
            1
          </PaginationLink>
        </PaginationItem>
      );

      // Determine range to show based on current page
      let startPage: number, endPage: number;
      
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
                onClick={() => handlePageChange(page, searchTerm)}
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
                onClick={() => handlePageChange(page, searchTerm)}
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
                onClick={() => handlePageChange(page, searchTerm)}
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
            onClick={() => handlePageChange(totalPages, searchTerm)}
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
        onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1, searchTerm)}
        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
      />
    </PaginationItem>
  );

  return items;
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
        <div className="md:col-span-2 flex flex-col gap-4">
          <Button asChild>
            <Link href={{
                    pathname: "/github"
                  }} 
                    className="bg-green-500 text-white hover:bg-green-600" >New Repository</Link>
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
                <Button
                  onClick={(e) => searchIssues(1, searchQuery)}
                  className="bg-green-500 text-white hover:bg-green-600"
                >
                  {isAnalyzing ? "Searching..." : "Search"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="overflow-y-auto max-h-[600px]">
            {issues.length > 0 ? (
              issues.map((issue: { 
                id: Key | null | undefined; 
                html_url: string | undefined; 
                title: string ; 
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
          
          {searchTotal > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                {renderPaginationItems(searchTotal, searchQuery)}
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
    </div>
  );
}
