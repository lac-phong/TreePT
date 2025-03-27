"use client";

interface RepoItem {
  path: string;
  type: string;
}

interface RepoData {
  tree: RepoItem[];
}

interface TreeNode {
  name: string;
  children: TreeNode[];
  type: 'file' | 'folder';
  path: string;
  fileType?: 'page' | 'api' | 'component' | 'code' | 'other';
}

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
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import * as d3 from 'd3';

export default function Issues() {
  const [repoUrl, setRepoUrl] = useState("");
  const [repoData, setRepoData] = useState<TreeNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [inputValue, setInputValue] = useState(searchQuery);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [issues, setIssues] = useState<{ number: number; title: string; html_url: string }[]>([]);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTotal, setSearchTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const svgContainerRef = useRef<HTMLDivElement | null>(null);

  const searchParams = useSearchParams();

  const clearErrors = () => {
    setError(false);
    setErrorMessage("");
  };

  const handleError = (message: string) => {
    setError(true);
    setErrorMessage(message);
  };

  useEffect(() => {
    if (repoUrl) {
      fetchRepoData();
    }
  }, [repoUrl]);

  useEffect(() => {
    if (!searchParams) {
      handleError("Unable to access URL parameters");
      return;
    }

    const repoUrlParam = searchParams.get("repoUrl");
    const queryParam = searchParams.get("searchQuery");
    const pageParam = searchParams.get("page");

    if (repoUrlParam) {
      setRepoUrl(repoUrlParam);
      setSearchQuery(queryParam !== null && queryParam !== undefined ? queryParam : "");
      setInputValue(queryParam !== null && queryParam !== undefined ? queryParam : "");
      setCurrentPage(pageParam ? parseInt(pageParam) : 1);
    } else {
      handleError("Invalid Github URL");
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    // This will run whenever repoUrl changes
    if (repoUrl) {
      searchIssues(currentPage, searchQuery);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoUrl, searchQuery, currentPage]);

  // Refresh the diagram when the window resizes
  useEffect(() => {
    const handleResize = () => {
      if (repoData) {
        renderTreeDiagram(repoData);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [repoData]);

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
      if (data.error) {
        handleError(data.error);
      } else {
        setSearchTotal(data.totalPages);
        setIssues(data.issues);
      }
    } catch (error) {
      console.error("Error fetching issues:", error);
      handleError("Failed to fetch issues");
    }
    setIsAnalyzing(false);
  };


  const handlePageChange = (page: number, searchTerm: string) => {
    // Only update if values are actually different
    if (page !== currentPage) {
      setCurrentPage(page);
    }
    // Only search if term is different or explicit search requested
    if (searchTerm !== searchQuery) {
      setSearchQuery(searchTerm);
    }
  };

  // Generate pagination items dynamically
  const renderPaginationItems = (totalPages: number, searchTerm: string) => {
    const items = [];
    const maxPagesToShow = 5; // Maximum number of page numbers to show
    
    // Add Previous button
    items.push(
      <PaginationItem key="prev">
        <PaginationPrevious 
          onClick={() => {
            if (currentPage > 1) {
              setCurrentPage(currentPage - 1)
              handlePageChange(currentPage - 1, searchTerm)
            }
          }}
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
              onClick={() => {
                setCurrentPage(i)
                handlePageChange(i, searchTerm) 
              }}
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
            onClick={() => {
              setCurrentPage(1)
              handlePageChange(1, searchTerm) 
            }}
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
                onClick={() => {
                  setCurrentPage(page)
                  handlePageChange(page, searchTerm) 
                }}
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
                onClick={() => {
                  setCurrentPage(page)
                  handlePageChange(page, searchTerm) 
                }}
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
                onClick={() => {
                  setCurrentPage(page)
                  handlePageChange(page, searchTerm) 
                }}
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
            onClick={() => {
              setCurrentPage(totalPages)
              handlePageChange(totalPages, searchTerm) 
            }}
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

  const fetchRepoData = async () => {
    setIsAnalyzing(true);
    
    try {
      const response = await fetch(`/api/get_repo?repoUrl=${encodeURIComponent(repoUrl)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        const processedData = processRepoData(data.structure);
        setRepoData(processedData);
        renderTreeDiagram(processedData);
      }
    } catch (error) {
      console.error("Error fetching repository structure:", error);
      handleError("Failed to fetch repository structure");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Process repository data into a hierarchical structure
  const processRepoData = (data: RepoData): TreeNode => {
    const root: TreeNode = { 
      name: 'root', 
      children: [], 
      type: 'folder',
      path: '' 
    };
    
    // Filter out excluded files and directories
    const filteredPaths = data.tree
      .filter(item => {
        const path = item.path;
        return !path.includes('node_modules') && 
              !path.startsWith('.next') && 
              !path.endsWith('.json') && 
              !path.endsWith('README.md') && 
              !path.endsWith('.gitignore') && 
              !path.endsWith('.env') &&
              !path.includes('config');
      });
    
    // Build tree structure
    filteredPaths.forEach(item => {
      const parts = item.path.split('/');
      let currentNode = root;
      
      parts.forEach((part, index) => {
        // Check if we're at the final part (file) or an intermediate part (folder)
        const isFile = index === parts.length - 1 && item.type === 'blob';
        
        // Find existing node or create new one
        let foundNode = currentNode.children.find(node => node.name === part);
        
        if (!foundNode) {
          const newNode: TreeNode = { 
            name: part,
            children: [],
            type: isFile ? 'file' : 'folder',  // These are now literal types matching the interface
            path: parts.slice(0, index + 1).join('/')
          };
          
          // Categorize file types for Next.js projects
          if (isFile) {
            if (part.endsWith('.js') || part.endsWith('.jsx') || part.endsWith('.ts') || part.endsWith('.tsx')) {
              const path = parts.join('/');
              
              if (path.includes('/pages/') || path.includes('/app/') && (part.startsWith('page.') || part.includes('layout.'))) {
                newNode.fileType = 'page';
              } else if (path.includes('/api/') || path.includes('route.')) {
                newNode.fileType = 'api';
              } else if (path.includes('/components/') || /[A-Z]/.test(part[0])) {
                newNode.fileType = 'component';
              } else {
                newNode.fileType = 'code';
              }
            } else {
              newNode.fileType = 'other';
            }
          }
          
          currentNode.children.push(newNode);
          foundNode = newNode;
        }
        
        if (!isFile) {
          currentNode = foundNode;
        }
      });
    });
    return root;
  };

  const renderTreeDiagram = (data: TreeNode): void => {
    if (!data || !svgContainerRef.current) {
      console.log(svgContainerRef.current)
      return;
    } 

    console.log("Render tree diagram called with data:", data);
    console.log("SVG container ref exists:", !!svgContainerRef.current);

    // Clear previous content
    while (svgContainerRef.current.firstChild) {
      svgContainerRef.current.removeChild(svgContainerRef.current.firstChild);
    }

    setTimeout(() => {
      const width = svgContainerRef.current ? svgContainerRef.current.clientWidth : 0;
      const height = 600;
      const margin = { top: 20, right: 30, bottom: 20, left: 120 };
      
      // Create SVG container
      const svg = d3.select(svgContainerRef.current)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
      
      // Create hierarchical layout
      const root = d3.hierarchy(data) as d3.HierarchyNode<TreeNode>;
      
      const treeLayout = d3.tree<TreeNode>()
      .size([height - margin.top - margin.bottom, width - margin.left - margin.right - 100])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2));
      
      // Compute the new tree layout
      const treeData = treeLayout(root);
      
      // Add links between nodes
      svg.selectAll('.link')
        .data(treeData.links())
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('d', d => {
          return `M${d.source.y},${d.source.x}
                  C${(d.source.y + d.target.y) / 2},${d.source.x}
                  ${(d.source.y + d.target.y) / 2},${d.target.x}
                  ${d.target.y},${d.target.x}`;
        })
        .attr('fill', 'none')
        .attr('stroke', '#ccc')
        .attr('stroke-width', 1.5);
      
      // Add nodes
      const nodes = svg.selectAll('.node')
        .data(treeData.descendants())
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', d => `translate(${d.y},${d.x})`);
      
      // Determine node color based on type
      const getNodeColor = (d: d3.HierarchyPointNode<any>): string => {
        const nodeData = d.data as TreeNode;
        if (nodeData.type === 'folder') return '#90caf9'; // Folder color (blue)
        
        // File colors based on type
        switch (nodeData.fileType) {
          case 'page': return '#81c784'; // Page files (green)
          case 'api': return '#ffb74d'; // API/Route files (orange)
          case 'component': return '#ce93d8'; // Component files (purple)
          case 'code': return '#e57373'; // Other code files (red)
          default: return '#e0e0e0'; // Other files (grey)
        }
      };
      
      // Add circles for nodes
      nodes.append('circle')
        .attr('r', 6)
        .attr('fill', getNodeColor);
      
      // Add icons (simplified for client component)
      nodes.append('text')
        .attr('dy', 3)
        .attr('x', -8)
        .attr('text-anchor', 'end')
        .attr('font-family', 'FontAwesome')
        .text(d => {
          const nodeData = d.data as TreeNode;
          if (nodeData.type === 'folder') return '\uf07b'; // folder icon
          if (nodeData.fileType === 'page') return '\uf15c'; // page icon
          if (nodeData.fileType === 'api') return '\uf0ac'; // api icon
          if (nodeData.fileType === 'component') return '\uf121'; // component icon
          return '\uf15b'; // default file icon
        })
        .attr('font-size', '10px')
        .attr('fill', '#555');
      
      // Add labels
      nodes.append('text')
        .attr('dy', '0.31em')
        .attr('x', d => d.children ? -12 : 12)
        .attr('text-anchor', d => d.children ? 'end' : 'start')
        .text(d => (d.data as TreeNode).name)
        .style('font-size', '12px')
        .style('fill', '#333');
    }, 100);
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
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                <Button
                  onClick={() => {
                    if (inputValue !== searchQuery) {
                      setSearchQuery(inputValue);
                      setCurrentPage(1); // Reset to page 1 on new search
                    }
                  }}
                  className="bg-green-500 text-white hover:bg-green-600"
                >
                  {isAnalyzing ? "Searching..." : "Search"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="overflow-y-auto max-h-[600px] flex flex-col gap-2">
            {issues.length > 0 ? (
              issues.map((issue: { 
                number: number | null | undefined; 
                html_url: string | undefined; 
                title: string ; 
              }) => {
                return ( 
                  <Button key={issue.number} asChild className="w-full px-4 py-6 bg-white-600 text-green-600 hover:underline text-left h-auto justify-start">
                      <Link href={{
                          pathname: "/github/issues/solution",
                          query: {
                              repoUrl: repoUrl,
                              issue: issue.number,
                              searchQuery: searchQuery,
                              page: currentPage
                          }}} 
                          className="text-left w-full"
                          >{issue.title}</Link>
                  </Button>
                )
              })
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
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Repository Structure</CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="p-4 mb-4 bg-red-100 text-red-700 rounded">
                  Error: {error}
                </div>
              )}
              
              {isAnalyzing ? (
                <div className="flex justify-center items-center h-96">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                      <span className="text-xs">Folder</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                      <span className="text-xs">Page</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                      <span className="text-xs">API/Route</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-400"></div>
                      <span className="text-xs">Component</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <span className="text-xs">Other Code</span>
                    </div>
                  </div>
                  <div 
                    ref={svgContainerRef} 
                    className="overflow-auto h-96 border rounded"
                  ></div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
