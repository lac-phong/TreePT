"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import * as d3 from "d3";

type TreeNode = {
  name: string;
  children: TreeNode[];
  type: "file" | "folder";
  path: string;
};


export default function Solution() {
    const [issueTitle, setIssueTitle] = useState("");
    const [issueContent, setIssueContent] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGeneratingSolution, setIsGeneratingSolution] = useState(false);
    const [solution, setSolution] = useState("");
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [relatedFiles, setRelatedFiles] = useState<string[]>([]);

    const searchParams = useSearchParams();
    const svgContainerRef = useRef<HTMLDivElement | null>(null);

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

    useEffect(() => {
      if (relatedFiles.length > 0) {
        const treeData = buildTreeFromPaths(relatedFiles);
        renderTreeDiagram(treeData);
      }
    }, [relatedFiles]);
  
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
                setRelatedFiles(data.related_files || []);
            }
        } catch (error) {
            console.error("Error generating solution:", error);
            setError(true);
            setErrorMessage("Failed to generate solution");
        }
        setIsGeneratingSolution(false);
    };

    const buildTreeFromPaths = (paths: string[]): TreeNode => {
      const root: TreeNode = { name: "root", children: [], type: "folder", path: "" };
  
      paths.forEach((path) => {
        const parts = path.split("/");
        let current = root;
  
        parts.forEach((part, i) => {
          const existing = current.children.find((c) => c.name === part);
          if (existing) {
            current = existing;
          } else {
            const newNode: TreeNode = {
              name: part,
              children: [],
              type: i === parts.length - 1 ? "file" : "folder",
              path: parts.slice(0, i + 1).join("/"),
            };
            current.children.push(newNode);
            current = newNode;
          }
        });
      });
  
      return root;
    };
  
    const renderTreeDiagram = (data: TreeNode): void => {
      if (!data || !svgContainerRef.current) return;
  
      const container = svgContainerRef.current;
      const width = container.clientWidth || 1000;
      const height = container.clientHeight || 600;
      const margin = { top: 40, right: 40, bottom: 40, left: 160 };
      const duration = 400;
      let i = 0;
  
      d3.select(container).selectAll("*").remove();
  
      const zoomed = ({ transform }: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr("transform", transform.toString());
      };
  
      const svg = d3
        .select(container)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.25, 4]).on("zoom", zoomed));
  
      const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  
      const root = d3.hierarchy(data) as any;
      root.x0 = 0;
      root.y0 = 0;
  
      update(root);
  
      function update(source: any) {
        const tree = d3.tree<TreeNode>().nodeSize([40, 220]).separation(() => 1.4);
        const treeData = tree(root);
        const nodes = treeData.descendants();
        const links = treeData.links();
  
        nodes.forEach((d: any) => (d.y = d.depth * 220));
  
        const link = g.selectAll("path.link").data(links, (d: any) => d.target.id);
  
        link.enter()
          .append("path")
          .attr("class", "link")
          .attr("fill", "none")
          .attr("stroke", "#ccc")
          .attr("stroke-width", 1.4)
          .merge(link as any)
          .transition()
          .duration(duration)
          .attr("d", (d: any) => {
            return `M${d.source.y},${d.source.x}
                    C${(d.source.y + d.target.y) / 2},${d.source.x}
                    ${(d.source.y + d.target.y) / 2},${d.target.x}
                    ${d.target.y},${d.target.x}`;
          });
  
        link.exit().remove();
  
        const node = g.selectAll("g.node").data(nodes, (d: any) => d.id || (d.id = ++i));
  
        const nodeEnter = node
          .enter()
          .append("g")
          .attr("class", "node")
          .attr("transform", () => `translate(${source.y0},${source.x0})`);
  
        nodeEnter
          .append("circle")
          .attr("r", 6)
          .attr("fill", (d: any) => (d.data.type === "folder" ? "#90caf9" : "#81c784"));
  
        nodeEnter
          .append("text")
          .attr("dy", "0.31em")
          .attr("x", (d: any) => 12)
          .attr("text-anchor", "start")
          .text((d: any) => d.data.name)
          .style("font-size", "12px")
          .style("fill", "#333");
  
        nodeEnter
          .merge(node as any)
          .transition()
          .duration(duration)
          .attr("transform", (d: any) => `translate(${d.y},${d.x})`);
  
        node.exit()
          .transition()
          .duration(duration)
          .attr("transform", () => `translate(${source.y},${source.x})`)
          .remove();
  
        nodes.forEach((d: any) => {
          d.x0 = d.x;
          d.y0 = d.y;
        });
      }
    };

    return (
    <div className="flex flex-col items-center justify-start pt-4 space-y-4">
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
                page: searchParams.get("page"),
              },
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
              <CardTitle>
                {issueTitle
                  ? issueTitle
                  : isAnalyzing
                  ? "Loading title..."
                  : "No title found."}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96 bg-gray-100 rounded-lg overflow-y-auto p-4">
                {issueContent ? (
                  <p className="whitespace-pre-wrap">{issueContent}</p>
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

      {relatedFiles.length > 0 && (
        <Card className="w-full max-w-5xl mt-6">
          <CardHeader>
            <CardTitle>Related Files Graph</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={svgContainerRef}
              className="overflow-auto h-[500px] border rounded"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}