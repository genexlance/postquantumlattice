const crypto = require('crypto');

// Memory optimization for serverless environment
if (process.env.NODE_ENV === 'production') {
    // Optimize garbage collection for post-quantum operations
    if (global.gc) {
        setInterval(() => {
            if (process.memoryUsage().heapUsed > 268435456) {
                global.gc();
            }
        }, 30000); // Run GC every 30 seconds if memory usage is high
    }
    
    // Set memory limits for OQS operations
    process.env.OQS_MEMORY_LIMIT = '256';
    process.env.OQS_CACHE_SIZE = '32';
}

// Serverless optimization for post-quantum functions
if (typeof global !== 'undefined' && !global.__OQS_OPTIMIZED__) {
    global.__OQS_OPTIMIZED__ = true;
    
    // Memory management for serverless
    const originalMemoryUsage = process.memoryUsage;
    process.memoryUsage = function() {
        const usage = originalMemoryUsage();
        if (usage.heapUsed > 800 * 1024 * 1024) { // 800MB threshold
            if (global.gc) global.gc();
        }
        return usage;
    };
    
    // OQS library caching
    let oqsInstance = null;
    global.getOQSInstance = function() {
        if (!oqsInstance) {
            oqsInstance = require('oqs.js');
        }
        return oqsInstance;
    };
}

/**
 * Post-Quantum Cryptography utilities using Open Quantum Safe (OQS) library
 * Implements ML-KEM-768/1024 for key encapsulation and AES-256-GCM for data encryption
 */
class PostQuantumCrypto {
    static ERROR_CODES = {
        LIBRARY_NOT_INITIALIZED: 'LIBRARY_NOT_INITIALIZED',
        LIBRARY_LOAD_FAILED: 'LIBRARY_LOAD_FAILED',
        ALGORITHM_NOT_SUPPORTED: 'ALGORITHM_NOT_SUPPORTED',
        KEYPAIR_GENERATION_FAILED: 'KEYPAIR_GENERATION_FAILED',
        ENCAPSULATION_FAILED: 'ENCAPSULATION_FAILED',
        DECAPSULATION_FAILED: 'DECAPSULATION_FAILED',
        ENCRYPTION_FAILED: 'ENCRYPTION_FAILED',
        DECRYPTION_FAILED: 'DECRYPTION_FAILED',
        INVALID_INPUT: 'INVALID_INPUT',
        INVALID_KEY_FORMAT: 'INVALID_KEY_FORMAT',
        INVALID_DATA_FORMAT: 'INVALID_DATA_FORMAT'
    };
    constructor() {
        this.oqs = null;
        this.isInitialized = false;
        this.supportedAlgorithms = {
            'standard': 'ML-KEM-768',
            'high': 'ML-KEM-1024'
        };
    }

    /**
     * Initialize the OQS library and verify availability
     * @returns {Promise<boolean>} True if initialization successful
     */
    async initialize() {
        try {
            // Attempt to load OQS library
            try {
                this.oqs = require('oqs.js');
            } catch (loadError) {
                const error = new Error(`Failed to load OQS library: ${loadError.message}. Ensure 'oqs.js' package is installed.`);
                error.code = PostQuantumCrypto.ERROR_CODES.LIBRARY_LOAD_FAILED;
                throw error;
            }
            
            // Verify required algorithms are available
            let availableKEMs;
            try {
                availableKEMs = this.oqs.listKEMs();
            } catch (listError) {
                const error = new Error(`Failed to list available KEM algorithms: ${listError.message}`);
                error.code = PostQuantumCrypto.ERROR_CODES.LIBRARY_LOAD_FAILED;
                throw error;
            }

            const requiredAlgorithms = Object.values(this.supportedAlgorithms);
            const missingAlgorithms = [];
            
            for (const algorithm of requiredAlgorithms) {
                if (!availableKEMs.includes(algorithm)) {
                    missingAlgorithms.push(algorithm);
                }
            }

            if (missingAlgorithms.length > 0) {
                const error = new Error(`Required algorithms not available in OQS library: ${missingAlgorithms.join(', ')}. Available algorithms: ${availableKEMs.join(', ')}`);
                error.code = PostQuantumCrypto.ERROR_CODES.ALGORITHM_NOT_SUPPORTED;
                throw error;
            }
            
            this.isInitialized = true;
            console.log('OQS library initialized successfully');
            console.log('Available algorithms:', requiredAlgorithms);
            console.log('Library version:', this.oqs.version || 'unknown');
            
            return true;
        } catch (error) {
            console.error('Failed to initialize OQS library:', error.message);
            this.isInitialized = false;
            
            // Re-throw with error code if not already set
            if (!error.code) {
                error.code = PostQuantumCrypto.ERROR_CODES.LIBRARY_LOAD_FAILED;
            }
            throw error;
        }
    }

