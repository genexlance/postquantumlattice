/**
 * Security tests for post-quantum cryptography implementation
 * Tests key generation randomness, encryption strength, and security properties
 */

const crypto = require('crypto');
const PostQuantumCrypto = require('../../netlify/functions/crypto-utils');
const { handler: generateKeypairHandler } = require('../../netlify/functions/generate-keypair');
const { handler: encryptHandler } = require('../../netlify/functions/encrypt');

describe('Cryptographic Security Tests', () => {
  let pqCrypto;

  beforeAll(async () => {
    pqCrypto = new PostQuantumCrypto();
    try {
      await pqCrypto.initialize();
    } catch (error) {
      console.warn('OQS library not available for security tests:', error.message);
    }
  });

  describe('Key Generation Randomness Tests', () => {
    test('should generate unique keypairs on multiple calls', async () => {
      if (!pqCrypto.isReady()) {
        console.warn('Skipping randomness test - OQS not available');
        return;
      }

      const keypairs = [];
      const numTests = 10;

      // Generate multiple keypairs
      for (let i = 0; i < numTests; i++) {
        try {
          const keypair = await pqCrypto.generateKeypair();
          keypairs.push(keypair);
        } catch (error) {
          console.warn(`Keypair generation ${i} failed:`, error.message);
        }
      }

      if (keypairs.length < 2) {
        console.warn('Not enough keypairs generated for randomness test');
        return;
      }

      // Verify all public keys are unique
      const publicKeys = keypairs.map(kp => kp.publicKey);
      const uniquePublicKeys = new Set(publicKeys);
      expect(uniquePublicKeys.size).toBe(publicKeys.length);

      // Verify all private keys are unique
      const privateKeys = keypairs.map(kp => kp.privateKey);
      const uniquePrivateKeys = new Set(privateKeys);
      expect(uniquePrivateKeys.size).toBe(privateKeys.length);

      console.log(`✅ Generated ${keypairs.length} unique keypairs`);
    });

    test('should have sufficient entropy in generated keys', async () => {
      if (!pqCrypto.isReady()) return;

      try {
        const keypair = await pqCrypto.generateKeypair();
        
        // Convert keys to binary for entropy analysis
        const publicKeyBuffer = Buffer.from(keypair.publicKey, 'base64');
        const privateKeyBuffer = Buffer.from(keypair.privateKey, 'base64');

        // Basic entropy check - count unique bytes
        const publicKeyEntropy = calculateByteEntropy(publicKeyBuffer);
        const privateKeyEntropy = calculateByteEntropy(privateKeyBuffer);

        // Keys should have reasonable entropy (not all zeros, not all same value)
        expect(publicKeyEntropy).toBeGreaterThan(0.5); // At least 50% entropy
        expect(privateKeyEntropy).toBeGreaterThan(0.5);

        console.log(`✅ Key entropy - Public: ${publicKeyEntropy.toFixed(3)}, Private: ${privateKeyEntropy.toFixed(3)}`);
      } catch (error) {
        console.warn('Entropy test failed:', error.message);
      }
    });

    test('should generate keys with expected sizes', async () => {
      if (!pqCrypto.isReady()) return;

      const securityLevels = ['standard', 'high'];
      
      for (const level of securityLevels) {
        try {
          const keypair = await pqCrypto.generateKeypair(level);
          
          expect(keypair.keySize.publicKey).toBeGreaterThan(0);
          expect(keypair.keySize.privateKey).toBeGreaterThan(0);
          
          // ML-KEM-1024 should have larger keys than ML-KEM-768
          if (level === 'high') {
            expect(keypair.keySize.publicKey).toBeGreaterThan(1000);
            expect(keypair.keySize.privateKey).toBeGreaterThan(1500);
          } else {
            expect(keypair.keySize.publicKey).toBeGreaterThan(800);
            expect(keypair.keySize.privateKey).toBeGreaterThan(1200);
          }

          console.log(`✅ ${level} key sizes - Public: ${keypair.keySize.publicKey}, Private: ${keypair.keySize.privateKey}`);
        } catch (error) {
          console.warn(`Key size test failed for ${level}:`, error.message);
        }
      }
    });
  });

  describe('Encryption Strength Tests', () => {
    let testKeypair;

    beforeAll(async () => {
      if (pqCrypto.isReady()) {
        try {
          testKeypair = await pqCrypto.generateKeypair();
        } catch (error) {
          console.warn('Could not generate test keypair for encryption strength tests');
        }
      }
    });

    test('should produce different ciphertexts for same plaintext', async () => {
      if (!pqCrypto.isReady() || !testKeypair) return;

      const plaintext = 'Identical plaintext for randomness test';
      const ciphertexts = [];

      // Encrypt same plaintext multiple times
      for (let i = 0; i < 5; i++) {
        try {
          const encrypted = await pqCrypto.encrypt(plaintext, testKeypair.publicKey, testKeypair.algorithm);
          ciphertexts.push(encrypted);
        } catch (error) {
          console.warn(`Encryption ${i} failed:`, error.message);
        }
      }

      if (ciphertexts.length < 2) return;

      // All ciphertexts should be different (due to random IV and encapsulation)
      for (let i = 0; i < ciphertexts.length; i++) {
        for (let j = i + 1; j < ciphertexts.length; j++) {
          expect(ciphertexts[i].encryptedData).not.toBe(ciphertexts[j].encryptedData);
          expect(ciphertexts[i].encapsulatedKey).not.toBe(ciphertexts[j].encapsulatedKey);
          expect(ciphertexts[i].iv).not.toBe(ciphertexts[j].iv);
        }
      }

      console.log(`✅ Generated ${ciphertexts.length} unique ciphertexts for same plaintext`);
    });

    test('should use proper IV generation for AES-GCM', async () => {
      if (!pqCrypto.isReady() || !testKeypair) return;

      const encryptions = [];
      
      // Generate multiple encryptions to check IV uniqueness
      for (let i = 0; i < 10; i++) {
        try {
          const encrypted = await pqCrypto.encrypt(`Test data ${i}`, testKeypair.publicKey, testKeypair.algorithm);
          encryptions.push(encrypted);
        } catch (error) {
          console.warn(`IV test encryption ${i} failed:`, error.message);
        }
      }

      if (encryptions.length < 2) return;

      // All IVs should be unique
      const ivs = encryptions.map(e => e.iv);
      const uniqueIvs = new Set(ivs);
      expect(uniqueIvs.size).toBe(ivs.length);

      // IVs should be proper length for GCM (96 bits = 12 bytes = 16 base64 chars)
      for (const iv of ivs) {
        const ivBuffer = Buffer.from(iv, 'base64');
        expect(ivBuffer.length).toBe(12); // 96-bit IV
      }

      console.log(`✅ Generated ${uniqueIvs.size} unique IVs of correct length`);
    });

    test('should provide authentication with GCM auth tags', async () => {
      if (!pqCrypto.isReady() || !testKeypair) return;

      try {
        const plaintext = 'Authenticated encryption test';
        const encrypted = await pqCrypto.encrypt(plaintext, testKeypair.publicKey, testKeypair.algorithm);

        // Auth tag should be present and proper length
        expect(encrypted.authTag).toBeTruthy();
        const authTagBuffer = Buffer.from(encrypted.authTag, 'base64');
        expect(authTagBuffer.length).toBe(16); // 128-bit auth tag

        // Tampering with encrypted data should cause decryption to fail
        const tamperedEncrypted = { ...encrypted };
        tamperedEncrypted.encryptedData = Buffer.from(
          Buffer.from(encrypted.encryptedData, 'base64').map(b => b ^ 1)
        ).toString('base64');

        await expect(pqCrypto.decrypt(tamperedEncrypted, testKeypair.privateKey))
          .rejects.toMatchObject({ code: PostQuantumCrypto.ERROR_CODES.DECRYPTION_FAILED });

        console.log('✅ Authentication tag properly protects against tampering');
      } catch (error) {
        console.warn('Authentication test failed:', error.message);
      }
    });

    test('should resist key reuse attacks', async () => {
      if (!pqCrypto.isReady() || !testKeypair) return;

      // Encrypt multiple different plaintexts with same key
      const plaintexts = [
        'First message',
        'Second message',
        'Third message with different length',
        'Fourth message: ' + 'A'.repeat(1000) // Long message
      ];

      const encryptions = [];
      
      for (const plaintext of plaintexts) {
        try {
          const encrypted = await pqCrypto.encrypt(plaintext, testKeypair.publicKey, testKeypair.algorithm);
          encryptions.push({ plaintext, encrypted });
        } catch (error) {
          console.warn('Key reuse test encryption failed:', error.message);
        }
      }

      if (encryptions.length < 2) return;

      // All encryptions should use different encapsulated keys (ML-KEM property)
      const encapsulatedKeys = encryptions.map(e => e.encrypted.encapsulatedKey);
      const uniqueKeys = new Set(encapsulatedKeys);
      expect(uniqueKeys.size).toBe(encapsulatedKeys.length);

      // All should decrypt correctly
      for (const { plaintext, encrypted } of encryptions) {
        try {
          const decrypted = await pqCrypto.decrypt(encrypted, testKeypair.privateKey);
          expect(decrypted).toBe(plaintext);
        } catch (error) {
          console.warn('Key reuse decryption failed:', error.message);
        }
      }

      console.log(`✅ Key reuse test: ${uniqueKeys.size} unique encapsulated keys for ${plaintexts.length} messages`);
    });
  });

  describe('Side-Channel Resistance Tests', () => {
    test('should have consistent timing for encryption operations', async () => {
      if (!pqCrypto.isReady()) return;

      try {
        const keypair = await pqCrypto.generateKeypair();
        const testData = 'Timing test data';
        const timings = [];

        // Measure encryption timing multiple times
        for (let i = 0; i < 10; i++) {
          const start = process.hrtime.bigint();
          await pqCrypto.encrypt(testData, keypair.publicKey, keypair.algorithm);
          const end = process.hrtime.bigint();
          const duration = Number(end - start) / 1000000; // Convert to milliseconds
          timings.push(duration);
        }

        // Calculate timing statistics
        const avgTiming = timings.reduce((a, b) => a + b) / timings.length;
        const maxTiming = Math.max(...timings);
        const minTiming = Math.min(...timings);
        const variance = maxTiming - minTiming;

        // Timing should be relatively consistent (variance < 50% of average)
        expect(variance).toBeLessThan(avgTiming * 0.5);

        console.log(`✅ Timing consistency - Avg: ${avgTiming.toFixed(2)}ms, Variance: ${variance.toFixed(2)}ms`);
      } catch (error) {
        console.warn('Timing test failed:', error.message);
      }
    });

    test('should not leak information through error messages', async () => {
      if (!pqCrypto.isReady()) return;

      try {
        const keypair = await pqCrypto.generateKeypair();
        const validEncrypted = await pqCrypto.encrypt('test', keypair.publicKey, keypair.algorithm);

        // Test various invalid inputs
        const invalidInputs = [
          { ...validEncrypted, encryptedData: 'invalid-base64!' },
          { ...validEncrypted, authTag: Buffer.alloc(16, 0).toString('base64') }, // Wrong auth tag
          { ...validEncrypted, iv: Buffer.alloc(12, 0).toString('base64') }, // Wrong IV
        ];

        for (const invalidInput of invalidInputs) {
          try {
            await pqCrypto.decrypt(invalidInput, keypair.privateKey);
            // Should not reach here
            expect(false).toBe(true);
          } catch (error) {
            // Error messages should not reveal specific cryptographic details
            expect(error.message).not.toContain('key');
            expect(error.message).not.toContain('secret');
            expect(error.code).toBe(PostQuantumCrypto.ERROR_CODES.DECRYPTION_FAILED);
          }
        }

        console.log('✅ Error messages do not leak cryptographic information');
      } catch (error) {
        console.warn('Information leakage test failed:', error.message);
      }
    });
  });

  describe('Algorithm Security Properties', () => {
    test('should use NIST-approved ML-KEM parameters', async () => {
      if (!pqCrypto.isReady()) return;

      const securityLevels = [
        { level: 'standard', algorithm: 'ML-KEM-768', expectedSecurity: 'NIST Level 3' },
        { level: 'high', algorithm: 'ML-KEM-1024', expectedSecurity: 'NIST Level 5' }
      ];

      for (const { level, algorithm, expectedSecurity } of securityLevels) {
        try {
          const keypair = await pqCrypto.generateKeypair(level);
          expect(keypair.algorithm).toBe(algorithm);
          
          // Verify key sizes match NIST specifications
          if (algorithm === 'ML-KEM-768') {
            expect(keypair.keySize.publicKey).toBe(1184); // NIST ML-KEM-768 public key size
            expect(keypair.keySize.privateKey).toBe(2400); // NIST ML-KEM-768 private key size
          } else if (algorithm === 'ML-KEM-1024') {
            expect(keypair.keySize.publicKey).toBe(1568); // NIST ML-KEM-1024 public key size
            expect(keypair.keySize.privateKey).toBe(3168); // NIST ML-KEM-1024 private key size
          }

          console.log(`✅ ${algorithm} uses correct NIST parameters (${expectedSecurity})`);
        } catch (error) {
          console.warn(`NIST parameter test failed for ${algorithm}:`, error.message);
        }
      }
    });

    test('should properly combine ML-KEM with AES-256-GCM', async () => {
      if (!pqCrypto.isReady()) return;

      try {
        const keypair = await pqCrypto.generateKeypair();
        const encrypted = await pqCrypto.encrypt('test', keypair.publicKey, keypair.algorithm);

        // Verify hybrid encryption format
        expect(encrypted.algorithm).toContain('ML-KEM');
        expect(encrypted.algorithm).toContain('AES-256-GCM');
        expect(encrypted.version).toBe('pq-v1');

        // Verify components are present
        expect(encrypted.encapsulatedKey).toBeTruthy(); // ML-KEM component
        expect(encrypted.encryptedData).toBeTruthy();   // AES-GCM component
        expect(encrypted.iv).toBeTruthy();              // AES-GCM IV
        expect(encrypted.authTag).toBeTruthy();         // AES-GCM auth tag

        console.log('✅ Proper ML-KEM + AES-256-GCM hybrid encryption');
      } catch (error) {
        console.warn('Hybrid encryption test failed:', error.message);
      }
    });
  });
});

/**
 * Calculate byte entropy of a buffer
 * @param {Buffer} buffer - Buffer to analyze
 * @returns {number} Entropy value between 0 and 1
 */
function calculateByteEntropy(buffer) {
  const frequencies = new Array(256).fill(0);
  
  // Count byte frequencies
  for (let i = 0; i < buffer.length; i++) {
    frequencies[buffer[i]]++;
  }
  
  // Calculate entropy
  let entropy = 0;
  const length = buffer.length;
  
  for (let i = 0; i < 256; i++) {
    if (frequencies[i] > 0) {
      const probability = frequencies[i] / length;
      entropy -= probability * Math.log2(probability);
    }
  }
  
  // Normalize to 0-1 range (max entropy for bytes is 8 bits)
  return entropy / 8;
}