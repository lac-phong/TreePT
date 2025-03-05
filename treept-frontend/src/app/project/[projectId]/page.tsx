import React from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Package, GitBranch, Library } from 'lucide-react';

// Todo: Link these to the script's outputs
export default function ProjectStatsPage() {
  const projectData = {
    summary: {
      totalFiles: 67,
      totalExternalLibraries: 16,
      totalInternalDependencies: 164,
    },
    mostImportedFiles: [
      { name: 'src/lib/utils.ts', count: 30 },
      { name: 'src/components/ui/button.tsx', count: 20 },
      { name: 'src/components/ui/card.tsx', count: 10 },
      { name: 'src/components/ui/input.tsx', count: 10 },
      { name: 'src/components/ui/badge.tsx', count: 8 },
    ],
    mostUsedLibraries: [
      { name: 'lucide-react', count: 21 },
      { name: 'react', count: 19 },
      { name: 'next', count: 12 },
      { name: 'react-hook-form', count: 7 },
      { name: 'zod', count: 6 },
    ]
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Project Analysis Dashboard</h1>
      <p className="text-muted-foreground">Results for repo agorasrc</p>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <FileText className="h-4 w-4 text-muted-foreground mr-2" />
              <span className="text-2xl font-bold">{projectData.summary.totalFiles}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">External Libraries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Package className="h-4 w-4 text-muted-foreground mr-2" />
              <span className="text-2xl font-bold">{projectData.summary.totalExternalLibraries}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Internal Dependencies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <GitBranch className="h-4 w-4 text-muted-foreground mr-2" />
              <span className="text-2xl font-bold">{projectData.summary.totalInternalDependencies}</span>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Most Imported Files</CardTitle>
          <CardDescription>Internal files with the highest number of imports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {projectData.mostImportedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
                <Badge variant="secondary">{file.count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Most Used Libraries</CardTitle>
          <CardDescription>External dependencies with the highest usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {projectData.mostUsedLibraries.map((lib, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Library className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{lib.name}</span>
                </div>
                <Badge variant="secondary">{lib.count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}