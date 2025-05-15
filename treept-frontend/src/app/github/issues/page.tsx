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
    if (!data || !svgContainerRef.current) return;
    
    // setup 
    const container = svgContainerRef.current;
    const width  = container.clientWidth  || 1000;
    const height = container.clientHeight || 800;
    const margin = { top: 40, right: 40, bottom: 40, left: 160 };
    const duration = 400;                      
    let i = 0;       
  
    d3.select(container).selectAll("*").remove(); // clears old svg
  

    // pan/zoom
    const zoomed = ({ transform }: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      g.attr("transform", transform.toString());
    };
  
    const svg = d3
    .select(container)
    .append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.25, 4])             
        .on('zoom', zoomed)
    );

    // root g that moves when we pan/zoom
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  
    // builds hierarchy
    const root = d3.hierarchy(data) as any;
    root.x0 = 0;
    root.y0 = 0;
  
    // Collapse everything below depth 2 to declutter the first view
    root.children?.forEach(collapse);
    update(root);                                   
  
    function collapse(d: any) {
      if (d.depth > 1 && d.children) {
        d._children = d.children;
        d._children.forEach(collapse);
        d.children = null;
      } else if (d.children) {
        d.children.forEach(collapse);
      }
    }
  
    // node color key
    function getNodeColor(d: any) {
      const t: TreeNode = d.data;
      if (t.type === "folder") return "#90caf9";
      switch (t.fileType) {
        case "page":      return "#81c784";
        case "api":       return "#ffb74d";
        case "component": return "#ce93d8";
        case "code":      return "#e57373";
        default:          return "#e0e0e0";
      }
    }
  
    // main render/update loop
    function update(source: any) {

      // layout
      const tree = d3.tree<TreeNode>().nodeSize([40, 220]).separation(() => 1.4);   
      const treeData = tree(root);
      const nodes    = treeData.descendants();
      const links    = treeData.links();
  
      // fixed‑depth horizontal spacing (already handled by nodeSize)
      nodes.forEach((d: any) => (d.y = d.depth * 220));
  
      // draw / update edges
      const link = g.selectAll<SVGPathElement, any>("path.link").data(links, (d: any) => d.target.id);
  
      link.enter()
          .append("path")
          .attr("class", "link")
          .attr("fill", "none")
          .attr("stroke", "#ccc")
          .attr("stroke-width", 1.4)
          .merge(link as any)
          .transition()
          .duration(duration)
          .attr("d", linkPath);
  
      link.exit().remove();
  
      // curved connector
      function linkPath(d: any) {
        return `M${d.source.y},${d.source.x}
          C${(d.source.y + d.target.y) / 2},${d.source.x}
          ${(d.source.y + d.target.y) / 2},${d.target.x}
          ${d.target.y},${d.target.x}`;
      }

      // draw/update nodes with labels
      const node = g.selectAll<SVGGElement, any>("g.node").data(nodes, (d: any) => d.id || (d.id = ++i));
    
      // enter: new nodes start at parent's old position 
      const nodeEnter = node.enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", () => `translate(${source.y0},${source.x0})`)
        .on("click", (_, d: any) => {
          if (d.children) {
            d._children = d.children;
            d.children  = null;
          } else {
            d.children  = d._children;
            d._children = null;
          }
          update(d);                          
        });
  
      // circle for the nodes
      nodeEnter.append("circle")
        .attr("r", 6)
        .attr("fill", getNodeColor);
  
      // node labels
      nodeEnter.append("text")
        .attr("dy", "0.31em")
        .attr("x", (d: any) => (d.children || d._children ? -12 : 12))
        .attr("text-anchor", (d: any) => d.children || d._children ? "end" : "start")
        .text((d: any) => d.data.name)
        .style("font-size", "12px")
        .style("fill", "#333");
  
      // update: move nodes to new positions
      const nodeUpdate = nodeEnter
        .merge(node as any)
        .transition()
        .duration(duration)
        .attr("transform", (d: any) => `translate(${d.y},${d.x})`);
  
      // exit: nodes shrink back into parent
      node.exit().transition().duration(duration)
        .attr("transform", () => `translate(${source.y},${source.x})`)
        .remove();

      // saves current pos for next transition
      nodes.forEach((d: any) => { d.x0 = d.x; d.y0 = d.y; });
    }
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
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-8xl">
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
                    className="overflow-auto h-[700px] border rounded"
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
