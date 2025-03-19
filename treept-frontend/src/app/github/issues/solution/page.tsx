"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useState } from "react";

export default function Solution() {
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const clearErrors = () => {
        setError(false);
        setErrorMessage("");
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
                  <CardTitle>Issue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-96 bg-gray-100 flex items-center justify-center rounded-lg">
                    <p className="text-gray-500">Issue coming soon...</p>
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