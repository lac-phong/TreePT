import { POST } from './route';

// Mock global fetch
global.fetch = jest.fn();

// Mock Response.json
global.Response = {
  json: jest.fn().mockImplementation((data, options) => {
    return {
      json: async () => data,
      ...options
    };
  })
};

describe('Search API Endpoint', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock successful fetch response
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        total_count: 20,
        items: [
          { number: 1, title: 'Issue 1', html_url: 'https://github.com/test/repo/issues/1' },
          { number: 2, title: 'Issue 2', html_url: 'https://github.com/test/repo/issues/2' },
        ]
      })
    };
    
    global.fetch.mockResolvedValue(mockResponse);
  });

  test('should return error for invalid GitHub URL', async () => {
    // Mock the request
    const req = {
      json: jest.fn().mockResolvedValue({
        repoUrl: 'invalid-url',
        searchTerm: 'test',
        page: 1
      })
    };

    // Call the POST function
    const response = await POST(req);
    const data = await response.json();

    // Verify response
    expect(data.error).toBe('Invalid GitHub URL');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('should successfully search GitHub issues', async () => {
    // Mock the request
    const req = {
      json: jest.fn().mockResolvedValue({
        repoUrl: 'https://github.com/test/repo',
        searchTerm: 'test query',
        page: 1,
        perPage: 10
      })
    };

    // Call the POST function
    const response = await POST(req);
    const data = await response.json();

    // Verify the fetch call parameters
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/search/issues?q=repo:test/repo+is:issue+is:open+test%20query+in:title&per_page=10&page=1',
      expect.objectContaining({
        headers: expect.objectContaining({
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "GitHub-Issues-Fetcher"
        })
      })
    );

    // Verify response data
    expect(data.issues).toHaveLength(2);
    expect(data.totalCount).toBe(20);
    expect(data.totalPages).toBe(2);
  });

  test('should search without search term', async () => {
    // Mock the request
    const req = {
      json: jest.fn().mockResolvedValue({
        repoUrl: 'https://github.com/test/repo',
        searchTerm: '',
        page: 1,
        perPage: 10
      })
    };

    // Call the POST function
    const response = await POST(req);
    const data = await response.json();

    // Verify the fetch call parameters
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/search/issues?q=repo:test/repo+is:issue+is:open&per_page=10&page=1',
      expect.any(Object)
    );
  });

  test('should handle API errors', async () => {
    // Override the default mock to simulate an error
    global.fetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found'
    });

    // Mock the request
    const req = {
      json: jest.fn().mockResolvedValue({
        repoUrl: 'https://github.com/test/repo',
        searchTerm: 'test',
        page: 1
      })
    };

    // Call the POST function
    const response = await POST(req);
    const data = await response.json();

    // Verify response
    expect(data.error).toBe('Invalid URL or GitHub API error');
  });
}); 