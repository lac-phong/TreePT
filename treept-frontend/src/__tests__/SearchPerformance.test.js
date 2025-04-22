/**
 * @jest-environment jsdom
 */

import { POST } from '../app/api/search/route';

// Mock the global Response
global.Response = {
  json: jest.fn().mockImplementation((data, options) => {
    return {
      json: async () => data,
      ...options
    };
  })
};

// Helper function to measure execution time
const measureExecutionTime = async (fn, args) => {
  const start = performance.now();
  await fn(...args);
  const end = performance.now();
  return end - start;
};

describe('Search Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock a successful fetch response
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        total_count: 20,
        items: Array(20).fill(0).map((_, i) => ({
          number: i + 1,
          title: `Issue ${i + 1}`,
          html_url: `https://github.com/test/repo/issues/${i + 1}`
        }))
      })
    });
  });

  test('handles multiple concurrent search requests efficiently', async () => {
    // Create 10 concurrent search requests with different search terms
    const requests = Array(10).fill(0).map((_, i) => ({
      json: jest.fn().mockResolvedValue({
        repoUrl: 'https://github.com/test/repo',
        searchTerm: `search-term-${i}`,
        page: 1,
        perPage: 10
      })
    }));
    
    // Measure total time to resolve all requests
    const start = performance.now();
    await Promise.all(requests.map(req => POST(req)));
    const end = performance.now();
    const totalTime = end - start;
    
    // Calculate average time per request
    const avgTimePerRequest = totalTime / requests.length;
    
    // Verify all requests were processed
    expect(global.fetch).toHaveBeenCalledTimes(10);
    
    // Log performance metrics
    console.log(`Total time for ${requests.length} requests: ${totalTime.toFixed(2)}ms`);
    console.log(`Average time per request: ${avgTimePerRequest.toFixed(2)}ms`);
    
    // A reasonable performance threshold would depend on your requirements
    // This is a placeholder assertion
    expect(avgTimePerRequest).toBeLessThan(100); // Expect each request to take less than 100ms on average
  });
  
  test('search performance scales linearly with page size', async () => {
    const pageSizes = [10, 20, 50, 100];
    const results = [];
    
    for (const size of pageSizes) {
      const req = {
        json: jest.fn().mockResolvedValue({
          repoUrl: 'https://github.com/test/repo',
          searchTerm: 'test',
          page: 1,
          perPage: size
        })
      };
      
      // Clear mock calls before each measurement
      global.fetch.mockClear();
      
      // Measure execution time
      const executionTime = await measureExecutionTime(POST, [req]);
      
      results.push({
        pageSize: size,
        executionTime
      });
    }
    
    // Log performance results
    console.table(results);
    
    // Verify that execution time increases somewhat linearly with page size
    // This is a simplified check - in a real scenario, you'd want to analyze this more thoroughly
    const ratios = [];
    for (let i = 1; i < results.length; i++) {
      const sizeRatio = results[i].pageSize / results[i-1].pageSize;
      const timeRatio = results[i].executionTime / results[i-1].executionTime;
      ratios.push(timeRatio / sizeRatio);
    }
    
    // Calculate average ratio - should be close to 1 for linear scaling
    const avgRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
    console.log(`Average scaling ratio: ${avgRatio.toFixed(2)}`);
    
    // Expect reasonable scaling (this is a loose check)
    expect(avgRatio).toBeGreaterThan(0.5);
    expect(avgRatio).toBeLessThan(2);
  });
  
  test('search is resilient under simulated network delays', async () => {
    // Simulate network delay
    global.fetch = jest.fn().mockImplementation(async () => {
      // Simulate random network delay between 100-300ms
      const delay = 100 + Math.random() * 200;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return {
        ok: true,
        json: async () => ({
          total_count: 20,
          items: Array(20).fill(0).map((_, i) => ({
            number: i + 1,
            title: `Issue ${i + 1}`,
            html_url: `https://github.com/test/repo/issues/${i + 1}`
          }))
        })
      };
    });
    
    const req = {
      json: jest.fn().mockResolvedValue({
        repoUrl: 'https://github.com/test/repo',
        searchTerm: 'test',
        page: 1,
        perPage: 10
      })
    };
    
    // Execute search request
    const startTime = performance.now();
    const response = await POST(req);
    const endTime = performance.now();
    const data = await response.json();
    
    // Verify successful response despite delay
    expect(data.issues).toBeDefined();
    expect(data.issues.length).toBeGreaterThan(0);
    
    // Log execution time
    console.log(`Search execution time with network delay: ${(endTime - startTime).toFixed(2)}ms`);
    
    // Execution time should include the network delay (at least 100ms)
    expect(endTime - startTime).toBeGreaterThan(100);
  });
}); 