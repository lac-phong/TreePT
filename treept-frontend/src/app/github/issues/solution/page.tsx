"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import * as d3 from "d3";
import { Send } from "lucide-react";

type TreeNode = {
  name: string;
  children: TreeNode[];
  type: "file" | "folder";
  path: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function Solution() {
    const [issueTitle, setIssueTitle] = useState("");
    const [issueContent, setIssueContent] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGeneratingSolution, setIsGeneratingSolution] = useState(false);
    const [solution, setSolution] = useState("");
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [isRepoAnalysisComplete, setIsRepoAnalysisComplete] = useState(false);
    const [isCheckingAnalysis, setIsCheckingAnalysis] = useState(false);
    const [relatedFiles, setRelatedFiles] = useState<string[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [currentMessage, setCurrentMessage] = useState("");
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const searchParams = useSearchParams();
    const svgContainerRef = useRef<HTMLDivElement | null>(null);
    const chatEndRef = useRef<HTMLDivElement | null>(null);

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
            checkRepoAnalysisStatus(repoUrlParam);
        } else {
            setError(true);
            setErrorMessage("Invalid Github URL");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // Effect to generate solution once issue content is loaded
    useEffect(() => {
        if (issueTitle && issueContent && isRepoAnalysisComplete) {
            generateSolution();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [issueTitle, issueContent, isRepoAnalysisComplete]);

    useEffect(() => {
      if (relatedFiles.length > 0) {
        const treeData = buildTreeFromPaths(relatedFiles);
        renderTreeDiagram(treeData);
      }
    }, [relatedFiles]);
    
    useEffect(() => {
      if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, [chatMessages]);
    
    useEffect(() => {
      if (solution && chatMessages.length === 0) {
        setChatMessages([
          { 
            role: "assistant", 
            content: "Hello! I'm your AI assistant to help with this issue. I've analyzed the problem and generated a solution. Feel free to ask me any questions about it!" 
          }
        ]);
      }
    }, [solution, chatMessages.length]);
  
    const getIssue = async (repoUrl: string, issue: number) => {
        setIsAnalyzing(true);
        clearErrors();
        
        try {
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
    
    const handleSendMessage = async () => {
      if (!currentMessage.trim()) return;
      
      const userMessage = { role: "user", content: currentMessage };
      const updatedMessages = [...chatMessages, userMessage];
      setChatMessages(updatedMessages);
      setCurrentMessage("");
      setIsSendingMessage(true);
      
      try {
        const context = {
          issueTitle,
          issueContent,
          solution,
          relatedFiles,
          previousMessages: updatedMessages
        };
        
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: currentMessage,
            context
          }),
        });
        
        const data = await response.json();
        
        if (data.error) {
          setError(true);
          setErrorMessage(`Error with chat: ${data.error}`);
        } else {
          setChatMessages([...updatedMessages, { role: "assistant", content: data.response }]);
        }
      } catch (error) {
        console.error("Error sending chat message:", error);
        setError(true);
        setErrorMessage("Failed to get response from assistant");
      }
      
      setIsSendingMessage(false);
    };
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    };
        
    // Function to check repository analysis status
    const checkRepoAnalysisStatus = async (repoUrl: string) => {
        setIsCheckingAnalysis(true);
        
        try {
            const response = await fetch(`/api/check_analysis_status?repoUrl=${encodeURIComponent(repoUrl)}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
            });
            
            if (!response.ok) {
                throw new Error("Failed to check analysis status");
            }
            
            const data = await response.json();
            setIsRepoAnalysisComplete(data.analysisComplete);
            
            // If analysis is not complete, check again in 5 seconds
            if (!data.analysisComplete) {
                setTimeout(() => checkRepoAnalysisStatus(repoUrl), 5000);
            }
        } catch (error) {
            console.error("Error checking repository analysis status:", error);
            // Don't show error to user, just set status to false
            setIsRepoAnalysisComplete(false);
        } finally {
            setIsCheckingAnalysis(false);
        }
    };

    return (
      <div className="flex flex-col items-center justify-start pt-6 space-y-6 bg-white">
        {error && (
          <div className="w-full max-w-7xl bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
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
    
        <div className="w-full max-w-7xl flex justify-between items-center">
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
    
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 w-full max-w-7xl">
          {/* LEFT COLUMN: Issue + Graph */}
          <div className="flex flex-col gap-6">
            <Card className="shadow-md rounded-2xl border border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-800">
                  {issueTitle || (isAnalyzing ? "Loading title..." : "No title found.")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="min-h-[24rem] bg-muted rounded-xl p-4 overflow-y-auto border border-gray-100">
                  {issueContent ? (
                    <p className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">{issueContent}</p>
                  ) : (
                    <p className="text-gray-500">{isAnalyzing ? "Loading content..." : "No content found."}</p>
                  )}
                </div>
              </CardContent>
            </Card>
    
            {relatedFiles.length > 0 && (
              <Card className="shadow-md rounded-2xl border border-gray-200">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-800">
                    Related Files Graph
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    ref={svgContainerRef}
                    className="overflow-auto max-h-[500px] bg-gray-50 border rounded-lg shadow-inner"
                  />
                </CardContent>
              </Card>
            )}
          </div>
    
          {/* RIGHT COLUMN: Solution + Chat */}
          <div className="flex flex-col gap-6">
            <Card className="shadow-md rounded-2xl border border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-800">
                  AI-Generated Solution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="min-h-[24rem] bg-muted rounded-xl p-4 overflow-y-auto border border-gray-100">
                  {solution ? (
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-800">
                      {solution}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      {isGeneratingSolution ? (
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700 mx-auto mb-2" />
                          <p className="text-gray-500">Generating solution...</p>
                        </div>
                      ) : !isRepoAnalysisComplete ? (
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mx-auto mb-2"></div>
                            <p className="text-gray-500">Analyzing repository structure...</p>
                            <p className="text-gray-400 text-sm mt-2">This may take a few minutes for large repositories.</p>
                          </div>
                        ) : (
                          <p className="text-gray-500">No solution generated yet.</p>
                        )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
    
            <Card className="shadow-md rounded-2xl border border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-800">
                  Chat with AI Assistant
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col space-y-4">
                  <ScrollArea className="h-96 pr-4">
                    {chatMessages.length === 0 && !solution ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500">Chat will be available once a solution is generated.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col space-y-4">
                        {chatMessages.map((message, index) => (
                          <div
                            key={index}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[75%] px-4 py-3 rounded-2xl shadow-sm transition-all text-sm leading-relaxed break-words
                                ${message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}
                            >
                              {message.content}
                            </div>
                          </div>
                        ))}
                        <div ref={chatEndRef} />
                      </div>
                    )}
                  </ScrollArea>
    
                  <div className="flex items-end space-x-2">
                    <div className="flex-grow">
                      <Textarea
                        value={currentMessage}
                        onChange={(e) => setCurrentMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask a question about the solution..."
                        disabled={!solution || isSendingMessage}
                        className="min-h-[80px] resize-none"
                      />
                    </div>
                    <Button
                      onClick={handleSendMessage}
                      disabled={!solution || !currentMessage.trim() || isSendingMessage}
                      className="mb-1"
                    >
                      {isSendingMessage ? (
                        <div className="animate-spin h-5 w-5 border-b-2 border-white rounded-full" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );    
}