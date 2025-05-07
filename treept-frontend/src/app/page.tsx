"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const FileNodeGraph = () => {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  const files = [
    { id: 1, name: "index.js", type: "entry", x: 150, y: 80, issues: ["circular"] },
    { id: 2, name: "components/Button.jsx", type: "component", x: 60, y: 160, issues: [] },
    { id: 3, name: "components/Card.jsx", type: "component", x: 180, y: 200, issues: ["unused"] },
    { id: 4, name: "utils/helpers.js", type: "util", x: 260, y: 120, issues: ["deprecated"] },
    { id: 5, name: "context/AppContext.js", type: "context", x: 100, y: 240, issues: [] },
    { id: 6, name: "pages/api/data.js", type: "api", x: 240, y: 220, issues: ["security"] },
  ];

  const edges = [
    { source: 1, target: 2 },
    { source: 1, target: 4 },
    { source: 1, target: 5 },
    { source: 2, target: 4 },
    { source: 5, target: 2 },
    { source: 5, target: 6 },
    { source: 6, target: 4 },
  ];

  const typeColors = {
    entry: "#34D399",
    component: "#60A5FA",
    util: "#F59E0B",
    context: "#8B5CF6",
    api: "#EC4899",
  };

  const issueTypes = {
    circular: { color: "#EF4444", label: "Circular Dependency" },
    unused: { color: "#FB923C", label: "Unused Export" },
    deprecated: { color: "#FBBF24", label: "Uses Deprecated API" },
    security: { color: "#DC2626", label: "Security Concern" },
  };

  const getNodeColor = (type, issues) => {
    return issues.length > 0 ? issueTypes[issues[0]].color : typeColors[type];
  };

  const handleNodeHover = (node) => {
    setHoveredNode(node);
  };

  const handleNodeLeave = () => {
    setHoveredNode(null);
  };

  return (
    <div className={`relative mx-auto my-8 max-w-full h-64 transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <svg width="100%" height="100%" viewBox="0 0 320 280">
        {edges.map((edge) => {
          const source = files.find(f => f.id === edge.source);
          const target = files.find(f => f.id === edge.target);
          
          return (
            <line
              key={`${edge.source}-${edge.target}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={hoveredNode && (hoveredNode.id === source.id || hoveredNode.id === target.id) ? "#475569" : "#94A3B8"}
              strokeWidth={hoveredNode && (hoveredNode.id === source.id || hoveredNode.id === target.id) ? "2" : "1"}
              strokeOpacity={0.7}
            />
          );
        })}
        
        {files.map((file) => (
          <g key={file.id} onMouseEnter={() => handleNodeHover(file)} onMouseLeave={handleNodeLeave}>
            <circle
              cx={file.x}
              cy={file.y}
              r={file.issues.length > 0 ? 12 : 10}
              fill={getNodeColor(file.type, file.issues)}
              stroke={hoveredNode === file ? "#1E293B" : "transparent"}
              strokeWidth="2"
              className="transition-all duration-300"
              opacity={hoveredNode && hoveredNode !== file && !edges.some(
                e => (e.source === file.id && e.target === hoveredNode.id) || 
                     (e.target === file.id && e.source === hoveredNode.id)
              ) ? 0.4 : 1}
            />
            
            {file.issues.length > 0 && (
              <text
                x={file.x}
                y={file.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="12"
                fill="white"
              >
                !
              </text>
            )}
          </g>
        ))}
      </svg>
      
      {hoveredNode && (
        <div 
          className="absolute bg-slate-900 text-white rounded-md px-3 py-2 shadow-lg"
          style={{ 
            top: `${(hoveredNode.y / 280) * 100}%`, 
            left: `${(hoveredNode.x / 320) * 100}%`,
            transform: 'translate(-50%, -130%)'
          }}
        >
          <p className="text-sm font-medium">{hoveredNode.name}</p>
          {hoveredNode.issues.length > 0 && (
            <div className="flex items-center mt-1">
              <span 
                className="w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: issueTypes[hoveredNode.issues[0]].color }}
              ></span>
              <span className="text-xs">{issueTypes[hoveredNode.issues[0]].label}</span>
            </div>
          )}
        </div>
      )}
      
      <div className="absolute bottom-0 right-0 bg-slate-50 dark:bg-slate-900 p-2 rounded-md shadow-sm text-xs">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {Object.entries(typeColors).map(([type, color]) => (
            <div key={type} className="flex items-center">
              <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: color }}></span>
              <span className="capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function Home() {
  const solutionsRef = useRef(null);
  
  useEffect(() => {
    const handleSmoothScroll = (e) => {
      const target = e.target;
      
      if (target.classList.contains("scroll-link")) {
        e.preventDefault();
        const targetId = target.getAttribute("href");
        if (targetId) {
          const targetElement = document.querySelector(targetId);
          
          if (targetElement) {
            window.scrollTo({
              top: targetElement.offsetTop - 70,
              behavior: "smooth"
            });
          }
        }
      }
    };

    document.addEventListener("click", handleSmoothScroll);
    
    return () => {
      document.removeEventListener("click", handleSmoothScroll);
    };
  }, []);

  const handleGetStartedClick = () => {
    window.location.href = "/github";
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">

      <main>
        <section id="welcome" className="py-20">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center">
              <div className="md:w-1/2 mb-12 md:mb-0">
                <h1 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900 dark:text-white">
                  Welcome to <span className="text-green-600">TreePT</span>
                </h1>
                <p className="text-lg mb-8 text-slate-700 dark:text-slate-300">
                  Contributing to a more connected GitHub ecosystem through intelligent code analysis
                </p>
                <div className="flex flex-wrap gap-4">
                  <a 
                    href="#solutions" 
                    className="scroll-link px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Explore Our Solutions
                  </a>
                  <a 
                    href="#explore" 
                    className="scroll-link px-6 py-3 border border-green-600 text-green-600 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30"
                  >
                    View Demo
                  </a>
                </div>
              </div>
              
              <div className="md:w-1/2 flex justify-center">
                <div className="w-full max-w-md">
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex space-x-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      </div>
                      <div className="text-xs text-slate-500">repository-explorer.js</div>
                    </div>
                    
                    <FileNodeGraph />
                    
                    <div className="mt-4 border-t pt-4 dark:border-slate-700">
                      <div className="flex items-center text-sm text-slate-700 dark:text-slate-300">
                        <svg className="h-4 w-4 mr-2 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <span>3 issues detected in your repository</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-slate-50 dark:bg-slate-800">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12 text-slate-900 dark:text-white">
              Visualize Your Codebase Like Never Before
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center text-center p-6">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
                  <svg className="h-8 w-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                    <path d="M2 17l10 5 10-5"></path>
                    <path d="M2 12l10 5 10-5"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">Smart Repository Analysis</h3>
                <p className="text-slate-600 dark:text-slate-400">Get detailed insights into your codebase structure, dependencies, and potential issues</p>
              </div>
              
              <div className="flex flex-col items-center text-center p-6">
                <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-4">
                  <svg className="h-8 w-8 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 3v12"></path>
                    <path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
                    <path d="M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
                    <path d="M15 6a9 9 0 0 0-9 9"></path>
                    <path d="M18 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">Dependency Visualization</h3>
                <p className="text-slate-600 dark:text-slate-400">See how your code connects with interactive graphs that reveal relationships and problem areas</p>
              </div>
              
              <div className="flex flex-col items-center text-center p-6">
                <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-4">
                  <svg className="h-8 w-8 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    <path d="M21 11H3a2 2 0 0 0-2 2v4a8 8 0 0 0 8 8h6a8 8 0 0 0 8-8v-4a2 2 0 0 0-2-2Z"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-semibold mb-3 text-slate-900 dark:text-white">Optimized Issue Resolution</h3>
                <p className="text-slate-600 dark:text-slate-400">Identify and fix architectural problems before they become technical debt</p>
              </div>
            </div>
          </div>
        </section>

        <section id="solutions" ref={solutionsRef} className="py-20 bg-white dark:bg-slate-900">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-3 text-slate-900 dark:text-white">Our Solutions</h2>
            <p className="text-center mb-12 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Powerful tools to help you understand, manage, and improve your GitHub projects
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="h-2 bg-green-500"></div>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6"></polyline>
                      <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                    Repository Understanding
                  </CardTitle>
                  <CardDescription>Evaluate your project structure</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-400">
                    Gain deep insights into your codebase with our advanced repository analysis. 
                    Visualize file relationships, identify architectural patterns, and discover 
                    optimization opportunities.
                  </p>
                </CardContent>
                <CardFooter>
                  <a href="#" className="text-green-600 hover:text-green-700 flex items-center">
                    Learn more
                    <svg className="ml-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </CardFooter>
              </Card>
              
              <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="h-2 bg-blue-500"></div>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 3v12"></path>
                      <path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
                      <path d="M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
                      <path d="M15 6a9 9 0 0 0-9 9"></path>
                      <path d="M18 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
                    </svg>
                    Optimized Issue Resolution
                  </CardTitle>
                  <CardDescription>Get recognized for your efforts</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-400">
                    Tackle the right issues with context-aware suggestions. Our AI analyzes your
                    codebase to identify which issues will have the highest impact when resolved,
                    helping you prioritize your development efforts.
                  </p>
                </CardContent>
                <CardFooter>
                  <a href="#" className="text-blue-600 hover:text-blue-700 flex items-center">
                    Learn more
                    <svg className="ml-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </CardFooter>
              </Card>
              
              <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="h-2 bg-purple-500"></div>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <svg className="h-5 w-5 mr-2 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                    </svg>
                    More GitHub Contributions
                  </CardTitle>
                  <CardDescription>Empower your team</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-400">
                    Make contributing easier with intelligent context. New team members can quickly
                    understand complex codebases, while seasoned developers gain new perspectives
                    on familiar code. Everyone can contribute more effectively.
                  </p>
                </CardContent>
                <CardFooter>
                  <a href="#" className="text-purple-600 hover:text-purple-700 flex items-center">
                    Learn more
                    <svg className="ml-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </CardFooter>
              </Card>
            </div>
          </div>
        </section>

        <section id="get-started" className="py-20 bg-green-600 text-white">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to Make a Difference?</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto">
              Join thousands of developers already using TreePT to contribute to innovating technology and building better code.
            </p>
            <button 
              onClick={handleGetStartedClick}
              className="px-8 py-4 text-lg font-semibold bg-white text-green-700 rounded-lg hover:bg-green-50"
            >
              Get Started Today
            </button>
          </div>
        </section>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <svg className="h-6 w-6 text-green-500 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 7l-5 5-5-5"/>
                <path d="M17 13l-5 5-5-5"/>
              </svg>
              <span className="text-white font-bold">TreePT</span>
            </div>
            
            <div className="text-sm">
              &copy; 2025 TreePT. All rights reserved. Contributing to better code.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}