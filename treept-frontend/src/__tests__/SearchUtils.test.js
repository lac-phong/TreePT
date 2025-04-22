/**
 * @jest-environment jsdom
 */

// Mock utility functions for testing search functionality
const parseGitHubUrl = (url) => {
  if (!url || !url.startsWith('https://github.com/')) {
    return null;
  }
  return url.replace('https://github.com/', '');
};

const buildSearchQuery = (repoPath, searchTerm) => {
  return searchTerm 
    ? `repo:${repoPath}+is:issue+is:open+${encodeURIComponent(searchTerm)}+in:title` 
    : `repo:${repoPath}+is:issue+is:open`;
};

const calculatePagination = (totalCount, perPage) => {
  return {
    totalPages: Math.ceil(totalCount / perPage),
    hasNextPage: (page, totalPages) => page < totalPages,
    hasPrevPage: (page) => page > 1
  };
};

describe('Search Utilities', () => {
  describe('parseGitHubUrl', () => {
    test('returns null for invalid GitHub URL', () => {
      expect(parseGitHubUrl(null)).toBeNull();
      expect(parseGitHubUrl('')).toBeNull();
      expect(parseGitHubUrl('invalid-url')).toBeNull();
      expect(parseGitHubUrl('https://gitlab.com/user/repo')).toBeNull();
    });

    test('returns repo path for valid GitHub URL', () => {
      expect(parseGitHubUrl('https://github.com/user/repo')).toBe('user/repo');
      expect(parseGitHubUrl('https://github.com/organization/project')).toBe('organization/project');
    });
  });

  describe('buildSearchQuery', () => {
    test('builds query with search term', () => {
      const result = buildSearchQuery('user/repo', 'bug fix');
      expect(result).toBe('repo:user/repo+is:issue+is:open+bug%20fix+in:title');
    });

    test('builds query without search term', () => {
      const result = buildSearchQuery('user/repo', '');
      expect(result).toBe('repo:user/repo+is:issue+is:open');
    });

    test('properly encodes special characters in search term', () => {
      const result = buildSearchQuery('user/repo', 'test & debug');
      expect(result).toBe('repo:user/repo+is:issue+is:open+test%20%26%20debug+in:title');
    });
  });

  describe('calculatePagination', () => {
    test('calculates total pages correctly', () => {
      expect(calculatePagination(10, 10).totalPages).toBe(1);
      expect(calculatePagination(11, 10).totalPages).toBe(2);
      expect(calculatePagination(0, 10).totalPages).toBe(0);
    });

    test('determines if has next page correctly', () => {
      const { hasNextPage } = calculatePagination(30, 10);
      expect(hasNextPage(1, 3)).toBe(true);
      expect(hasNextPage(2, 3)).toBe(true);
      expect(hasNextPage(3, 3)).toBe(false);
    });

    test('determines if has previous page correctly', () => {
      const { hasPrevPage } = calculatePagination(30, 10);
      expect(hasPrevPage(1)).toBe(false);
      expect(hasPrevPage(2)).toBe(true);
      expect(hasPrevPage(3)).toBe(true);
    });
  });
}); 