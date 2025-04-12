import '@testing-library/jest-dom';
import 'whatwg-fetch';

// Mock the next/navigation module
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn((param) => {
      if (param === 'repoUrl') return 'https://github.com/test/repo';
      if (param === 'searchQuery') return 'test query';
      if (param === 'page') return '1';
      return null;
    }),
  }),
}));

// Mock IntersectionObserver
class IntersectionObserverMock {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.IntersectionObserver = IntersectionObserverMock;

// Mock window.fetch
global.fetch = jest.fn(); 