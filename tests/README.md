# Post-Quantum Lattice Shield - Test Suite

This directory contains a comprehensive testing suite for the Post-Quantum Lattice Shield system, covering unit tests, integration tests, security tests, and performance benchmarks.

## Test Structure

```
tests/
├── setup.js                           # Jest setup and global utilities
├── run-all-tests.js                   # Comprehensive test runner
├── unit/                              # Unit tests
│   ├── crypto-utils.test.js           # PostQuantumCrypto class tests
│   └── netlify-functions.test.js      # Individual function tests
├── integration/                       # Integration tests
│   └── wordpress-netlify.test.js      # End-to-end workflow tests
├── security/                          # Security tests
│   └── crypto-security.test.js        # Cryptographic security validation
└── performance/                       # Performance tests
    └── form-submission-benchmark.test.js # Performance benchmarking
```

## Test Categories

### 1. Unit Tests (`tests/unit/`)

Tests individual components and functions in isolation:

- **PostQuantumCrypto Class**: OQS library integration, key generation, encryption/decryption
- **Netlify Functions**: Individual function behavior, error handling, input validation
- **Error Handling**: Proper error codes and messages
- **Input Validation**: Boundary conditions and invalid inputs

### 2. Integration Tests (`tests/integration/`)

Tests complete workflows and system interactions:

- **WordPress-Netlify Communication**: End-to-end form submission workflow
- **Mixed Encryption Types**: RSA legacy and post-quantum data handling
- **API Authentication**: Key rotation and authorization
- **Batch Processing**: Multiple concurrent requests
- **Error Recovery**: Network timeouts and malformed requests

### 3. Security Tests (`tests/security/`)

Validates cryptographic security properties:

- **Key Generation Randomness**: Entropy analysis and uniqueness verification
- **Encryption Strength**: Ciphertext randomness and authentication
- **Algorithm Compliance**: NIST ML-KEM parameter verification
- **Side-Channel Resistance**: Timing consistency and information leakage prevention
- **Authentication**: GCM auth tag validation and tampering detection

### 4. Performance Tests (`tests/performance/`)

Benchmarks system performance and identifies bottlenecks:

- **Key Generation Performance**: Timing for different security levels
- **Encryption/Decryption Speed**: Throughput analysis for various data sizes
- **Form Submission Latency**: End-to-end workflow timing
- **Concurrent Request Handling**: Performance under load
- **Performance Regression Detection**: Consistency across multiple runs

## Running Tests

### Prerequisites

1. **Node.js**: Version 18 or higher
2. **Dependencies**: Run `npm install` to install test dependencies
3. **OQS Library** (optional): For full functionality testing
   - If not available, tests will skip OQS-dependent functionality
   - Install via: `npm install oqs.js` (requires system OQS library)

### Quick Start

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:security
npm run test:performance

# Run with coverage analysis
npm run test:coverage

# Run in watch mode (for development)
npm run test:watch

# Run with verbose output
npm run test:verbose
```

### Comprehensive Test Runner

For a complete test suite with detailed reporting:

```bash
node tests/run-all-tests.js
```

This will:
- Check OQS library availability
- Run all test categories in sequence
- Generate code coverage analysis
- Provide detailed performance metrics
- Create a comprehensive report

## Test Configuration

### Environment Variables

- `NODE_ENV=test`: Set automatically during testing
- `PQLS_API_KEY`: Set to test value for authentication tests
- `VERBOSE_TESTS=1`: Enable console output during tests

### Performance Thresholds

Defined in `tests/setup.js`:

```javascript
PERFORMANCE_THRESHOLDS: {
  KEY_GENERATION_MS: 5000,    // Max key generation time
  ENCRYPTION_MS: 1000,        // Max encryption time
  DECRYPTION_MS: 1000,        // Max decryption time
  FORM_SUBMISSION_MS: 2000    // Max end-to-end form submission
}
```

### Coverage Thresholds

Configured in `jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  }
}
```

## Test Utilities

### Global Test Utilities (`global.testUtils`)

- `generateTestData(size)`: Create test data of specified size
- `createMockEvent(method, body, headers)`: Create mock Netlify function events
- `measurePerformance(fn)`: Measure execution time of async functions
- `enableConsole()`: Enable console output for debugging

### Test Constants (`global.TEST_CONSTANTS`)

- `ALGORITHMS`: Supported ML-KEM algorithms
- `SECURITY_LEVELS`: Available security levels
- `PERFORMANCE_THRESHOLDS`: Maximum acceptable timing values

## Understanding Test Results

### Test Status Indicators

- ✅ **PASSED**: Test completed successfully
- ❌ **FAILED**: Test failed with errors
- ⚠️ **SKIPPED**: Test skipped (usually due to missing OQS library)

### Performance Metrics

- **Duration**: Time taken for operations (milliseconds)
- **Throughput**: Data processing rate (bytes/second)
- **Concurrency**: Performance under concurrent load
- **Consistency**: Variance across multiple runs

### Security Validation

- **Entropy**: Randomness quality in generated keys
- **Uniqueness**: Verification that keys/ciphertexts are unique
- **Authentication**: GCM auth tag validation
- **Compliance**: NIST parameter verification

## Troubleshooting

### Common Issues

1. **OQS Library Not Found**
   ```
   Error: Failed to load OQS library
   ```
   - **Solution**: Install OQS library or run tests without it (some will be skipped)

2. **Performance Test Failures**
   ```
   Error: Operation took longer than expected
   ```
   - **Solution**: Check system load, adjust thresholds if needed

3. **Memory Issues**
   ```
   Error: JavaScript heap out of memory
   ```
   - **Solution**: Increase Node.js memory limit: `node --max-old-space-size=4096`

### Debug Mode

Enable verbose logging for debugging:

```bash
VERBOSE_TESTS=1 npm run test:verbose
```

### Individual Test Debugging

Run specific test files:

```bash
npx jest tests/unit/crypto-utils.test.js --verbose
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: node tests/run-all-tests.js
      - uses: codecov/codecov-action@v1
        with:
          file: ./coverage/lcov.info
```

## Contributing

When adding new functionality:

1. **Write Tests First**: Follow TDD principles
2. **Cover All Categories**: Add unit, integration, security, and performance tests
3. **Update Thresholds**: Adjust performance thresholds if needed
4. **Document Changes**: Update this README for new test patterns

### Test Naming Conventions

- **Unit Tests**: `describe('ComponentName')` → `test('should do something')`
- **Integration Tests**: `describe('WorkflowName')` → `test('should complete workflow')`
- **Security Tests**: `describe('SecurityProperty')` → `test('should validate property')`
- **Performance Tests**: `describe('OperationName Performance')` → `test('should meet timing requirements')`

## Reports and Artifacts

### Generated Files

- `coverage/`: HTML coverage reports
- `tests/test-report.json`: Detailed test execution report
- Console output with color-coded results and recommendations

### Metrics Tracked

- Test execution time
- Code coverage percentages
- Performance benchmarks
- Security validation results
- Error rates and types

---

For questions or issues with the test suite, please check the troubleshooting section or create an issue in the project repository.