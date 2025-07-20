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
const PostQuantumCrypto = require('./crypto-utils');
const { RSAFallbackCrypto } = require('./crypto-utils');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const apiKey = process.env.PQLS_API_KEY;
    if (!apiKey) {
        const errorBody = JSON.stringify({ error: "Server configuration error: PQLS_API_KEY is not set on the server." });
        console.error("Configuration Error: PQLS_API_KEY is not set.");
        return { statusCode: 500, body: errorBody };
    }

    const authHeader = event.headers.authorization;
    if (!authHeader || authHeader.split(' ')[1] !== apiKey) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    try {
        const { encryptedData, privateKey: privateKeyPem } = JSON.parse(event.body);

        if (!encryptedData || !privateKeyPem) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing encryptedData or privateKey' }) };
        }

        // Initialize post-quantum crypto utility
        const pqCrypto = new PostQuantumCrypto();
        
        // Detect encryption type
        const encryptionType = pqCrypto.detectEncryptionType(encryptedData);
        console.log(`Detected encryption type: ${encryptionType}`);

        let decryptedData;
        let algorithmUsed;

        if (encryptionType === 'post-quantum') {
            // Handle post-quantum encrypted data
            try {
                await pqCrypto.initialize();
                
                // Parse encrypted data if it's a string
                let parsedEncryptedData = encryptedData;
                if (typeof encryptedData === 'string') {
                    try {
                        parsedEncryptedData = JSON.parse(encryptedData);
                    } catch (parseError) {
                        console.error('Failed to parse post-quantum encrypted data:', parseError.message);
                        return {
                            statusCode: 400,
                            body: JSON.stringify({ 
                                error: 'Invalid post-quantum encrypted data format',
                                details: 'Data must be valid JSON object',
                                encryptionType: 'post-quantum'
                            })
                        };
                    }
                }

                decryptedData = await pqCrypto.decrypt(parsedEncryptedData, privateKeyPem);
                algorithmUsed = parsedEncryptedData.algorithm || 'ML-KEM+AES-256-GCM';
                
                console.log(`Successfully decrypted post-quantum data using ${algorithmUsed}`);
                
            } catch (pqError) {
                console.error('Post-quantum decryption failed:', pqError.message);
                
                // Provide specific error messages based on error codes
                let errorMessage = 'Post-quantum decryption failed';
                let statusCode = 500;
                
                if (pqError.code === PostQuantumCrypto.ERROR_CODES.LIBRARY_NOT_INITIALIZED || 
                    pqError.code === PostQuantumCrypto.ERROR_CODES.LIBRARY_LOAD_FAILED) {
                    errorMessage = 'Post-quantum cryptography library not available';
                    statusCode = 503; // Service Unavailable
                } else if (pqError.code === PostQuantumCrypto.ERROR_CODES.INVALID_DATA_FORMAT) {
                    errorMessage = 'Invalid post-quantum encrypted data format';
                    statusCode = 400; // Bad Request
                } else if (pqError.code === PostQuantumCrypto.ERROR_CODES.INVALID_KEY_FORMAT) {
                    errorMessage = 'Invalid post-quantum private key format';
                    statusCode = 400; // Bad Request
                } else if (pqError.code === PostQuantumCrypto.ERROR_CODES.DECAPSULATION_FAILED ||
                          pqError.code === PostQuantumCrypto.ERROR_CODES.DECRYPTION_FAILED) {
                    errorMessage = 'Decryption failed - invalid key or corrupted data';
                    statusCode = 400; // Bad Request
                } else if (pqError.code === PostQuantumCrypto.ERROR_CODES.ALGORITHM_NOT_SUPPORTED) {
                    errorMessage = 'Unsupported post-quantum algorithm';
                    statusCode = 400; // Bad Request
                }
                
                return {
                    statusCode: statusCode,
                    body: JSON.stringify({ 
                        error: errorMessage,
                        details: pqError.message,
                        encryptionType: 'post-quantum',
                        errorCode: pqError.code
                    })
                };
            }
            
        } else if (encryptionType === 'rsa' || encryptionType === 'unknown') {
            // Handle RSA encrypted data (legacy format and fallback)
            try {
                console.log('Attempting RSA decryption for data...');
                console.log('Encryption type detected:', encryptionType);
                
                const rsaFallback = new RSAFallbackCrypto();
                
                // Handle both direct base64 string and JSON object formats
                let rsaEncryptedData;
                if (typeof encryptedData === 'string') {
                    // Direct base64 string (legacy format)
                    console.log('Processing legacy base64 string format');
                    rsaEncryptedData = {
                        version: 'rsa-v1',
                        algorithm: 'RSA-OAEP-256',
                        encryptedData: encryptedData,
                        fallback: true
                    };
                } else if (typeof encryptedData === 'object' && encryptedData.encryptedData) {
                    // JSON object with encryptedData field
                    console.log('Processing RSA JSON object format');
                    rsaEncryptedData = encryptedData;
                } else {
                    throw new Error('Invalid RSA encrypted data format - expected base64 string or object with encryptedData field');
                }

                // Use RSA fallback utility for consistent error handling
                decryptedData = await rsaFallback.decrypt(rsaEncryptedData, privateKeyPem);
                algorithmUsed = 'RSA-OAEP-256';
                
                console.log('Successfully decrypted RSA data using fallback utility');
                
            } catch (rsaError) {
                console.error('RSA decryption failed:', rsaError.message);
                console.error('RSA error code:', rsaError.code);
                
                // Provide specific error messages based on error codes
                let errorMessage = 'RSA decryption failed';
                let statusCode = 400;
                
                if (rsaError.code === RSAFallbackCrypto.ERROR_CODES.INVALID_KEY_FORMAT) {
                    errorMessage = 'Invalid RSA private key format';
                    statusCode = 400;
                } else if (rsaError.code === RSAFallbackCrypto.ERROR_CODES.INVALID_DATA_FORMAT) {
                    errorMessage = 'Invalid RSA encrypted data format';
                    statusCode = 400;
                } else if (rsaError.code === RSAFallbackCrypto.ERROR_CODES.DECRYPTION_FAILED) {
                    errorMessage = 'RSA decryption failed - invalid key or corrupted data';
                    statusCode = 400;
                } else if (encryptionType === 'unknown') {
                    errorMessage = 'Unable to decrypt data - unrecognized format and RSA decryption failed';
                    statusCode = 400;
                }
                
                return {
                    statusCode: statusCode,
                    body: JSON.stringify({ 
                        error: errorMessage,
                        details: rsaError.message,
                        encryptionType: encryptionType,
                        errorCode: rsaError.code,
                        suggestion: 'Verify that the correct private key is being used and data is not corrupted'
                    })
                };
            }
        } else {
            // Unrecognized format
            console.error('Unrecognized encryption format:', encryptionType);
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: 'Unrecognized encryption format',
                    details: 'Data does not match known RSA or post-quantum encryption formats',
                    encryptionType: encryptionType
                })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                decryptedData: decryptedData,
                algorithmUsed: algorithmUsed,
                encryptionType: encryptionType
            }),
        };
        
    } catch (error) {
        console.error('Unexpected decryption error:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ 
                error: 'An unexpected error occurred during decryption',
                details: error.message 
            }) 
        };
    }
};
