const PostQuantumCrypto = require('./crypto-utils');

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
    const pqCrypto = new PostQuantumCrypto();
    
    try {
        // Initialize OQS library
        console.log('Initializing OQS library for key generation...');
        await pqCrypto.initialize();
        
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
        
        console.log(`Generating post-quantum keypair with security level: ${securityLevel}`);
        
        // Generate ML-KEM keypair
        const keypairResult = await pqCrypto.generateKeypair(securityLevel);
        
        // Log successful generation
        console.log(`Successfully generated ${keypairResult.algorithm} keypair`);
        console.log(`Key sizes - Public: ${keypairResult.keySize.publicKey} bytes, Private: ${keypairResult.keySize.privateKey} bytes`);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                publicKey: keypairResult.publicKey,
                privateKey: keypairResult.privateKey,
                algorithm: keypairResult.algorithm,
                securityLevel: keypairResult.securityLevel,
                keySize: keypairResult.keySize,
                generatedAt: keypairResult.generatedAt,
                metadata: {
                    version: 'pq-v1',
                    kemAlgorithm: keypairResult.algorithm,
                    dataEncryption: 'AES-256-GCM',
                    combinedAlgorithm: `${keypairResult.algorithm}+AES-256-GCM`
                }
            }),
        };
    } catch (error) {
        // Enhanced error handling with specific error codes
        console.error('Post-quantum key generation failed:', error);
        console.error('Error code:', error.code);
        console.error('Error stack:', error.stack);
        
        let statusCode = 500;
        let errorResponse = {
            error: 'Post-quantum key generation failed.',
            details: error.message,
            errorCode: error.code || 'UNKNOWN_ERROR',
            timestamp: new Date().toISOString()
        };
        
        // Provide specific error responses based on error type
        switch (error.code) {
            case PostQuantumCrypto.ERROR_CODES.LIBRARY_LOAD_FAILED:
                statusCode = 503;
                errorResponse.error = 'Post-quantum cryptography library unavailable.';
                errorResponse.details = 'The OQS library could not be loaded. Please ensure it is properly installed.';
                errorResponse.resolution = 'Contact system administrator to install the Open Quantum Safe library.';
                break;
                
            case PostQuantumCrypto.ERROR_CODES.ALGORITHM_NOT_SUPPORTED:
                statusCode = 503;
                errorResponse.error = 'Required post-quantum algorithms not available.';
                errorResponse.resolution = 'Update the OQS library to a version that supports ML-KEM-768 and ML-KEM-1024.';
                break;
                
            case PostQuantumCrypto.ERROR_CODES.KEYPAIR_GENERATION_FAILED:
                statusCode = 500;
                errorResponse.error = 'Keypair generation failed.';
                errorResponse.details = 'The post-quantum key generation process encountered an error.';
                errorResponse.resolution = 'Retry the request. If the problem persists, contact support.';
                break;
                
            case PostQuantumCrypto.ERROR_CODES.LIBRARY_NOT_INITIALIZED:
                statusCode = 500;
                errorResponse.error = 'Cryptography library initialization failed.';
                errorResponse.resolution = 'Retry the request. If the problem persists, contact support.';
                break;
                
            case PostQuantumCrypto.ERROR_CODES.INVALID_INPUT:
                statusCode = 400;
                errorResponse.error = 'Invalid input parameters.';
                break;
                
            default:
                errorResponse.error = 'An unexpected error occurred during post-quantum key generation.';
                errorResponse.resolution = 'Retry the request. If the problem persists, contact support.';
        }
        
        return {
            statusCode,
            body: JSON.stringify(errorResponse),
        };
    }
}; 