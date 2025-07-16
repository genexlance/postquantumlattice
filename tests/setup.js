/**
 * Jest setup file for post-quantum cryptography tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PQLS_API_KEY = 'test-api-key-12345';

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Only show console output if VERBOSE_TESTS is set
if (!process.env.VERBOSE_TESTS) {
  console.log = jest.fn();
  console.error = jest.fn();
}

// Global test utilities
global.testUtils = {
  // Restore console for debugging specific tests
  enableConsole: () => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  },
  
  // Generate test data of various sizes
  generateTestData: (size = 100) => {
    return 'A'.repeat(size);
  },
  
  // Create mock event for Netlify functions
  createMockEvent: (method = 'POST', body = {}, headers = {}) => {
    return {
      httpMethod: method,
      body: JSON.stringify(body),
      headers: {
        'content-type': 'application/json',
        ...headers
      },
      queryStringParameters: null
    };
  },
  
  // Performance measurement utility
  measurePerformance: async (fn) => {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1000000;
    return { result, durationMs };
  }
};

// Global test constants
global.TEST_CONSTANTS = {
  ALGORITHMS: {
    STANDARD: 'ML-KEM-768',
    HIGH: 'ML-KEM-1024'
  },
  SECURITY_LEVELS: {
    STANDARD: 'standard',
    HIGH: 'high'
  },
  PERFORMANCE_THRESHOLDS: {
    KEY_GENERATION_MS: 5000,
    ENCRYPTION_MS: 1000,
    DECRYPTION_MS: 1000,
    FORM_SUBMISSION_MS: 2000
  }
};

// Cleanup after all tests
afterAll(() => {
  // Restore console
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});