    /**
     * Verify if OQS library is properly initialized
     * @returns {boolean} True if initialized and ready
     */
    isReady() {
        return this.isInitialized && this.oqs !== null;
    }

    /**
     * Generate ML-KEM keypair
     * @param {string} securityLevel - 'standard' for ML-KEM-768 or 'high' for ML-KEM-1024
     * @returns {Promise<Object>} Keypair object with publicKey, privateKey, algorithm, and securityLevel
     */
    async generateKeypair(securityLevel = 'standard') {
        if (!this.isReady()) {
            const error = new Error('OQS library not initialized. Call initialize() first.');
            error.code = PostQuantumCrypto.ERROR_CODES.LIBRARY_NOT_INITIALIZED;
            throw error;
        }

        if (!securityLevel || typeof securityLevel !== 'string') {
            const error = new Error('Security level must be a non-empty string');
            error.code = PostQuantumCrypto.ERROR_CODES.INVALID_INPUT;
            throw error;
        }

        if (!this.supportedAlgorithms[securityLevel]) {
            const error = new Error(`Unsupported security level: ${securityLevel}. Supported levels: ${Object.keys(this.supportedAlgorithms).join(', ')}`);
            error.code = PostQuantumCrypto.ERROR_CODES.ALGORITHM_NOT_SUPPORTED;
            throw error;
        }

        const algorithm = this.supportedAlgorithms[securityLevel];

        try {
            console.log(`Generating ${algorithm} keypair...`);
            
            let keypair;
            try {
                keypair = this.oqs.kemKeypair(algorithm);
            } catch (oqsError) {
                const error = new Error(`OQS keypair generation failed: ${oqsError.message}`);
                error.code = PostQuantumCrypto.ERROR_CODES.KEYPAIR_GENERATION_FAILED;
                throw error;
            }
            
            if (!keypair || typeof keypair !== 'object') {
                const error = new Error('OQS library returned invalid keypair object');
                error.code = PostQuantumCrypto.ERROR_CODES.KEYPAIR_GENERATION_FAILED;
                throw error;
            }

            if (!keypair.publicKey || !keypair.secretKey) {
                const error = new Error('OQS library returned keypair with missing keys');
                error.code = PostQuantumCrypto.ERROR_CODES.KEYPAIR_GENERATION_FAILED;
                throw error;
            }

            if (!Buffer.isBuffer(keypair.publicKey) || !Buffer.isBuffer(keypair.secretKey)) {
                const error = new Error('OQS library returned keys in invalid format (expected Buffer)');
                error.code = PostQuantumCrypto.ERROR_CODES.KEYPAIR_GENERATION_FAILED;
                throw error;
            }

            return {
                publicKey: keypair.publicKey.toString('base64'),
                privateKey: keypair.secretKey.toString('base64'),
                algorithm: algorithm,
                securityLevel: securityLevel,
                keySize: {
                    publicKey: keypair.publicKey.length,
                    privateKey: keypair.secretKey.length
                },
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error(`Keypair generation failed for ${algorithm}:`, error.message);
            
            // Re-throw with error code if not already set
            if (!error.code) {
                error.code = PostQuantumCrypto.ERROR_CODES.KEYPAIR_GENERATION_FAILED;
            }
            throw error;
        }
    }

    /**
     * Encrypt data using ML-KEM + AES-256-GCM hybrid encryption
     * @param {string} data - Data to encrypt
     * @param {string} publicKeyBase64 - Base64 encoded ML-KEM public key
     * @param {string} algorithm - ML-KEM algorithm used
     * @returns {Promise<Object>} Encrypted data object
     */
    async encrypt(data, publicKeyBase64, algorithm) {
        if (!this.isReady()) {
            const error = new Error('OQS library not initialized. Call initialize() first.');
            error.code = PostQuantumCrypto.ERROR_CODES.LIBRARY_NOT_INITIALIZED;
            throw error;
        }

        // Input validation
        if (!data || typeof data !== 'string') {
            const error = new Error('Data must be a non-empty string');
            error.code = PostQuantumCrypto.ERROR_CODES.INVALID_INPUT;
            throw error;
        }

        if (!publicKeyBase64 || typeof publicKeyBase64 !== 'string') {
            const error = new Error('Public key must be a non-empty base64 string');
            error.code = PostQuantumCrypto.ERROR_CODES.INVALID_KEY_FORMAT;
            throw error;
        }

        if (!algorithm || typeof algorithm !== 'string') {
            const error = new Error('Algorithm must be specified');
            error.code = PostQuantumCrypto.ERROR_CODES.INVALID_INPUT;
            throw error;
        }

        if (!Object.values(this.supportedAlgorithms).includes(algorithm)) {
            const error = new Error(`Unsupported algorithm: ${algorithm}. Supported algorithms: ${Object.values(this.supportedAlgorithms).join(', ')}`);
            error.code = PostQuantumCrypto.ERROR_CODES.ALGORITHM_NOT_SUPPORTED;
            throw error;
        }

        try {
            // Convert base64 public key to buffer
            let publicKey;
            try {
                publicKey = Buffer.from(publicKeyBase64, 'base64');
            } catch (keyError) {
                const error = new Error(`Invalid base64 public key format: ${keyError.message}`);
                error.code = PostQuantumCrypto.ERROR_CODES.INVALID_KEY_FORMAT;
                throw error;
            }
            
            // Perform ML-KEM encapsulation to get shared secret
            console.log(`Performing ${algorithm} encapsulation...`);
            let encapsulationResult;
            try {
                encapsulationResult = this.oqs.encapsulate(algorithm, publicKey);
            } catch (encapError) {
                const error = new Error(`OQS encapsulation failed: ${encapError.message}`);
                error.code = PostQuantumCrypto.ERROR_CODES.ENCAPSULATION_FAILED;
                throw error;
            }
            
            if (!encapsulationResult || typeof encapsulationResult !== 'object') {
                const error = new Error('OQS library returned invalid encapsulation result');
                error.code = PostQuantumCrypto.ERROR_CODES.ENCAPSULATION_FAILED;
                throw error;
            }

            if (!encapsulationResult.sharedSecret || !encapsulationResult.ciphertext) {
                const error = new Error('OQS library returned incomplete encapsulation result');
                error.code = PostQuantumCrypto.ERROR_CODES.ENCAPSULATION_FAILED;
                throw error;
            }

            // Use shared secret as key for AES-256-GCM encryption
            const sharedSecret = encapsulationResult.sharedSecret;
            const encapsulatedKey = encapsulationResult.ciphertext;
            
            // Generate random IV for AES-GCM
            const iv = crypto.randomBytes(12); // 96-bit IV for GCM
            
            // Create AES-256-GCM cipher with proper key derivation
            let key, cipher, encrypted, authTag;
            try {
                key = crypto.createHash('sha256').update(sharedSecret).digest();
                cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
                cipher.setAAD(Buffer.from(algorithm)); // Use algorithm as additional authenticated data
                
                // Encrypt the data
                encrypted = cipher.update(data, 'utf8');
                encrypted = Buffer.concat([encrypted, cipher.final()]);
                
                // Get authentication tag
                authTag = cipher.getAuthTag();
            } catch (aesError) {
                const error = new Error(`AES-GCM encryption failed: ${aesError.message}`);
                error.code = PostQuantumCrypto.ERROR_CODES.ENCRYPTION_FAILED;
                throw error;
            }

            // Determine security level from algorithm
            const securityLevel = algorithm === 'ML-KEM-1024' ? 'high' : 'standard';

            return {
                version: 'pq-v1',
                algorithm: `${algorithm}+AES-256-GCM`,
                securityLevel: securityLevel,
                encapsulatedKey: encapsulatedKey.toString('base64'),
                encryptedData: encrypted.toString('base64'),
                iv: iv.toString('base64'),
                authTag: authTag.toString('base64'),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Encryption failed:', error.message);
            
            // Re-throw with error code if not already set
            if (!error.code) {
                error.code = PostQuantumCrypto.ERROR_CODES.ENCRYPTION_FAILED;
            }
            throw error;
        }
    }

    /**
     * Decrypt data using ML-KEM + AES-256-GCM hybrid decryption
     * @param {Object} encryptedData - Encrypted data object
     * @param {string} privateKeyBase64 - Base64 encoded ML-KEM private key
     * @returns {Promise<string>} Decrypted data
     */
    async decrypt(encryptedData, privateKeyBase64) {
        if (!this.isReady()) {
            const error = new Error('OQS library not initialized. Call initialize() first.');
            error.code = PostQuantumCrypto.ERROR_CODES.LIBRARY_NOT_INITIALIZED;
            throw error;
        }

        // Input validation
        if (!encryptedData || typeof encryptedData !== 'object') {
            const error = new Error('Encrypted data must be a non-null object');
            error.code = PostQuantumCrypto.ERROR_CODES.INVALID_DATA_FORMAT;
            throw error;
        }

        if (!privateKeyBase64 || typeof privateKeyBase64 !== 'string') {
            const error = new Error('Private key must be a non-empty base64 string');
            error.code = PostQuantumCrypto.ERROR_CODES.INVALID_KEY_FORMAT;
            throw error;
        }

        try {
            // Validate encrypted data format
            const requiredFields = ['version', 'algorithm', 'encapsulatedKey', 'encryptedData', 'iv', 'authTag'];
            const missingFields = [];
            
            for (const field of requiredFields) {
                if (!encryptedData[field] || typeof encryptedData[field] !== 'string') {
                    missingFields.push(field);
                }
            }

            if (missingFields.length > 0) {
                const error = new Error(`Missing or invalid required fields: ${missingFields.join(', ')}`);
                error.code = PostQuantumCrypto.ERROR_CODES.INVALID_DATA_FORMAT;
                throw error;
            }

            if (encryptedData.version !== 'pq-v1') {
                const error = new Error(`Unsupported data version: ${encryptedData.version}. Expected: pq-v1`);
                error.code = PostQuantumCrypto.ERROR_CODES.INVALID_DATA_FORMAT;
                throw error;
            }

            // Extract ML-KEM algorithm from combined algorithm string
            const algorithmParts = encryptedData.algorithm.split('+');
            if (algorithmParts.length < 2) {
                const error = new Error(`Invalid algorithm format: ${encryptedData.algorithm}. Expected format: ML-KEM-XXX+AES-256-GCM`);
                error.code = PostQuantumCrypto.ERROR_CODES.INVALID_DATA_FORMAT;
                throw error;
            }

            const kemAlgorithm = algorithmParts[0];
            
            if (!Object.values(this.supportedAlgorithms).includes(kemAlgorithm)) {
                const error = new Error(`Unsupported KEM algorithm: ${kemAlgorithm}. Supported algorithms: ${Object.values(this.supportedAlgorithms).join(', ')}`);
                error.code = PostQuantumCrypto.ERROR_CODES.ALGORITHM_NOT_SUPPORTED;
                throw error;
            }

            // Convert base64 strings to buffers with validation
            let privateKey, encapsulatedKey, iv, authTag, encrypted;
            try {
                privateKey = Buffer.from(privateKeyBase64, 'base64');
                encapsulatedKey = Buffer.from(encryptedData.encapsulatedKey, 'base64');
                iv = Buffer.from(encryptedData.iv, 'base64');
                authTag = Buffer.from(encryptedData.authTag, 'base64');
                encrypted = Buffer.from(encryptedData.encryptedData, 'base64');
            } catch (bufferError) {
                const error = new Error(`Invalid base64 encoding in encrypted data: ${bufferError.message}`);
                error.code = PostQuantumCrypto.ERROR_CODES.INVALID_DATA_FORMAT;
                throw error;
            }
            
            // Perform ML-KEM decapsulation to recover shared secret
            console.log(`Performing ${kemAlgorithm} decapsulation...`);
            let sharedSecret;
            try {
                sharedSecret = this.oqs.decapsulate(kemAlgorithm, encapsulatedKey, privateKey);
            } catch (decapError) {
                const error = new Error(`OQS decapsulation failed: ${decapError.message}`);
                error.code = PostQuantumCrypto.ERROR_CODES.DECAPSULATION_FAILED;
                throw error;
            }
            
            if (!sharedSecret || !Buffer.isBuffer(sharedSecret)) {
                const error = new Error('OQS library returned invalid shared secret');
                error.code = PostQuantumCrypto.ERROR_CODES.DECAPSULATION_FAILED;
                throw error;
            }

            // Decrypt using AES-256-GCM
            let key, decipher, decrypted;
            try {
                key = crypto.createHash('sha256').update(sharedSecret).digest();
                decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
                decipher.setAAD(Buffer.from(kemAlgorithm)); // Use algorithm as additional authenticated data
                decipher.setAuthTag(authTag);
                
                decrypted = decipher.update(encrypted);
                decrypted = Buffer.concat([decrypted, decipher.final()]);
            } catch (aesError) {
                const error = new Error(`AES-GCM decryption failed: ${aesError.message}. This may indicate data corruption or wrong private key.`);
                error.code = PostQuantumCrypto.ERROR_CODES.DECRYPTION_FAILED;
                throw error;
            }
            
            return decrypted.toString('utf8');
        } catch (error) {
            console.error('Decryption failed:', error.message);
            
            // Re-throw with error code if not already set
            if (!error.code) {
                error.code = PostQuantumCrypto.ERROR_CODES.DECRYPTION_FAILED;
            }
            throw error;
        }
    }

    /**
     * Detect encryption type from data format
     * @param {Object|string} data - Data to analyze
     * @returns {string} 'post-quantum' or 'rsa' or 'unknown'
     */
    detectEncryptionType(data) {
        try {
            // If data is a string, try to parse as JSON
            let parsedData = data;
            if (typeof data === 'string') {
                try {
                    parsedData = JSON.parse(data);
                } catch {
                    // If not JSON, might be base64 RSA encrypted data
                    return 'rsa';
                }
            }

            // Check for post-quantum format
            if (parsedData && typeof parsedData === 'object') {
                if (parsedData.version === 'pq-v1' && parsedData.algorithm && parsedData.encapsulatedKey) {
                    return 'post-quantum';
                }
                if (parsedData.version === 'rsa-v1' || parsedData.algorithm === 'RSA-OAEP-256') {
                    return 'rsa';
                }
            }

            return 'unknown';
        } catch (error) {
            console.error('Error detecting encryption type:', error.message);
            return 'unknown';
        }
    }

    /**
     * Verify OQS library availability and functionality
     * @returns {Promise<Object>} Verification result
     */
    async verifyLibrary() {
        const result = {
            available: false,
            functional: false,
            supportedAlgorithms: [],
            errors: []
        };

        try {
            // Check if library can be loaded
            if (!this.isReady()) {
                await this.initialize();
            }
            result.available = true;

            // Test basic functionality with each supported algorithm
            for (const [level, algorithm] of Object.entries(this.supportedAlgorithms)) {
                try {
                    console.log(`Verifying ${algorithm} functionality...`);
                    
                    // Test keypair generation
                    const keypair = this.oqs.kemKeypair(algorithm);
                    if (!keypair || !keypair.publicKey || !keypair.secretKey) {
                        throw new Error(`Invalid keypair generated for ${algorithm}`);
                    }

                    // Test encapsulation/decapsulation
                    const encResult = this.oqs.encapsulate(algorithm, keypair.publicKey);
                    if (!encResult || !encResult.sharedSecret || !encResult.ciphertext) {
                        throw new Error(`Invalid encapsulation result for ${algorithm}`);
                    }

                    const decResult = this.oqs.decapsulate(algorithm, encResult.ciphertext, keypair.secretKey);
                    if (!decResult || Buffer.compare(encResult.sharedSecret, decResult) !== 0) {
                        throw new Error(`Decapsulation failed for ${algorithm}`);
                    }

                    result.supportedAlgorithms.push({
                        level: level,
                        algorithm: algorithm,
                        functional: true,
                        keySize: {
                            publicKey: keypair.publicKey.length,
                            secretKey: keypair.secretKey.length
                        },
                        sharedSecretSize: encResult.sharedSecret.length,
                        ciphertextSize: encResult.ciphertext.length
                    });

                    console.log(`✅ ${algorithm} verification passed`);
                } catch (error) {
                    console.error(`❌ ${algorithm} verification failed:`, error.message);
                    result.errors.push(`${algorithm}: ${error.message}`);
                    result.supportedAlgorithms.push({
                        level: level,
                        algorithm: algorithm,
                        functional: false,
                        error: error.message
                    });
                }
            }

            result.functional = result.supportedAlgorithms.some(alg => alg.functional);
            
        } catch (error) {
            console.error('Library verification failed:', error.message);
            result.errors.push(`Library initialization: ${error.message}`);
        }

        return result;
    }

    /**
     * Get library status and information
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            ready: this.isReady(),
            supportedAlgorithms: this.supportedAlgorithms,
            availableKEMs: this.isReady() ? this.oqs.listKEMs() : [],
            version: 'pq-v1'
        };
    }
}

module.exports = PostQuantumCrypto;