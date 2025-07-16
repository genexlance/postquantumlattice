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

// Initialize post-quantum crypto instance
const pqCrypto = new PostQuantumCrypto();
let initializationPromise = null;

/**
 * Initialize OQS library with proper error handling
 * @returns {Promise<boolean>} True if initialization successful
 */
async function ensureInitialized() {
    if (pqCrypto.isReady()) {
        return true;
    }
    
    if (!initializationPromise) {
        initializationPromise = pqCrypto.initialize();
    }
    
    try {
        await initializationPromise;
        return true;
    } catch (error) {
        console.error('Failed to initialize post-quantum crypto:', error.message);
        initializationPromise = null; // Reset for retry
        throw error;
    }
}

/**
 * Performance monitoring utility
 */
class PerformanceMonitor {
    constructor(operationName) {
        this.operationName = operationName;
        this.startTime = process.hrtime.bigint();
        this.metrics = {};
    }
    
    mark(label) {
        this.metrics[label] = process.hrtime.bigint();
    }
    
    finish() {
        const endTime = process.hrtime.bigint();
        const totalDuration = Number(endTime - this.startTime) / 1000000; // Convert to milliseconds
        
        const result = {
            operation: this.operationName,
            totalDurationMs: Math.round(totalDuration * 100) / 100,
            phases: {}
        };
        
        let lastTime = this.startTime;
        for (const [label, time] of Object.entries(this.metrics)) {
            const phaseDuration = Number(time - lastTime) / 1000000;
            result.phases[label] = Math.round(phaseDuration * 100) / 100;
            lastTime = time;
        }
        
        console.log(`Performance [${this.operationName}]:`, JSON.stringify(result));
        return result;
    }
}

exports.handler = async (event) => {
    const monitor = new PerformanceMonitor('post-quantum-encryption');
    
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ error: 'Method Not Allowed' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    try {
        monitor.mark('request-parsing');
        
        // Parse and validate request
        let requestData;
        try {
            requestData = JSON.parse(event.body);
        } catch (parseError) {
            console.error('Request parsing error:', parseError.message);
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: 'Invalid JSON in request body',
                    details: parseError.message
                }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        const { data, publicKey, algorithm, securityLevel } = requestData;

        // Input validation
        if (!data || typeof data !== 'string') {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: 'Missing or invalid data field. Data must be a non-empty string.' 
                }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        if (!publicKey || typeof publicKey !== 'string') {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: 'Missing or invalid publicKey field. Public key must be a non-empty base64 string.' 
                }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        if (!algorithm || typeof algorithm !== 'string') {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: 'Missing or invalid algorithm field. Algorithm must be specified (ML-KEM-768 or ML-KEM-1024).' 
                }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        // Validate algorithm
        const supportedAlgorithms = ['ML-KEM-768', 'ML-KEM-1024'];
        if (!supportedAlgorithms.includes(algorithm)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: `Unsupported algorithm: ${algorithm}. Supported algorithms: ${supportedAlgorithms.join(', ')}` 
                }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        // Validate security level if provided
        const validSecurityLevels = ['standard', 'high'];
        const effectiveSecurityLevel = securityLevel || (algorithm === 'ML-KEM-1024' ? 'high' : 'standard');
        if (!validSecurityLevels.includes(effectiveSecurityLevel)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: `Invalid security level: ${effectiveSecurityLevel}. Valid levels: ${validSecurityLevels.join(', ')}` 
                }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        monitor.mark('initialization');
        
        // Ensure OQS library is initialized
        try {
            await ensureInitialized();
        } catch (initError) {
            console.error('OQS initialization failed:', initError.message, initError.code);
            
            let errorMessage = 'Post-quantum cryptography library is not available.';
            let statusCode = 500;
            
            if (initError.code === PostQuantumCrypto.ERROR_CODES.LIBRARY_LOAD_FAILED) {
                errorMessage = 'Post-quantum cryptography library failed to load. Please contact system administrator.';
            } else if (initError.code === PostQuantumCrypto.ERROR_CODES.ALGORITHM_NOT_SUPPORTED) {
                errorMessage = `Required encryption algorithms are not supported by the current library installation.`;
                statusCode = 503; // Service Unavailable
            }
            
            return {
                statusCode: statusCode,
                body: JSON.stringify({ 
                    error: errorMessage,
                    code: initError.code,
                    timestamp: new Date().toISOString()
                }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        monitor.mark('encryption-start');
        
        // Perform post-quantum encryption
        let encryptedResult;
        try {
            encryptedResult = await pqCrypto.encrypt(data, publicKey, algorithm);
        } catch (encryptError) {
            console.error('Post-quantum encryption failed:', encryptError.message, encryptError.code);
            
            let errorMessage = 'Encryption failed due to an internal error.';
            let statusCode = 500;
            
            if (encryptError.code === PostQuantumCrypto.ERROR_CODES.INVALID_KEY_FORMAT) {
                errorMessage = 'Invalid public key format. Please ensure the key is properly base64 encoded.';
                statusCode = 400;
            } else if (encryptError.code === PostQuantumCrypto.ERROR_CODES.ENCAPSULATION_FAILED) {
                errorMessage = 'Key encapsulation failed. This may indicate an incompatible or corrupted public key.';
                statusCode = 400;
            } else if (encryptError.code === PostQuantumCrypto.ERROR_CODES.ENCRYPTION_FAILED) {
                errorMessage = 'Data encryption failed during AES-GCM operation.';
            } else if (encryptError.code === PostQuantumCrypto.ERROR_CODES.ALGORITHM_NOT_SUPPORTED) {
                errorMessage = `Algorithm ${algorithm} is not supported by the current system configuration.`;
                statusCode = 400;
            }
            
            return {
                statusCode: statusCode,
                body: JSON.stringify({ 
                    error: errorMessage,
                    code: encryptError.code,
                    algorithm: algorithm,
                    timestamp: new Date().toISOString()
                }),
                headers: { 'Content-Type': 'application/json' }
            };
        }

        monitor.mark('response-preparation');
        
        // Prepare response with metadata
        const response = {
            success: true,
            encryptedData: encryptedResult,
            metadata: {
                algorithm: encryptedResult.algorithm,
                securityLevel: encryptedResult.securityLevel,
                version: encryptedResult.version,
                encryptedAt: encryptedResult.timestamp,
                dataSize: data.length,
                encryptedSize: encryptedResult.encryptedData.length
            }
        };

        const performanceMetrics = monitor.finish();
        
        // Log successful encryption with performance metrics
        console.log('Encryption successful:', {
            algorithm: encryptedResult.algorithm,
            securityLevel: encryptedResult.securityLevel,
            dataSize: data.length,
            performance: performanceMetrics
        });

        return {
            statusCode: 200,
            body: JSON.stringify(response),
            headers: { 
                'Content-Type': 'application/json',
                'X-Encryption-Algorithm': encryptedResult.algorithm,
                'X-Security-Level': encryptedResult.securityLevel,
                'X-Performance-Ms': performanceMetrics.totalDurationMs.toString()
            }
        };

    } catch (error) {
        const performanceMetrics = monitor.finish();
        
        console.error('Unexpected encryption error:', {
            message: error.message,
            stack: error.stack,
            performance: performanceMetrics
        });
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'An unexpected error occurred during encryption.',
                timestamp: new Date().toISOString(),
                requestId: event.headers?.['x-request-id'] || 'unknown'
            }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
}; 