const PostQuantumCrypto = require('./crypto-utils');
const { RSAFallbackCrypto } = require('./crypto-utils');

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
        
        // Test post-quantum cryptography functionality
        let pqVerificationResult = {
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
            pqVerificationResult = await pqCrypto.verifyLibrary();
            
        } catch (initError) {
            console.error('Status check - OQS initialization failed:', initError.message);
            pqVerificationResult.errors.push(`OQS Initialization: ${initError.message}`);
            pqVerificationResult.errorCode = initError.code;
        }

        // Test RSA fallback functionality
        let rsaVerificationResult = {
            available: false,
            functional: false,
            errors: []
        };
        
        try {
            console.log('Testing RSA fallback functionality...');
            const rsaFallback = new RSAFallbackCrypto();
            
            // Test RSA key generation
            const testKeypair = await rsaFallback.generateKeypair('standard');
            if (!testKeypair || !testKeypair.publicKey || !testKeypair.privateKey) {
                throw new Error('RSA keypair generation returned invalid result');
            }
            
            // Test RSA encryption/decryption
            const testData = 'RSA fallback test data';
            const encrypted = await rsaFallback.encrypt(testData, testKeypair.publicKey);
            if (!encrypted || !encrypted.encryptedData) {
                throw new Error('RSA encryption returned invalid result');
            }
            
            const decrypted = await rsaFallback.decrypt(encrypted, testKeypair.privateKey);
            if (decrypted !== testData) {
                throw new Error('RSA decryption failed to recover original data');
            }
            
            rsaVerificationResult.available = true;
            rsaVerificationResult.functional = true;
            console.log('✅ RSA fallback verification passed');
            
        } catch (rsaError) {
            console.error('❌ RSA fallback verification failed:', rsaError.message);
            rsaVerificationResult.errors.push(`RSA Fallback: ${rsaError.message}`);
        }

        // Compile comprehensive status response
        const statusResponse = {
            timestamp: new Date().toISOString(),
            service: 'Post-Quantum Lattice Shield',
            version: 'pq-v1',
            oqs: {
                available: pqVerificationResult.available,
                functional: pqVerificationResult.functional,
                initialized: basicStatus.initialized,
                ready: basicStatus.ready,
                version: pqVerificationResult.version || 'unknown',
                supportedAlgorithms: pqVerificationResult.supportedAlgorithms.map(alg => ({
                    name: alg.algorithm,
                    level: alg.level,
                    functional: alg.functional,
                    keySize: alg.keySize,
                    error: alg.error
                }))
            },
            rsa: {
                available: rsaVerificationResult.available,
                functional: rsaVerificationResult.functional,
                algorithm: 'RSA-OAEP-256',
                keySize: 2048,
                description: 'Fallback encryption when post-quantum is unavailable'
            },
            algorithms: {
                'ML-KEM-768': {
                    available: pqVerificationResult.supportedAlgorithms.some(alg => 
                        alg.algorithm === 'ML-KEM-768' && alg.functional),
                    securityLevel: 'standard',
                    description: 'Recommended for most applications'
                },
                'ML-KEM-1024': {
                    available: pqVerificationResult.supportedAlgorithms.some(alg => 
                        alg.algorithm === 'ML-KEM-1024' && alg.functional),
                    securityLevel: 'high',
                    description: 'Maximum security for sensitive data'
                },
                'RSA-OAEP-256': {
                    available: rsaVerificationResult.functional,
                    securityLevel: 'standard',
                    description: 'Fallback algorithm for compatibility'
                }
            },
            health: {
                overall: (pqVerificationResult.functional || rsaVerificationResult.functional) ? 
                    (pqVerificationResult.functional ? 'healthy' : 'degraded') : 'unhealthy',
                issues: [...pqVerificationResult.errors, ...rsaVerificationResult.errors]
            },
            capabilities: {
                keyGeneration: pqVerificationResult.functional || rsaVerificationResult.functional,
                encryption: pqVerificationResult.functional || rsaVerificationResult.functional,
                decryption: pqVerificationResult.functional || rsaVerificationResult.functional,
                hybridEncryption: pqVerificationResult.functional,
                fallbackEncryption: rsaVerificationResult.functional,
                backwardCompatibility: true
            }
        };

        // Determine appropriate HTTP status code
        let httpStatus = 200;
        if (!pqVerificationResult.available && !rsaVerificationResult.available) {
            httpStatus = 503; // Service Unavailable - no cryptography available
        } else if (!pqVerificationResult.functional && !rsaVerificationResult.functional) {
            httpStatus = 503; // Service Unavailable - no functional cryptography
        } else if (!pqVerificationResult.functional && rsaVerificationResult.functional) {
            httpStatus = 206; // Partial Content - only fallback available
        } else if (pqVerificationResult.errors.length > 0 || rsaVerificationResult.errors.length > 0) {
            httpStatus = 206; // Partial Content - some issues but functional
        }

        return {
            statusCode: httpStatus,
            body: JSON.stringify(statusResponse, null, 2),
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Service-Health': statusResponse.health.overall,
                'X-OQS-Available': pqVerificationResult.available.toString(),
                'X-OQS-Functional': pqVerificationResult.functional.toString(),
                'X-RSA-Functional': rsaVerificationResult.functional.toString()
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