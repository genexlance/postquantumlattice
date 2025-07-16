/**
 * Performance benchmarking tests for form submission latency
 * Tests encryption/decryption performance and identifies bottlenecks
 */

const { handler: generateKeypairHandler } = require('../../netlify/functions/generate-keypair');
const { handler: encryptHandler } = require('../../netlify/functions/encrypt');
const { handler: decryptHandler } = require('../../netlify/functions/decrypt');
const PostQuantumCrypto = require('../../netlify/functions/crypto-utils');

describe('Form Submission Performance Benchmarks', () => {
  let testKeypair;
  let pqCrypto;

  beforeAll(async () => {
    // Set up test environment
    process.env.PQLS_API_KEY = 'benchmark-test-key';
    
    pqCrypto = new PostQuantumCrypto();
    try {
      await pqCrypto.initialize();
      if (pqCrypto.isReady()) {
        testKeypair = await pqCrypto.generateKeypair();
      }
    } catch (error) {
      console.warn('OQS library not available for performance tests:', error.message);
    }
  });

  describe('Key Generation Performance', () => {
    test('should generate keypairs within acceptable time limits', async () => {
      if (!pqCrypto.isReady()) {
        console.warn('Skipping key generation performance test - OQS not available');
        return;
      }

      const securityLevels = ['standard', 'high'];
      const results = {};

      for (const level of securityLevels) {
        const timings = [];
        const iterations = 5;

        for (let i = 0; i < iterations; i++) {
          const { result, durationMs } = await testUtils.measurePerformance(async () => {
            const event = {
              ...testUtils.createMockEvent('GET'),
              queryStringParameters: { security: level }
            };
            return await generateKeypairHandler(event);
          });

          if (result.statusCode === 200) {
            timings.push(durationMs);
          }
        }

        if (timings.length > 0) {
          const avgTime = timings.reduce((a, b) => a + b) / timings.length;
          const maxTime = Math.max(...timings);
          const minTime = Math.min(...timings);

          results[level] = {
            average: avgTime,
            max: maxTime,
            min: minTime,
            samples: timings.length
          };

          // Performance thresholds
          expect(avgTime).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.KEY_GENERATION_MS);
          expect(maxTime).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.KEY_GENERATION_MS * 1.5);

          console.log(`✅ ${level} keypair generation: avg ${avgTime.toFixed(2)}ms, max ${maxTime.toFixed(2)}ms`);
        }
      }

      // High security should be slower than standard, but not excessively
      if (results.standard && results.high) {
        const slowdownRatio = results.high.average / results.standard.average;
        expect(slowdownRatio).toBeLessThan(3); // Should not be more than 3x slower
        console.log(`High security slowdown ratio: ${slowdownRatio.toFixed(2)}x`);
      }
    }, 30000);

    test('should handle concurrent key generation requests', async () => {
      if (!pqCrypto.isReady()) return;

      const concurrentRequests = 3;
      const requests = Array(concurrentRequests).fill().map(() => {
        return testUtils.measurePerformance(async () => {
          const event = testUtils.createMockEvent('GET');
          return await generateKeypairHandler(event);
        });
      });

      const results = await Promise.all(requests);
      const successfulResults = results.filter(r => r.result.statusCode === 200);

      if (successfulResults.length > 0) {
        const avgConcurrentTime = successfulResults.reduce((sum, r) => sum + r.durationMs, 0) / successfulResults.length;
        console.log(`✅ Concurrent key generation (${concurrentRequests} requests): avg ${avgConcurrentTime.toFixed(2)}ms`);
        
        // Concurrent requests should not be significantly slower than sequential
        expect(avgConcurrentTime).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.KEY_GENERATION_MS * 2);
      }
    });
  });

  describe('Encryption Performance', () => {
    test('should encrypt form data within acceptable time limits', async () => {
      if (!testKeypair) {
        console.warn('Skipping encryption performance test - no test keypair');
        return;
      }

      const testSizes = [
        { name: 'small', size: 100, description: 'Small form (name, email)' },
        { name: 'medium', size: 1000, description: 'Medium form (with message)' },
        { name: 'large', size: 10000, description: 'Large form (with attachments)' },
        { name: 'xlarge', size: 50000, description: 'Extra large form data' }
      ];

      const results = {};

      for (const testCase of testSizes) {
        const testData = testUtils.generateTestData(testCase.size);
        const timings = [];
        const iterations = 5;

        for (let i = 0; i < iterations; i++) {
          const { result, durationMs } = await testUtils.measurePerformance(async () => {
            const event = testUtils.createMockEvent('POST', {
              data: testData,
              publicKey: testKeypair.publicKey,
              algorithm: testKeypair.algorithm
            });
            return await encryptHandler(event);
          });

          if (result.statusCode === 200) {
            timings.push(durationMs);
          }
        }

        if (timings.length > 0) {
          const avgTime = timings.reduce((a, b) => a + b) / timings.length;
          const throughput = (testCase.size / avgTime) * 1000; // bytes per second

          results[testCase.name] = {
            size: testCase.size,
            average: avgTime,
            throughput: throughput,
            samples: timings.length
          };

          // Performance thresholds based on data size
          const expectedMaxTime = Math.max(
            TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.ENCRYPTION_MS,
            testCase.size / 10000 * 1000 // 1ms per 10KB
          );
          expect(avgTime).toBeLessThan(expectedMaxTime);

          console.log(`✅ ${testCase.name} encryption (${testCase.size}B): ${avgTime.toFixed(2)}ms, ${(throughput/1024).toFixed(2)} KB/s`);
        }
      }

      // Verify throughput scales reasonably with data size
      if (results.small && results.large) {
        const smallThroughput = results.small.throughput;
        const largeThroughput = results.large.throughput;
        const throughputRatio = largeThroughput / smallThroughput;
        
        // Large data should have similar or better throughput (within 50%)
        expect(throughputRatio).toBeGreaterThan(0.5);
        console.log(`Throughput scaling ratio (large/small): ${throughputRatio.toFixed(2)}`);
      }
    });

    test('should handle typical WordPress form data efficiently', async () => {
      if (!testKeypair) return;

      // Simulate realistic WordPress form data
      const formData = {
        contact_form: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          phone: '+1-555-123-4567',
          company: 'Example Corp',
          message: 'This is a typical contact form message that might contain some sensitive information about business requirements and contact details.',
          source: 'website_contact_form',
          timestamp: new Date().toISOString()
        },
        payment_form: {
          card_number: '4111-1111-1111-1111',
          expiry: '12/25',
          cvv: '123',
          billing_address: '123 Main St, Anytown, ST 12345',
          amount: '99.99',
          currency: 'USD'
        },
        survey_form: {
          responses: Array(20).fill().map((_, i) => `Response to question ${i + 1}: This is a detailed answer that might contain personal opinions and sensitive information.`),
          demographics: {
            age_range: '25-34',
            income_range: '$50k-$75k',
            location: 'Urban area'
          }
        }
      };

      const results = {};

      for (const [formType, data] of Object.entries(formData)) {
        const jsonData = JSON.stringify(data);
        const { result, durationMs } = await testUtils.measurePerformance(async () => {
          const event = testUtils.createMockEvent('POST', {
            data: jsonData,
            publicKey: testKeypair.publicKey,
            algorithm: testKeypair.algorithm
          });
          return await encryptHandler(event);
        });

        if (result.statusCode === 200) {
          results[formType] = {
            dataSize: jsonData.length,
            encryptionTime: durationMs,
            throughput: (jsonData.length / durationMs) * 1000
          };

          // Form encryption should be fast enough for good UX
          expect(durationMs).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.FORM_SUBMISSION_MS);

          console.log(`✅ ${formType} (${jsonData.length}B): ${durationMs.toFixed(2)}ms`);
        }
      }

      const avgTime = Object.values(results).reduce((sum, r) => sum + r.encryptionTime, 0) / Object.keys(results).length;
      console.log(`Average form encryption time: ${avgTime.toFixed(2)}ms`);
    });
  });

  describe('Decryption Performance', () => {
    test('should decrypt data within acceptable time limits', async () => {
      if (!testKeypair) return;

      const testSizes = [100, 1000, 10000, 50000];
      const results = [];

      for (const size of testSizes) {
        const testData = testUtils.generateTestData(size);
        
        // First encrypt the data
        const encryptEvent = testUtils.createMockEvent('POST', {
          data: testData,
          publicKey: testKeypair.publicKey,
          algorithm: testKeypair.algorithm
        });

        const encryptResponse = await encryptHandler(encryptEvent);
        if (encryptResponse.statusCode !== 200) continue;

        const encryptBody = JSON.parse(encryptResponse.body);
        const encryptedData = encryptBody.encryptedData;

        // Now measure decryption performance
        const timings = [];
        const iterations = 5;

        for (let i = 0; i < iterations; i++) {
          const { result, durationMs } = await testUtils.measurePerformance(async () => {
            const event = testUtils.createMockEvent('POST', {
              encryptedData: encryptedData,
              privateKey: testKeypair.privateKey
            }, {
              authorization: 'Bearer benchmark-test-key'
            });
            return await decryptHandler(event);
          });

          if (result.statusCode === 200) {
            timings.push(durationMs);
          }
        }

        if (timings.length > 0) {
          const avgTime = timings.reduce((a, b) => a + b) / timings.length;
          const throughput = (size / avgTime) * 1000;

          results.push({
            size: size,
            average: avgTime,
            throughput: throughput
          });

          // Decryption should be fast
          expect(avgTime).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.DECRYPTION_MS);

          console.log(`✅ Decryption ${size}B: ${avgTime.toFixed(2)}ms, ${(throughput/1024).toFixed(2)} KB/s`);
        }
      }
    });

    test('should handle mixed encryption type detection efficiently', async () => {
      if (!testKeypair) return;

      // Test data with different encryption types
      const testCases = [
        {
          name: 'post-quantum',
          getData: async () => {
            const encryptEvent = testUtils.createMockEvent('POST', {
              data: 'Post-quantum test data',
              publicKey: testKeypair.publicKey,
              algorithm: testKeypair.algorithm
            });
            const response = await encryptHandler(encryptEvent);
            return response.statusCode === 200 ? JSON.parse(response.body).encryptedData : null;
          }
        },
        {
          name: 'rsa-legacy',
          getData: async () => ({
            version: 'rsa-v1',
            algorithm: 'RSA-OAEP-256',
            encryptedData: 'dGVzdA==' // base64 'test'
          })
        }
      ];

      const results = {};

      for (const testCase of testCases) {
        const encryptedData = await testCase.getData();
        if (!encryptedData) continue;

        const { result, durationMs } = await testUtils.measurePerformance(async () => {
          const event = testUtils.createMockEvent('POST', {
            encryptedData: encryptedData,
            privateKey: testKeypair.privateKey
          }, {
            authorization: 'Bearer benchmark-test-key'
          });
          return await decryptHandler(event);
        });

        results[testCase.name] = {
          detectionTime: durationMs,
          statusCode: result.statusCode
        };

        // Type detection should be fast
        expect(durationMs).toBeLessThan(100); // Should detect type in < 100ms

        console.log(`✅ ${testCase.name} type detection: ${durationMs.toFixed(2)}ms`);
      }
    });
  });

  describe('End-to-End Form Submission Performance', () => {
    test('should complete full form submission workflow within time limits', async () => {
      if (!testKeypair) return;

      // Simulate complete WordPress form submission workflow
      const formData = {
        user_id: 12345,
        form_id: 'contact_form_1',
        fields: {
          name: 'Performance Test User',
          email: 'perf.test@example.com',
          phone: '+1-555-PERF-TEST',
          message: 'This is a performance test message that simulates a typical form submission with various field types and reasonable content length.',
          preferences: ['newsletter', 'updates'],
          consent: true,
          source: 'performance_test'
        },
        metadata: {
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0 (Test Browser)',
          timestamp: new Date().toISOString(),
          form_version: '1.2.3'
        }
      };

      const jsonData = JSON.stringify(formData);
      
      // Measure complete workflow: encrypt -> decrypt
      const { result: workflowResult, durationMs: totalTime } = await testUtils.measurePerformance(async () => {
        // Step 1: Encrypt form data
        const encryptEvent = testUtils.createMockEvent('POST', {
          data: jsonData,
          publicKey: testKeypair.publicKey,
          algorithm: testKeypair.algorithm
        });

        const encryptResponse = await encryptHandler(encryptEvent);
        if (encryptResponse.statusCode !== 200) {
          throw new Error('Encryption failed');
        }

        const encryptBody = JSON.parse(encryptResponse.body);
        
        // Step 2: Decrypt for admin viewing (simulate admin dashboard)
        const decryptEvent = testUtils.createMockEvent('POST', {
          encryptedData: encryptBody.encryptedData,
          privateKey: testKeypair.privateKey
        }, {
          authorization: 'Bearer benchmark-test-key'
        });

        const decryptResponse = await decryptHandler(decryptEvent);
        if (decryptResponse.statusCode !== 200) {
          throw new Error('Decryption failed');
        }

        return {
          encryptResponse,
          decryptResponse,
          dataSize: jsonData.length
        };
      });

      if (workflowResult) {
        // Total workflow should be fast enough for good UX
        expect(totalTime).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.FORM_SUBMISSION_MS);

        // Verify data integrity
        const decryptBody = JSON.parse(workflowResult.decryptResponse.body);
        const decryptedData = JSON.parse(decryptBody.decryptedData);
        expect(decryptedData).toEqual(formData);

        console.log(`✅ Complete form workflow (${jsonData.length}B): ${totalTime.toFixed(2)}ms`);
        console.log(`   - Data integrity verified`);
        console.log(`   - Performance target: ${TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.FORM_SUBMISSION_MS}ms`);
      }
    });

    test('should handle concurrent form submissions efficiently', async () => {
      if (!testKeypair) return;

      const concurrentSubmissions = 5;
      const formData = 'Concurrent submission test data: ' + 'A'.repeat(1000);

      const submissions = Array(concurrentSubmissions).fill().map((_, index) => {
        return testUtils.measurePerformance(async () => {
          const event = testUtils.createMockEvent('POST', {
            data: `${formData} - Submission ${index}`,
            publicKey: testKeypair.publicKey,
            algorithm: testKeypair.algorithm
          });
          return await encryptHandler(event);
        });
      });

      const results = await Promise.all(submissions);
      const successfulSubmissions = results.filter(r => r.result.statusCode === 200);

      if (successfulSubmissions.length > 0) {
        const avgTime = successfulSubmissions.reduce((sum, r) => sum + r.durationMs, 0) / successfulSubmissions.length;
        const maxTime = Math.max(...successfulSubmissions.map(r => r.durationMs));

        // Concurrent submissions should not significantly degrade performance
        expect(avgTime).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.ENCRYPTION_MS * 1.5);
        expect(maxTime).toBeLessThan(TEST_CONSTANTS.PERFORMANCE_THRESHOLDS.ENCRYPTION_MS * 2);

        console.log(`✅ Concurrent submissions (${concurrentSubmissions}): avg ${avgTime.toFixed(2)}ms, max ${maxTime.toFixed(2)}ms`);
        console.log(`   - Success rate: ${successfulSubmissions.length}/${concurrentSubmissions}`);
      }
    });
  });

  describe('Performance Regression Detection', () => {
    test('should maintain consistent performance across multiple runs', async () => {
      if (!testKeypair) return;

      const testData = testUtils.generateTestData(5000);
      const runs = 10;
      const timings = [];

      for (let i = 0; i < runs; i++) {
        const { result, durationMs } = await testUtils.measurePerformance(async () => {
          const event = testUtils.createMockEvent('POST', {
            data: testData,
            publicKey: testKeypair.publicKey,
            algorithm: testKeypair.algorithm
          });
          return await encryptHandler(event);
        });

        if (result.statusCode === 200) {
          timings.push(durationMs);
        }
      }

      if (timings.length >= 5) {
        const avgTime = timings.reduce((a, b) => a + b) / timings.length;
        const stdDev = Math.sqrt(timings.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / timings.length);
        const coefficientOfVariation = stdDev / avgTime;

        // Performance should be consistent (CV < 0.3)
        expect(coefficientOfVariation).toBeLessThan(0.3);

        console.log(`✅ Performance consistency over ${runs} runs:`);
        console.log(`   - Average: ${avgTime.toFixed(2)}ms`);
        console.log(`   - Std Dev: ${stdDev.toFixed(2)}ms`);
        console.log(`   - CV: ${coefficientOfVariation.toFixed(3)}`);
      }
    });
  });
});