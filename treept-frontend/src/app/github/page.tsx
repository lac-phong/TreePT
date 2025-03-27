"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Key, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Github() {
  const [repoUrl, setRepoUrl] = useState("");
  
  return (
    <div className="flex flex-col items-center justify-start pt-4 space-y-4">
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
            <Button asChild>
                <Link href={{
                    pathname: "/github/issues",
                    query: {
                        repoUrl: repoUrl,
                        searchQuery: "",
                        page: 1
                    }}} 
                    className="bg-green-500 text-white hover:bg-green-600" >Analyze</Link>
            </Button>
        </div>
        </CardContent>
    </Card>
    </div>
  );
}
