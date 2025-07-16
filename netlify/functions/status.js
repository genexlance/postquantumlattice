const PostQuantumCrypto = require('./crypto-utils');

/**
 * Status endpoint for OQS library and post-quantum cryptography functionality
 * Provides system health information and algorithm availability
 */
exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ error: 'Method Not Allowed' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    try {
        const pqCrypto = new PostQuantumCrypto();
        
        // Get basic status information
        const basicStatus = pqCrypto.getStatus();
        
        // Attempt to initialize and verify library functionality
        let verificationResult = {
            available: false,
            functional: false,
            supportedAlgorithms: [],
            errors: []
        };
        
        try {
            if (!pqCrypto.isReady()) {
                await pqCrypto.initialize();
            }
            
            // Perform comprehensive library verification
            verificationResult = await pqCrypto.verifyLibrary();
            
        } catch (initError) {
            console.error('Status check - initialization failed:', initError.message);
            verificationResult.errors.push(`Initialization: ${initError.message}`);
            verificationResult.errorCode = initError.code;
        }

        // Compile comprehensive status response
        const statusResponse = {
            timestamp: new Date().toISOString(),
            service: 'Post-Quantum Lattice Shield',
            version: 'pq-v1',
            oqs: {
                available: verificationResult.available,
                functional: verificationResult.functional,
                initialized: basicStatus.initialized,
                ready: basicStatus.ready,
                version: verificationResult.version || 'unknown',
                supportedAlgorithms: verificationResult.supportedAlgorithms.map(alg => ({
                    name: alg.algorithm,
                    level: alg.level,
                    functional: alg.functional,
                    keySize: alg.keySize,
                    error: alg.error
                }))
            },
            algorithms: {
                'ML-KEM-768': {
                    available: verificationResult.supportedAlgorithms.some(alg => 
                        alg.algorithm === 'ML-KEM-768' && alg.functional),
                    securityLevel: 'standard',
                    description: 'Recommended for most applications'
                },
                'ML-KEM-1024': {
                    available: verificationResult.supportedAlgorithms.some(alg => 
                        alg.algorithm === 'ML-KEM-1024' && alg.functional),
                    securityLevel: 'high',
                    description: 'Maximum security for sensitive data'
                }
            },
            health: {
                overall: verificationResult.functional ? 'healthy' : 'degraded',
                issues: verificationResult.errors
            },
            capabilities: {
                keyGeneration: verificationResult.functional,
                encryption: verificationResult.functional,
                decryption: verificationResult.functional,
                hybridEncryption: verificationResult.functional,
                backwardCompatibility: true // RSA decryption always available
            }
        };

        // Determine appropriate HTTP status code
        let httpStatus = 200;
        if (!verificationResult.available) {
            httpStatus = 503; // Service Unavailable
        } else if (!verificationResult.functional) {
            httpStatus = 503; // Service Unavailable
        } else if (verificationResult.errors.length > 0) {
            httpStatus = 206; // Partial Content (some issues but functional)
        }

        return {
            statusCode: httpStatus,
            body: JSON.stringify(statusResponse, null, 2),
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Service-Health': statusResponse.health.overall,
                'X-OQS-Available': verificationResult.available.toString(),
                'X-OQS-Functional': verificationResult.functional.toString()
            }
        };

    } catch (error) {
        console.error('Status endpoint error:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                timestamp: new Date().toISOString(),
                service: 'Post-Quantum Lattice Shield',
                error: 'Status check failed',
                details: error.message,
                health: {
                    overall: 'unhealthy',
                    issues: [error.message]
                }
            }, null, 2),
            headers: { 
                'Content-Type': 'application/json',
                'X-Service-Health': 'unhealthy'
            }
        };
    }
};