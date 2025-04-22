/**
 * @jest-environment jsdom
 */

/*
 * End-to-End System Test for Search Functionality
 * 
 * This test simulates a complete user flow from repository input to 
 * issue search, results display, and navigation through the system.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import GithubPage from '../app/github/page';
import IssuesPage from '../app/github/issues/page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn().mockImplementation((param) => {
      if (param === 'repoUrl') return 'https://github.com/test/repo';
      if (param === 'searchQuery') return '';
      if (param === 'page') return '1';
      return null;
    }),
  }),
}));

// Mock Link component
jest.mock('next/link', () => {
  return ({ href, children, ...rest }) => {
    return (
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault();
          // Simulate navigation
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', href);
            window.dispatchEvent(new Event('popstate'));
          }
        }}
        {...rest}
      >
        {children}
      </a>
    );
  };
});

// Mock global fetch
global.fetch = jest.fn().mockImplementation((url, options) => {
  // Mock API call to get repository tree
  if (url.includes('/api/get_repo') || url.includes('/repos/')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ 
        tree: [
          { path: 'src/index.js', type: 'blob' },
          { path: 'src/App.js', type: 'blob' }
        ] 
      }),
    });
  }
  
  // Mock API call to search issues
  if (url.includes('/api/search') || (options && options.body && options.body.includes('searchTerm'))) {
    const searchTerm = options?.body ? JSON.parse(options.body).searchTerm : '';
    const page = options?.body ? JSON.parse(options.body).page || 1 : 1;
    
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        issues: [
          { 
            number: page * 2 - 1, 
            title: searchTerm ? `${searchTerm} issue ${page * 2 - 1}` : `Issue ${page * 2 - 1}`, 
            html_url: `https://github.com/test/repo/issues/${page * 2 - 1}` 
          },
          { 
            number: page * 2, 
            title: searchTerm ? `${searchTerm} issue ${page * 2}` : `Issue ${page * 2}`, 
            html_url: `https://github.com/test/repo/issues/${page * 2}` 
          },
        ],
        totalCount: 20,
        page: page,
        perPage: 10,
        totalPages: 2
      }),
    });
  }
  
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  });
});

// Mock d3 module for visualization
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

// Mock Element.getBoundingClientRect for layout calculations
Element.prototype.getBoundingClientRect = jest.fn(() => ({
  width: 500,
  height: 500,
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
}));

describe('Search End-to-End System Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.pushState({}, '', '/');
  });
  
  test('complete search flow from repository input to issue search', async () => {
    // Step 1: Render Github page for repository input
    const { unmount } = render(<GithubPage />);
    
    // Enter repository URL
    const repoInput = screen.getByPlaceholderText(/GitHub repository URL/i);
    fireEvent.change(repoInput, { target: { value: 'https://github.com/test/repo' } });
    
    // Click Analyze button
    const analyzeButton = screen.getByText(/Analyze/i);
    fireEvent.click(analyzeButton);
    
    // Unmount the first page
    unmount();
    
    // Step 2: Render Issues page that would load after clicking Analyze
    render(<IssuesPage />);
    
    // Wait for issues to load
    await waitFor(() => {
      expect(screen.getByText(/Issue 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Issue 2/i)).toBeInTheDocument();
    });
    
    // Step 3: Search for specific issues
    const searchInput = screen.getByPlaceholderText(/search issues/i);
    fireEvent.change(searchInput, { target: { value: 'bug' } });
    
    // Submit search
    const searchButton = screen.getByText(/^Search$/i);
    fireEvent.click(searchButton);
    
    // Wait for search results
    await waitFor(() => {
      expect(screen.getByText(/bug issue 1/i)).toBeInTheDocument();
      expect(screen.getByText(/bug issue 2/i)).toBeInTheDocument();
    });
    
    // Step 4: Navigate to page 2
    const paginationItems = screen.getAllByRole('listitem');
    if (paginationItems.length > 1) {
      // Find the "2" button (second page) if it exists
      const page2Button = screen.getByText('2');
      fireEvent.click(page2Button);
      
      // Check page 2 issues loaded
      await waitFor(() => {
        expect(screen.getByText(/bug issue 3/i)).toBeInTheDocument();
        expect(screen.getByText(/bug issue 4/i)).toBeInTheDocument();
      });
    }
    
    // Step 5: Verify the repository structure visualization is present
    const repoStructureTitle = screen.getByText(/Repository Structure/i);
    expect(repoStructureTitle).toBeInTheDocument();
  });
  
  test('handles error cases properly in the search flow', async () => {
    // Override fetch mock for this test to simulate errors
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockImplementation((url, options) => {
      if (url.includes('/api/search') || (options && options.body && options.body.includes('searchTerm'))) {
        return Promise.resolve({
          ok: false,
          statusText: 'Not Found',
          json: () => Promise.resolve({ error: 'GitHub API error' })
        });
      }
      
      return originalFetch(url, options);
    });
    
    // Render Issues page
    render(<IssuesPage />);
    
    // Search for something
    const searchInput = screen.getByPlaceholderText(/search issues/i);
    fireEvent.change(searchInput, { target: { value: 'error-trigger' } });
    
    // Submit search
    const searchButton = screen.getByText(/^Search$/i);
    fireEvent.click(searchButton);
    
    // Verify error message appears
    await waitFor(() => {
      expect(screen.getByText(/failed to fetch issues/i)).toBeInTheDocument();
    });
    
    // Restore original fetch
    global.fetch = originalFetch;
  });
  
  test('properly renders empty search results', async () => {
    // Override fetch mock for this test to return empty results
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockImplementation((url, options) => {
      if (url.includes('/api/search') || (options && options.body && options.body.includes('searchTerm'))) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            issues: [],
            totalCount: 0,
            page: 1,
            perPage: 10,
            totalPages: 0
          }),
        });
      }
      
      return originalFetch(url, options);
    });
    
    // Render Issues page
    render(<IssuesPage />);
    
    // Search for something with no results
    const searchInput = screen.getByPlaceholderText(/search issues/i);
    fireEvent.change(searchInput, { target: { value: 'no-results-term' } });
    
    // Submit search
    const searchButton = screen.getByText(/^Search$/i);
    fireEvent.click(searchButton);
    
    // Wait for search to complete and check for no results message
    await waitFor(() => {
      expect(screen.getByText(/no issues found/i)).toBeInTheDocument();
    });
    
    // Restore original fetch
    global.fetch = originalFetch;
  });
}); 