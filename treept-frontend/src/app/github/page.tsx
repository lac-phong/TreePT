"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Github() {
  const [repoUrl, setRepoUrl] = useState("");
  
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-start pt-16 px-4">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-zinc-800 mb-6 text-center">GitHub <span className="text-green-500">Analyzer</span></h1>
        
        <Card className="backdrop-blur-md bg-white/50 border border-zinc-200 shadow-xl rounded-xl">
          <CardHeader className="border-b border-zinc-100">
            <CardTitle className="text-zinc-700 text-xl">Analyze Repository</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Enter GitHub repository URL"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="bg-zinc-50 border-zinc-200 text-zinc-800 placeholder:text-zinc-400 h-12 pl-4 rounded-lg focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                />
              </div>
              
              <Button 
                asChild
                className="w-full bg-green-500 hover:bg-green-400 text-white font-medium py-2 h-12 rounded-lg transition-all duration-200 shadow-lg hover:shadow-green-500/20"
              >
                <Link 
                  href={{
                    pathname: "/github/issues",
                    query: {
                      repoUrl: repoUrl,
                      searchQuery: "",
                      page: 1
                    }
                  }}
                >
                  Analyze Repository
                </Link>
              </Button>
              
              <p className="text-zinc-500 text-xs text-center pt-2">
                Gain valuable insights into any GitHub repository
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}