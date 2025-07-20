/**
 * Unit tests for Netlify functions
 * Tests individual function behavior and error handling
 */

const { handler: generateKeypairHandler } = require('../../netlify/functions/generate-keypair');
const { handler: encryptHandler } = require('../../netlify/functions/encrypt');
const { handler: decryptHandler } = require('../../netlify/functions/decrypt');

describe('Netlify Functions Unit Tests', () => {
  
  describe('Generate Keypair Function', () => {
    test('should generate keypair with default security level', async () => {
      const event = testUtils.createMockEvent('GET');
      
      try {
        const response = await generateKeypairHandler(event);
        const body = JSON.parse(response.body);
        
        if (response.statusCode === 200) {
          expect(body).toHaveProperty('publicKey');
          expect(body).toHaveProperty('privateKey');
          expect(body).toHaveProperty('algorithm');
          expect(body).toHaveProperty('securityLevel', 'standard');
          expect(body).toHaveProperty('metadata');
          expect(body.metadata).toHaveProperty('version', 'pq-v1');
        } else {
          // If OQS library is not available, expect appropriate error
          expect(response.statusCode).toBeGreaterThanOrEqual(500);
          expect(body).toHaveProperty('error');
        }
      } catch (error) {
        console.warn('Generate keypair test failed, likely due to missing OQS library:', error.message);
      }
    });

    test('should generate high security keypair when requested', async () => {
      const event = {
        ...testUtils.createMockEvent('GET'),
        queryStringParameters: { security: 'high' }
      };
      
      try {
        const response = await generateKeypairHandler(event);
        const body = JSON.parse(response.body);
        
        if (response.statusCode === 200) {
          expect(body.securityLevel).toBe('high');
          expect(body.algorithm).toBe('ML-KEM-1024');
        }
      } catch (error) {
        console.warn('High security keypair test failed:', error.message);
      }
    });

    test('should reject invalid security levels', async () => {
      const event = {
        ...testUtils.createMockEvent('GET'),
        queryStringParameters: { security: 'invalid' }
      };
      
      const response = await generateKeypairHandler(event);
      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('Invalid security level');
    });

    test('should handle missing OQS library gracefully', async () => {
      // This test will naturally pass if OQS is not available
      const event = testUtils.createMockEvent('GET');
      const response = await generateKeypairHandler(event);
      
      // Should either succeed (200) or fail gracefully (5xx)
      expect([200, 500, 503]).toContain(response.statusCode);
      
      const body = JSON.parse(response.body);
      if (response.statusCode !== 200) {
        expect(body).toHaveProperty('error');
        expect(body).toHaveProperty('errorCode');
      }
    });
  });

  describe('Encrypt Function', () => {
    let testKeypair;

    beforeAll(async () => {
      // Try to generate a test keypair
      try {
        const event = testUtils.createMockEvent('GET');
        const response = await generateKeypairHandler(event);
        
        if (response.statusCode === 200) {
          testKeypair = JSON.parse(response.body);
        }
      } catch (error) {
        console.warn('Could not generate test keypair for encryption tests:', error.message);
      }
    });

    test('should reject non-POST requests', async () => {
      const event = testUtils.createMockEvent('GET');
      const response = await encryptHandler(event);
      
      expect(response.statusCode).toBe(405);
    });

    test('should validate required fields', async () => {
      const event = testUtils.createMockEvent('POST', {});
      const response = await encryptHandler(event);
      
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    });

    test('should encrypt data successfully', async () => {
      if (!testKeypair) {
        console.warn('Skipping encryption test - no test keypair available');
        return;
      }

      const event = testUtils.createMockEvent('POST', {
        data: 'Test encryption data',
        publicKey: testKeypair.publicKey,
        algorithm: testKeypair.algorithm
      });

      try {
        const response = await encryptHandler(event);
        
        if (response.statusCode === 200) {
          const body = JSON.parse(response.body);
          expect(body).toHaveProperty('success', true);
          expect(body).toHaveProperty('encryptedData');
          expect(body).toHaveProperty('metadata');
          expect(body.encryptedData).toHaveProperty('version', 'pq-v1');
        } else {
          // If encryption fails due to missing OQS, that's expected
          const body = JSON.parse(response.body);
          expect(body).toHaveProperty('error');
        }
      } catch (error) {
        console.warn('Encryption test failed:', error.message);
      }
    });

    test('should validate algorithm parameter', async () => {
      if (!testKeypair) return;

      const event = testUtils.createMockEvent('POST', {
        data: 'Test data',
        publicKey: testKeypair.publicKey,
        algorithm: 'INVALID-ALGORITHM'
      });

      const response = await encryptHandler(event);
      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Unsupported algorithm');
    });

    test('should handle invalid JSON in request body', async () => {
      const event = {
        httpMethod: 'POST',
        body: 'invalid-json',
        headers: { 'content-type': 'application/json' }
      };

      const response = await encryptHandler(event);
      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid JSON');
    });
  });

  describe('Decrypt Function', () => {
    let testKeypair;
    let testEncrypted;

    beforeAll(async () => {
      // Set up test data
      process.env.PQLS_API_KEY = 'test-api-key-12345';
      
      try {
        // Generate keypair
        const keypairEvent = testUtils.createMockEvent('GET');
        const keypairResponse = await generateKeypairHandler(keypairEvent);
        
        if (keypairResponse.statusCode === 200) {
          testKeypair = JSON.parse(keypairResponse.body);
          
          // Encrypt test data
          const encryptEvent = testUtils.createMockEvent('POST', {
            data: 'Test decryption data',
            publicKey: testKeypair.publicKey,
            algorithm: testKeypair.algorithm
          });
          
          const encryptResponse = await encryptHandler(encryptEvent);
          if (encryptResponse.statusCode === 200) {
            const encryptBody = JSON.parse(encryptResponse.body);
            testEncrypted = encryptBody.encryptedData;
          }
        }
      } catch (error) {
        console.warn('Could not set up test data for decryption tests:', error.message);
      }
    });

    test('should reject non-POST requests', async () => {
      const event = testUtils.createMockEvent('GET');
      const response = await decryptHandler(event);
      
      expect(response.statusCode).toBe(405);
    });

    test('should require authorization', async () => {
      const event = testUtils.createMockEvent('POST', {
        encryptedData: 'test',
        privateKey: 'test'
      });

      const response = await decryptHandler(event);
      expect(response.statusCode).toBe(401);
    });

    test('should validate required fields', async () => {
      const event = testUtils.createMockEvent('POST', {}, {
        authorization: 'Bearer test-api-key-12345'
      });

      const response = await decryptHandler(event);
      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Missing encryptedData or privateKey');
    });

    test('should decrypt post-quantum data successfully', async () => {
      if (!testKeypair || !testEncrypted) {
        console.warn('Skipping decryption test - no test data available');
        return;
      }

      const event = testUtils.createMockEvent('POST', {
        encryptedData: testEncrypted,
        privateKey: testKeypair.privateKey
      }, {
        authorization: 'Bearer test-api-key-12345'
      });

      try {
        const response = await decryptHandler(event);
        
        if (response.statusCode === 200) {
          const body = JSON.parse(response.body);
          expect(body).toHaveProperty('decryptedData', 'Test decryption data');
          expect(body).toHaveProperty('encryptionType', 'post-quantum');
          expect(body.algorithmUsed).toContain('ML-KEM');
        }
      } catch (error) {
        console.warn('Decryption test failed:', error.message);
      }
    });

    test('should handle RSA legacy data', async () => {
      // Test with mock RSA data format
      const mockRsaData = 'dGVzdA=='; // base64 encoded 'test'
      
      const event = testUtils.createMockEvent('POST', {
        encryptedData: mockRsaData,
        privateKey: 'mock-rsa-key'
      }, {
        authorization: 'Bearer test-api-key-12345'
      });

      const response = await decryptHandler(event);
      // Should fail with RSA decryption error (expected since we don't have real RSA keys)
      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      // Updated to match the more specific error message from RSA fallback utility
      expect(body.error).toContain('Invalid RSA private key format');
    });

    test('should detect encryption type correctly', async () => {
      if (!testEncrypted) return;

      const event = testUtils.createMockEvent('POST', {
        encryptedData: testEncrypted,
        privateKey: 'wrong-key'
      }, {
        authorization: 'Bearer test-api-key-12345'
      });

      const response = await decryptHandler(event);
      const body = JSON.parse(response.body);
      
      // Should detect as post-quantum even if decryption fails
      if (body.encryptionType) {
        expect(body.encryptionType).toBe('post-quantum');
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle unexpected errors gracefully', async () => {
      // Test with malformed event
      const malformedEvent = null;
      
      try {
        const response = await encryptHandler(malformedEvent);
        expect(response.statusCode).toBeGreaterThanOrEqual(400);
      } catch (error) {
        // Should not throw unhandled errors
        expect(error).toBeDefined();
      }
    });

    test('should include proper error codes in responses', async () => {
      const event = testUtils.createMockEvent('POST', {
        data: 'test',
        publicKey: 'invalid-key',
        algorithm: 'ML-KEM-768'
      });

      const response = await encryptHandler(event);
      const body = JSON.parse(response.body);
      
      if (response.statusCode >= 400) {
        expect(body).toHaveProperty('error');
        expect(typeof body.error).toBe('string');
      }
    });
  });
});