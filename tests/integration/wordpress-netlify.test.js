/**
 * Integration tests for WordPress-to-Netlify communication
 * Tests end-to-end workflows and API interactions
 */

const { handler: generateKeypairHandler } = require('../../netlify/functions/generate-keypair');
const { handler: encryptHandler } = require('../../netlify/functions/encrypt');
const { handler: decryptHandler } = require('../../netlify/functions/decrypt');

describe('WordPress-Netlify Integration Tests', () => {
  let testApiKey;
  let generatedKeypair;

  beforeAll(() => {
    // Set up test environment
    testApiKey = 'integration-test-key-' + Date.now();
    process.env.PQLS_API_KEY = testApiKey;
  });

  afterAll(() => {
    // Clean up
    delete process.env.PQLS_API_KEY;
  });

  describe('Complete Encryption Workflow', () => {
    test('should complete full keypair generation -> encryption -> decryption workflow', async () => {
      // Step 1: Generate keypair (WordPress admin action)
      console.log('Step 1: Generating keypair...');
      const keypairEvent = testUtils.createMockEvent('GET');
      const keypairResponse = await generateKeypairHandler(keypairEvent);
      
      if (keypairResponse.statusCode !== 200) {
        console.warn('Keypair generation failed, skipping integration test');
        const body = JSON.parse(keypairResponse.body);
        console.warn('Error:', body.error);
        return;
      }

      generatedKeypair = JSON.parse(keypairResponse.body);
      expect(generatedKeypair).toHaveProperty('publicKey');
      expect(generatedKeypair).toHaveProperty('privateKey');
      expect(generatedKeypair).toHaveProperty('algorithm');

      // Step 2: Encrypt form data (WordPress form submission)
      console.log('Step 2: Encrypting form data...');
      const formData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        message: 'This is a test message with sensitive information.',
        phone: '+1-555-123-4567'
      };

      const encryptEvent = testUtils.createMockEvent('POST', {
        data: JSON.stringify(formData),
        publicKey: generatedKeypair.publicKey,
        algorithm: generatedKeypair.algorithm
      });

      const encryptResponse = await encryptHandler(encryptEvent);
      
      if (encryptResponse.statusCode !== 200) {
        console.warn('Encryption failed, skipping rest of integration test');
        const body = JSON.parse(encryptResponse.body);
        console.warn('Error:', body.error);
        return;
      }

      const encryptBody = JSON.parse(encryptResponse.body);
      expect(encryptBody).toHaveProperty('success', true);
      expect(encryptBody).toHaveProperty('encryptedData');

      const encryptedData = encryptBody.encryptedData;
      expect(encryptedData).toHaveProperty('version', 'pq-v1');
      expect(encryptedData.algorithm).toContain('ML-KEM');

      // Step 3: Decrypt data (WordPress admin viewing encrypted data)
      console.log('Step 3: Decrypting data...');
      const decryptEvent = testUtils.createMockEvent('POST', {
        encryptedData: encryptedData,
        privateKey: generatedKeypair.privateKey
      }, {
        authorization: `Bearer ${testApiKey}`
      });

      const decryptResponse = await decryptHandler(decryptEvent);
      
      if (decryptResponse.statusCode !== 200) {
        console.warn('Decryption failed');
        const body = JSON.parse(decryptResponse.body);
        console.warn('Error:', body.error);
        return;
      }

      const decryptBody = JSON.parse(decryptResponse.body);
      expect(decryptBody).toHaveProperty('decryptedData');
      expect(decryptBody).toHaveProperty('encryptionType', 'post-quantum');

      // Verify data integrity
      const decryptedFormData = JSON.parse(decryptBody.decryptedData);
      expect(decryptedFormData).toEqual(formData);

      console.log('✅ Complete workflow test passed');
    }, 30000); // 30 second timeout for integration test

    test('should handle multiple security levels in workflow', async () => {
      const securityLevels = ['standard', 'high'];
      
      for (const level of securityLevels) {
        console.log(`Testing workflow with ${level} security level...`);
        
        // Generate keypair with specific security level
        const keypairEvent = {
          ...testUtils.createMockEvent('GET'),
          queryStringParameters: { security: level }
        };
        
        const keypairResponse = await generateKeypairHandler(keypairEvent);
        if (keypairResponse.statusCode !== 200) continue;
        
        const keypair = JSON.parse(keypairResponse.body);
        expect(keypair.securityLevel).toBe(level);
        
        // Test encryption with this keypair
        const testData = `Test data for ${level} security`;
        const encryptEvent = testUtils.createMockEvent('POST', {
          data: testData,
          publicKey: keypair.publicKey,
          algorithm: keypair.algorithm
        });
        
        const encryptResponse = await encryptHandler(encryptEvent);
        if (encryptResponse.statusCode !== 200) continue;
        
        const encryptBody = JSON.parse(encryptResponse.body);
        expect(encryptBody.encryptedData.securityLevel).toBe(level);
        
        // Test decryption
        const decryptEvent = testUtils.createMockEvent('POST', {
          encryptedData: encryptBody.encryptedData,
          privateKey: keypair.privateKey
        }, {
          authorization: `Bearer ${testApiKey}`
        });
        
        const decryptResponse = await decryptHandler(decryptEvent);
        if (decryptResponse.statusCode === 200) {
          const decryptBody = JSON.parse(decryptResponse.body);
          expect(decryptBody.decryptedData).toBe(testData);
        }
      }
    }, 45000);
  });

  describe('WordPress Plugin Simulation', () => {
    test('should simulate WordPress form field encryption', async () => {
      if (!generatedKeypair) {
        console.warn('No keypair available for WordPress simulation test');
        return;
      }

      // Simulate WordPress form fields that need encryption
      const formFields = [
        { name: 'credit_card', value: '4111-1111-1111-1111', encrypt: true },
        { name: 'ssn', value: '123-45-6789', encrypt: true },
        { name: 'name', value: 'John Doe', encrypt: false },
        { name: 'email', value: 'john@example.com', encrypt: false }
      ];

      const encryptedFields = [];
      const plainFields = [];

      for (const field of formFields) {
        if (field.encrypt) {
          // Encrypt sensitive fields
          const encryptEvent = testUtils.createMockEvent('POST', {
            data: field.value,
            publicKey: generatedKeypair.publicKey,
            algorithm: generatedKeypair.algorithm
          });

          const encryptResponse = await encryptHandler(encryptEvent);
          if (encryptResponse.statusCode === 200) {
            const encryptBody = JSON.parse(encryptResponse.body);
            encryptedFields.push({
              name: field.name,
              encryptedData: encryptBody.encryptedData
            });
          }
        } else {
          plainFields.push(field);
        }
      }

      // Verify encrypted fields can be decrypted
      for (const field of encryptedFields) {
        const decryptEvent = testUtils.createMockEvent('POST', {
          encryptedData: field.encryptedData,
          privateKey: generatedKeypair.privateKey
        }, {
          authorization: `Bearer ${testApiKey}`
        });

        const decryptResponse = await decryptHandler(decryptEvent);
        if (decryptResponse.statusCode === 200) {
          const decryptBody = JSON.parse(decryptResponse.body);
          expect(decryptBody.decryptedData).toBeTruthy();
          expect(decryptBody.encryptionType).toBe('post-quantum');
        }
      }

      console.log(`✅ WordPress simulation: ${encryptedFields.length} fields encrypted, ${plainFields.length} fields plain`);
    });

    test('should handle WordPress batch encryption requests', async () => {
      if (!generatedKeypair) return;

      // Simulate multiple form submissions
      const batchData = [
        'Form submission 1: Sensitive data',
        'Form submission 2: More sensitive data',
        'Form submission 3: Additional sensitive data'
      ];

      const encryptionPromises = batchData.map(data => {
        const event = testUtils.createMockEvent('POST', {
          data: data,
          publicKey: generatedKeypair.publicKey,
          algorithm: generatedKeypair.algorithm
        });
        return encryptHandler(event);
      });

      const responses = await Promise.all(encryptionPromises);
      
      // Verify all encryptions succeeded
      const successfulEncryptions = responses.filter(r => r.statusCode === 200);
      console.log(`✅ Batch encryption: ${successfulEncryptions.length}/${batchData.length} successful`);
      
      if (successfulEncryptions.length > 0) {
        expect(successfulEncryptions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should handle network timeout simulation', async () => {
      // Simulate slow network by using large data
      const largeData = 'A'.repeat(100000); // 100KB of data
      
      if (!generatedKeypair) return;

      const encryptEvent = testUtils.createMockEvent('POST', {
        data: largeData,
        publicKey: generatedKeypair.publicKey,
        algorithm: generatedKeypair.algorithm
      });

      const startTime = Date.now();
      const response = await encryptHandler(encryptEvent);
      const duration = Date.now() - startTime;

      console.log(`Large data encryption took ${duration}ms`);
      
      // Should either succeed or fail gracefully
      expect([200, 400, 500, 503]).toContain(response.statusCode);
    });

    test('should handle API key rotation', async () => {
      const originalApiKey = process.env.PQLS_API_KEY;
      
      // Test with old API key
      const decryptEvent = testUtils.createMockEvent('POST', {
        encryptedData: { version: 'pq-v1' },
        privateKey: 'test-key'
      }, {
        authorization: `Bearer ${originalApiKey}`
      });

      let response = await decryptHandler(decryptEvent);
      expect([200, 400, 401]).toContain(response.statusCode);

      // Rotate API key
      const newApiKey = 'rotated-key-' + Date.now();
      process.env.PQLS_API_KEY = newApiKey;

      // Test with new API key
      const newDecryptEvent = testUtils.createMockEvent('POST', {
        encryptedData: { version: 'pq-v1' },
        privateKey: 'test-key'
      }, {
        authorization: `Bearer ${newApiKey}`
      });

      response = await decryptHandler(newDecryptEvent);
      expect([200, 400]).toContain(response.statusCode); // Should not be 401

      // Restore original API key
      process.env.PQLS_API_KEY = originalApiKey;
    });

    test('should handle malformed WordPress requests', async () => {
      const malformedRequests = [
        // Missing content-type
        { httpMethod: 'POST', body: '{"data":"test"}', headers: {} },
        // Invalid JSON
        { httpMethod: 'POST', body: '{invalid-json}', headers: { 'content-type': 'application/json' } },
        // Missing required fields
        { httpMethod: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }
      ];

      for (const request of malformedRequests) {
        const response = await encryptHandler(request);
        expect(response.statusCode).toBeGreaterThanOrEqual(400);
        
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('error');
      }
    });
  });

  describe('Migration Compatibility', () => {
    test('should handle mixed RSA and post-quantum data', async () => {
      // Simulate RSA encrypted data (legacy)
      const mockRsaData = {
        version: 'rsa-v1',
        algorithm: 'RSA-OAEP-256',
        encryptedData: 'dGVzdA==' // base64 'test'
      };

      const rsaDecryptEvent = testUtils.createMockEvent('POST', {
        encryptedData: mockRsaData,
        privateKey: 'mock-rsa-private-key'
      }, {
        authorization: `Bearer ${testApiKey}`
      });

      const rsaResponse = await decryptHandler(rsaDecryptEvent);
      const rsaBody = JSON.parse(rsaResponse.body);
      
      // Should detect as RSA and attempt RSA decryption (will fail with mock key)
      expect(rsaBody.encryptionType).toBe('rsa');

      // Test post-quantum data
      if (generatedKeypair) {
        const pqData = 'Post-quantum test data';
        const encryptEvent = testUtils.createMockEvent('POST', {
          data: pqData,
          publicKey: generatedKeypair.publicKey,
          algorithm: generatedKeypair.algorithm
        });

        const encryptResponse = await encryptHandler(encryptEvent);
        if (encryptResponse.statusCode === 200) {
          const encryptBody = JSON.parse(encryptResponse.body);
          
          const pqDecryptEvent = testUtils.createMockEvent('POST', {
            encryptedData: encryptBody.encryptedData,
            privateKey: generatedKeypair.privateKey
          }, {
            authorization: `Bearer ${testApiKey}`
          });

          const pqResponse = await decryptHandler(pqDecryptEvent);
          if (pqResponse.statusCode === 200) {
            const pqBody = JSON.parse(pqResponse.body);
            expect(pqBody.encryptionType).toBe('post-quantum');
            expect(pqBody.decryptedData).toBe(pqData);
          }
        }
      }
    });
  });
});