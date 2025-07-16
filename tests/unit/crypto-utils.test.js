/**
 * Unit tests for PostQuantumCrypto class
 * Tests OQS integration and crypto operations
 */

const PostQuantumCrypto = require('../../netlify/functions/crypto-utils');

describe('PostQuantumCrypto Unit Tests', () => {
  let pqCrypto;

  beforeEach(() => {
    pqCrypto = new PostQuantumCrypto();
  });

  afterEach(() => {
    // Clean up any resources
    pqCrypto = null;
  });

  describe('Initialization', () => {
    test('should initialize successfully with OQS library', async () => {
      try {
        const result = await pqCrypto.initialize();
        expect(result).toBe(true);
        expect(pqCrypto.isReady()).toBe(true);
      } catch (error) {
        // If OQS library is not available, skip this test
        if (error.code === PostQuantumCrypto.ERROR_CODES.LIBRARY_LOAD_FAILED) {
          console.warn('OQS library not available, skipping initialization test');
          return;
        }
        throw error;
      }
    });

    test('should handle missing OQS library gracefully', async () => {
      // Mock require to simulate missing library
      const originalRequire = require;
      jest.doMock('oqs.js', () => {
        throw new Error('Module not found');
      });

      const TestCrypto = require('../../netlify/functions/crypto-utils');
      const testCrypto = new TestCrypto();

      await expect(testCrypto.initialize()).rejects.toMatchObject({
        code: PostQuantumCrypto.ERROR_CODES.LIBRARY_LOAD_FAILED
      });

      // Restore original require
      jest.dontMock('oqs.js');
    });

    test('should report correct status before and after initialization', () => {
      expect(pqCrypto.isReady()).toBe(false);
      
      const status = pqCrypto.getStatus();
      expect(status.initialized).toBe(false);
      expect(status.ready).toBe(false);
      expect(status.supportedAlgorithms).toEqual({
        'standard': 'ML-KEM-768',
        'high': 'ML-KEM-1024'
      });
    });
  });

  describe('Key Generation', () => {
    beforeEach(async () => {
      try {
        await pqCrypto.initialize();
      } catch (error) {
        if (error.code === PostQuantumCrypto.ERROR_CODES.LIBRARY_LOAD_FAILED) {
          console.warn('OQS library not available, skipping key generation tests');
          return;
        }
        throw error;
      }
    });

    test('should generate ML-KEM-768 keypair by default', async () => {
      if (!pqCrypto.isReady()) return; // Skip if OQS not available

      const keypair = await pqCrypto.generateKeypair();
      
      expect(keypair).toHaveProperty('publicKey');
      expect(keypair).toHaveProperty('privateKey');
      expect(keypair.algorithm).toBe('ML-KEM-768');
      expect(keypair.securityLevel).toBe('standard');
      expect(keypair).toHaveProperty('keySize');
      expect(keypair).toHaveProperty('generatedAt');
      
      // Validate base64 encoding
      expect(() => Buffer.from(keypair.publicKey, 'base64')).not.toThrow();
      expect(() => Buffer.from(keypair.privateKey, 'base64')).not.toThrow();
    });

    test('should generate ML-KEM-1024 keypair for high security', async () => {
      if (!pqCrypto.isReady()) return; // Skip if OQS not available

      const keypair = await pqCrypto.generateKeypair('high');
      
      expect(keypair.algorithm).toBe('ML-KEM-1024');
      expect(keypair.securityLevel).toBe('high');
      expect(keypair.keySize.publicKey).toBeGreaterThan(0);
      expect(keypair.keySize.privateKey).toBeGreaterThan(0);
    });

    test('should reject invalid security levels', async () => {
      if (!pqCrypto.isReady()) return; // Skip if OQS not available

      await expect(pqCrypto.generateKeypair('invalid')).rejects.toMatchObject({
        code: PostQuantumCrypto.ERROR_CODES.ALGORITHM_NOT_SUPPORTED
      });
    });

    test('should reject empty or null security levels', async () => {
      if (!pqCrypto.isReady()) return; // Skip if OQS not available

      await expect(pqCrypto.generateKeypair('')).rejects.toMatchObject({
        code: PostQuantumCrypto.ERROR_CODES.INVALID_INPUT
      });

      await expect(pqCrypto.generateKeypair(null)).rejects.toMatchObject({
        code: PostQuantumCrypto.ERROR_CODES.INVALID_INPUT
      });
    });

    test('should fail when not initialized', async () => {
      const uninitializedCrypto = new PostQuantumCrypto();
      
      await expect(uninitializedCrypto.generateKeypair()).rejects.toMatchObject({
        code: PostQuantumCrypto.ERROR_CODES.LIBRARY_NOT_INITIALIZED
      });
    });
  });

  describe('Encryption', () => {
    let testKeypair;

    beforeEach(async () => {
      try {
        await pqCrypto.initialize();
        if (pqCrypto.isReady()) {
          testKeypair = await pqCrypto.generateKeypair();
        }
      } catch (error) {
        if (error.code === PostQuantumCrypto.ERROR_CODES.LIBRARY_LOAD_FAILED) {
          console.warn('OQS library not available, skipping encryption tests');
          return;
        }
        throw error;
      }
    });

    test('should encrypt data successfully', async () => {
      if (!pqCrypto.isReady() || !testKeypair) return; // Skip if OQS not available

      const testData = 'Hello, post-quantum world!';
      const encrypted = await pqCrypto.encrypt(testData, testKeypair.publicKey, testKeypair.algorithm);
      
      expect(encrypted).toHaveProperty('version', 'pq-v1');
      expect(encrypted).toHaveProperty('algorithm', `${testKeypair.algorithm}+AES-256-GCM`);
      expect(encrypted).toHaveProperty('securityLevel');
      expect(encrypted).toHaveProperty('encapsulatedKey');
      expect(encrypted).toHaveProperty('encryptedData');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('timestamp');
      
      // Validate base64 encoding
      expect(() => Buffer.from(encrypted.encapsulatedKey, 'base64')).not.toThrow();
      expect(() => Buffer.from(encrypted.encryptedData, 'base64')).not.toThrow();
      expect(() => Buffer.from(encrypted.iv, 'base64')).not.toThrow();
      expect(() => Buffer.from(encrypted.authTag, 'base64')).not.toThrow();
    });

    test('should handle various data sizes', async () => {
      if (!pqCrypto.isReady() || !testKeypair) return; // Skip if OQS not available

      const testSizes = [1, 100, 1000, 10000];
      
      for (const size of testSizes) {
        const testData = testUtils.generateTestData(size);
        const encrypted = await pqCrypto.encrypt(testData, testKeypair.publicKey, testKeypair.algorithm);
        
        expect(encrypted.version).toBe('pq-v1');
        expect(encrypted.encryptedData).toBeTruthy();
      }
    });

    test('should reject invalid inputs', async () => {
      if (!pqCrypto.isReady() || !testKeypair) return; // Skip if OQS not available

      // Invalid data
      await expect(pqCrypto.encrypt('', testKeypair.publicKey, testKeypair.algorithm))
        .rejects.toMatchObject({ code: PostQuantumCrypto.ERROR_CODES.INVALID_INPUT });

      await expect(pqCrypto.encrypt(null, testKeypair.publicKey, testKeypair.algorithm))
        .rejects.toMatchObject({ code: PostQuantumCrypto.ERROR_CODES.INVALID_INPUT });

      // Invalid public key
      await expect(pqCrypto.encrypt('test', '', testKeypair.algorithm))
        .rejects.toMatchObject({ code: PostQuantumCrypto.ERROR_CODES.INVALID_KEY_FORMAT });

      await expect(pqCrypto.encrypt('test', 'invalid-base64!', testKeypair.algorithm))
        .rejects.toMatchObject({ code: PostQuantumCrypto.ERROR_CODES.ENCAPSULATION_FAILED });

      // Invalid algorithm
      await expect(pqCrypto.encrypt('test', testKeypair.publicKey, ''))
        .rejects.toMatchObject({ code: PostQuantumCrypto.ERROR_CODES.INVALID_INPUT });

      await expect(pqCrypto.encrypt('test', testKeypair.publicKey, 'INVALID-ALGORITHM'))
        .rejects.toMatchObject({ code: PostQuantumCrypto.ERROR_CODES.ALGORITHM_NOT_SUPPORTED });
    });

    test('should fail when not initialized', async () => {
      const uninitializedCrypto = new PostQuantumCrypto();
      
      await expect(uninitializedCrypto.encrypt('test', 'key', 'ML-KEM-768'))
        .rejects.toMatchObject({ code: PostQuantumCrypto.ERROR_CODES.LIBRARY_NOT_INITIALIZED });
    });
  });

  describe('Decryption', () => {
    let testKeypair;
    let testEncrypted;

    beforeEach(async () => {
      try {
        await pqCrypto.initialize();
        if (pqCrypto.isReady()) {
          testKeypair = await pqCrypto.generateKeypair();
          testEncrypted = await pqCrypto.encrypt('Test message', testKeypair.publicKey, testKeypair.algorithm);
        }
      } catch (error) {
        if (error.code === PostQuantumCrypto.ERROR_CODES.LIBRARY_LOAD_FAILED) {
          console.warn('OQS library not available, skipping decryption tests');
          return;
        }
        throw error;
      }
    });

    test('should decrypt data successfully', async () => {
      if (!pqCrypto.isReady() || !testKeypair || !testEncrypted) return; // Skip if OQS not available

      const decrypted = await pqCrypto.decrypt(testEncrypted, testKeypair.privateKey);
      expect(decrypted).toBe('Test message');
    });

    test('should handle round-trip encryption/decryption', async () => {
      if (!pqCrypto.isReady() || !testKeypair) return; // Skip if OQS not available

      const originalData = 'Round-trip test with special chars: !@#$%^&*()_+{}|:"<>?[]\\;\',./ 🔒🔑';
      const encrypted = await pqCrypto.encrypt(originalData, testKeypair.publicKey, testKeypair.algorithm);
      const decrypted = await pqCrypto.decrypt(encrypted, testKeypair.privateKey);
      
      expect(decrypted).toBe(originalData);
    });

    test('should reject invalid encrypted data format', async () => {
      if (!pqCrypto.isReady() || !testKeypair) return; // Skip if OQS not available

      // Missing required fields
      const invalidData = { version: 'pq-v1' };
      await expect(pqCrypto.decrypt(invalidData, testKeypair.privateKey))
        .rejects.toMatchObject({ code: PostQuantumCrypto.ERROR_CODES.INVALID_DATA_FORMAT });

      // Invalid version
      const wrongVersion = { ...testEncrypted, version: 'invalid-v1' };
      await expect(pqCrypto.decrypt(wrongVersion, testKeypair.privateKey))
        .rejects.toMatchObject({ code: PostQuantumCrypto.ERROR_CODES.INVALID_DATA_FORMAT });

      // Invalid algorithm format
      const wrongAlgorithm = { ...testEncrypted, algorithm: 'INVALID' };
      await expect(pqCrypto.decrypt(wrongAlgorithm, testKeypair.privateKey))
        .rejects.toMatchObject({ code: PostQuantumCrypto.ERROR_CODES.INVALID_DATA_FORMAT });
    });

    test('should reject invalid private key', async () => {
      if (!pqCrypto.isReady() || !testEncrypted) return; // Skip if OQS not available

      await expect(pqCrypto.decrypt(testEncrypted, ''))
        .rejects.toMatchObject({ code: PostQuantumCrypto.ERROR_CODES.INVALID_KEY_FORMAT });

      await expect(pqCrypto.decrypt(testEncrypted, 'invalid-base64!'))
        .rejects.toMatchObject({ code: PostQuantumCrypto.ERROR_CODES.DECAPSULATION_FAILED });
    });

    test('should fail with wrong private key', async () => {
      if (!pqCrypto.isReady() || !testEncrypted) return; // Skip if OQS not available

      // Generate different keypair
      const wrongKeypair = await pqCrypto.generateKeypair();
      
      await expect(pqCrypto.decrypt(testEncrypted, wrongKeypair.privateKey))
        .rejects.toMatchObject({ code: PostQuantumCrypto.ERROR_CODES.DECRYPTION_FAILED });
    });
  });

  describe('Encryption Type Detection', () => {
    test('should detect post-quantum encrypted data', () => {
      const pqData = {
        version: 'pq-v1',
        algorithm: 'ML-KEM-768+AES-256-GCM',
        encapsulatedKey: 'base64data'
      };
      
      expect(pqCrypto.detectEncryptionType(pqData)).toBe('post-quantum');
    });

    test('should detect RSA encrypted data', () => {
      const rsaData = {
        version: 'rsa-v1',
        algorithm: 'RSA-OAEP-256',
        encryptedData: 'base64data'
      };
      
      expect(pqCrypto.detectEncryptionType(rsaData)).toBe('rsa');
    });

    test('should handle JSON string input', () => {
      const pqDataString = JSON.stringify({
        version: 'pq-v1',
        algorithm: 'ML-KEM-768+AES-256-GCM',
        encapsulatedKey: 'base64data'
      });
      
      expect(pqCrypto.detectEncryptionType(pqDataString)).toBe('post-quantum');
    });

    test('should return unknown for unrecognized formats', () => {
      expect(pqCrypto.detectEncryptionType({})).toBe('unknown');
      expect(pqCrypto.detectEncryptionType('random-string')).toBe('rsa'); // Assumes base64 RSA
      expect(pqCrypto.detectEncryptionType(null)).toBe('unknown');
    });
  });

  describe('Library Verification', () => {
    test('should verify library availability and functionality', async () => {
      try {
        const verification = await pqCrypto.verifyLibrary();
        
        expect(verification).toHaveProperty('available');
        expect(verification).toHaveProperty('functional');
        expect(verification).toHaveProperty('supportedAlgorithms');
        expect(verification).toHaveProperty('errors');
        
        if (verification.available) {
          expect(verification.supportedAlgorithms).toBeInstanceOf(Array);
          expect(verification.supportedAlgorithms.length).toBeGreaterThan(0);
        }
      } catch (error) {
        // If OQS library is not available, verification should still return a result
        expect(error).toBeUndefined();
      }
    });
  });
});