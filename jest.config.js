module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  collectCoverageFrom: [
    'netlify/functions/**/*.js',
    '!netlify/functions/**/*.test.js',
    '!netlify/functions/**/*.spec.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000, // 30 seconds for crypto operations
  verbose: true,
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 25,
      lines: 20,
      statements: 20
    }
  }
};