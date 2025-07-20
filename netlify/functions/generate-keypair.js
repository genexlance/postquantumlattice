const PostQuantumCrypto = require('./crypto-utils');
const { RSAFallbackCrypto } = require('./crypto-utils');

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

exports.handler = async (event) => {
    // Parse query parameters to determine security level
    const queryParams = event.queryStringParameters || {};
    const securityLevel = queryParams.security || queryParams.level || 'standard';
    
    // Validate security level parameter
    if (!['standard', 'high'].includes(securityLevel)) {
        console.error(`Invalid security level requested: ${securityLevel}`);
        return {
            statusCode: 400,
            body: JSON.stringify({
                error: 'Invalid security level parameter.',
                details: `Security level must be 'standard' (ML-KEM-768) or 'high' (ML-KEM-1024). Received: ${securityLevel}`,
                supportedLevels: ['standard', 'high']
            }),
        };
    }
    
    const pqCrypto = new PostQuantumCrypto();
    let keypairResult;
    let usedFallback = false;
    
    // Try post-quantum key generation first
    try {
        console.log('Initializing OQS library for key generation...');
        await pqCrypto.initialize();
        
        console.log(`Generating post-quantum keypair with security level: ${securityLevel}`);
        keypairResult = await pqCrypto.generateKeypair(securityLevel);
        
        console.log(`Successfully generated ${keypairResult.algorithm} keypair`);
        console.log(`Key sizes - Public: ${keypairResult.keySize.publicKey} bytes, Private: ${keypairResult.keySize.privateKey} bytes`);
        
    } catch (pqError) {
        console.warn('Post-quantum key generation failed, attempting RSA fallback:', pqError.message);
        console.warn('Error code:', pqError.code);
        
        // Attempt RSA fallback
        try {
            const rsaFallback = new RSAFallbackCrypto();
            console.log('Using RSA fallback for key generation...');
            
            keypairResult = await rsaFallback.generateKeypair(securityLevel);
            usedFallback = true;
            
            console.log('RSA fallback key generation successful');
            console.log(`Key sizes - Public: ${keypairResult.keySize.publicKey} bytes, Private: ${keypairResult.keySize.privateKey} bytes`);
            
        } catch (rsaError) {
            console.error('Both post-quantum and RSA key generation failed');
            console.error('Post-quantum error:', pqError.message, pqError.code);
            console.error('RSA fallback error:', rsaError.message, rsaError.code);
            
            // Determine the most appropriate error to return
            let statusCode = 500;
            let errorResponse = {
                error: 'Key generation failed - both post-quantum and RSA fallback unsuccessful.',
                details: {
                    postQuantumError: pqError.message,
                    rsaFallbackError: rsaError.message
                },
                errorCode: 'KEY_GENERATION_FAILED',
                timestamp: new Date().toISOString()
            };
            
            // Provide specific error responses based on error type
            if (pqError.code === PostQuantumCrypto.ERROR_CODES.LIBRARY_LOAD_FAILED) {
                statusCode = 503;
                errorResponse.error = 'Cryptography libraries are not available on this system.';
                errorResponse.resolution = 'Contact system administrator to install required cryptography libraries.';
            } else if (pqError.code === PostQuantumCrypto.ERROR_CODES.ALGORITHM_NOT_SUPPORTED) {
                statusCode = 503;
                errorResponse.error = 'Required cryptographic algorithms not available.';
                errorResponse.resolution = 'Update cryptography libraries to support required algorithms.';
            } else if (rsaError.code === RSAFallbackCrypto.ERROR_CODES.KEYPAIR_GENERATION_FAILED) {
                statusCode = 500;
                errorResponse.error = 'System cryptography failure - unable to generate any type of keys.';
                errorResponse.resolution = 'Contact system administrator - fundamental cryptography issue.';
            }
            
            return {
                statusCode,
                body: JSON.stringify(errorResponse),
            };
        }
    }
    
    // Prepare successful response
    const response = {
        publicKey: keypairResult.publicKey,
        privateKey: keypairResult.privateKey,
        algorithm: keypairResult.algorithm,
        securityLevel: keypairResult.securityLevel,
        keySize: keypairResult.keySize,
        generatedAt: keypairResult.generatedAt,
        fallbackUsed: usedFallback,
        metadata: {
            version: usedFallback ? 'rsa-v1' : 'pq-v1',
            kemAlgorithm: keypairResult.algorithm,
            dataEncryption: usedFallback ? 'RSA-OAEP-256' : 'AES-256-GCM',
            combinedAlgorithm: usedFallback ? keypairResult.algorithm : `${keypairResult.algorithm}+AES-256-GCM`,
            fallback: usedFallback
        }
    };
    
    return {
        statusCode: 200,
        body: JSON.stringify(response),
        headers: {
            'Content-Type': 'application/json',
            'X-Fallback-Used': usedFallback.toString(),
            'X-Algorithm': keypairResult.algorithm
        }
    };
}; 