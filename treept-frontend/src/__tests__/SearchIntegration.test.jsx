/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Issues from '../app/github/issues/page';

// Mock API module
jest.mock('../app/api/search/route', () => ({
  POST: jest.fn().mockImplementation(async (req) => {
    const body = await req.json();
    const { repoUrl, searchTerm = '', page = 1 } = body;
    
    if (!repoUrl || !repoUrl.startsWith("https://github.com/")) {
      return {
        json: async () => ({ error: "Invalid GitHub URL" }),
      };
    }
    
    // Return mock search results
    return {
      json: async () => ({
        issues: [
          { number: 1, title: `Issue about ${searchTerm || 'general topic'}`, html_url: 'https://github.com/test/repo/issues/1' },
          { number: 2, title: `Another issue on ${searchTerm || 'general topic'}`, html_url: 'https://github.com/test/repo/issues/2' },
        ],
        totalCount: 10,
        page: page,
        perPage: 10,
        totalPages: 1
      }),
    };
  }),
}));

// Mock fetch globally
global.fetch = jest.fn().mockImplementation(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ 
      tree: [
        { path: 'src/index.js', type: 'blob' },
        { path: 'src/App.js', type: 'blob' }
      ] 
    }),
  })
);

// Mock the next/navigation module
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: jest.fn((param) => {
      if (param === 'repoUrl') return 'https://github.com/test/repo';
      if (param === 'searchQuery') return '';
      if (param === 'page') return '1';
      return null;
    }),
  }),
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock d3 module
jest.mock('d3', () => ({
  select: jest.fn(() => ({
    selectAll: jest.fn().mockReturnThis(),
    remove: jest.fn().mockReturnThis(),
    append: jest.fn().mockReturnThis(),
    attr: jest.fn().mockReturnThis(),
    style: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    data: jest.fn().mockReturnThis(),
    enter: jest.fn().mockReturnThis(),
    exit: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    call: jest.fn().mockReturnThis(),
  })),
  hierarchy: jest.fn(() => ({
    descendants: jest.fn().mockReturnValue([]),
    links: jest.fn().mockReturnValue([]),
  })),
  tree: jest.fn(() => jest.fn()),
  zoom: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    scaleExtent: jest.fn().mockReturnThis(),
    translateExtent: jest.fn().mockReturnThis(),
  })),
}));

// Mock Element.getBoundingClientRect
Element.prototype.getBoundingClientRect = jest.fn(() => ({
  width: 500,
  height: 500,
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
}));

describe('Search Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('integrates search component with mocked API', async () => {
    render(<Issues />);
    
    // Wait for initial API call to complete
    await waitFor(() => {
      expect(screen.getByText(/Issue about general topic/i)).toBeInTheDocument();
    });
    
    // Find the search input and enter a search term
    const searchInput = screen.getByPlaceholderText(/search issues/i);
    fireEvent.change(searchInput, { target: { value: 'performance' } });
    
    // Submit the search form by clicking the button
    const searchButton = screen.getByText('Search');
    fireEvent.click(searchButton);
    
    // Wait for the search results to update with the new term
    await waitFor(() => {
      expect(screen.getByText(/Issue about performance/i)).toBeInTheDocument();
      expect(screen.getByText(/Another issue on performance/i)).toBeInTheDocument();
    });
  });
  
  test('shows error message for invalid repository URL', async () => {
    // Override useSearchParams mock for this test
    jest.spyOn(require('next/navigation'), 'useSearchParams').mockImplementation(() => ({
      get: jest.fn((param) => {
        if (param === 'repoUrl') return 'invalid-url';
        if (param === 'searchQuery') return '';
        if (param === 'page') return '1';
        return null;
      }),
    }));
    
    render(<Issues />);
    
    // Wait for error message to appear
    await waitFor(() => {
      expect(screen.getByText(/Invalid GitHub URL/i)).toBeInTheDocument();
    });
  });
  
  test('handles pagination correctly', async () => {
    // Override fetch mock to return multiple pages
    global.fetch = jest.fn().mockImplementation((url, options) => {
      // For API search calls
      if (options?.method === 'POST' && options?.body) {
        const body = JSON.parse(options.body);
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            issues: [
              { number: body.page * 2 - 1, title: `Issue ${body.page * 2 - 1}`, html_url: `https://github.com/test/repo/issues/${body.page * 2 - 1}` },
              { number: body.page * 2, title: `Issue ${body.page * 2}`, html_url: `https://github.com/test/repo/issues/${body.page * 2}` },
            ],
            totalCount: 6,
            page: body.page,
            perPage: 2,
            totalPages: 3
          }),
        });
      }
      
      // For repo structure
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ 
          tree: [
            { path: 'src/index.js', type: 'blob' },
            { path: 'src/App.js', type: 'blob' }
          ] 
        }),
      });
    });
    
    render(<Issues />);
    
    // Wait for initial page to load
    await waitFor(() => {
      expect(screen.getByText(/Issue 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Issue 2/i)).toBeInTheDocument();
    });
    
    // Find and click the next page button if it exists
    const paginationItems = screen.getAllByRole('listitem');
    if (paginationItems.length > 1) {
      // Find the "2" button (second page)
      const page2Button = screen.getByText('2');
      fireEvent.click(page2Button);
      
      // Check if page 2 issues are loaded
      await waitFor(() => {
        expect(screen.getByText(/Issue 3/i)).toBeInTheDocument();
        expect(screen.getByText(/Issue 4/i)).toBeInTheDocument();
      });
    }
  });
}); 