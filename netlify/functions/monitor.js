const PostQuantumCrypto = require('./crypto-utils');

/**
 * Migration and Performance Monitoring Function
 * Provides system performance metrics and migration monitoring capabilities
 */
exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const startTime = Date.now();
        const crypto = new PostQuantumCrypto();
        
        // Initialize crypto library
        await crypto.initialize();
        
        const method = event.httpMethod;
        const path = event.path;
        const queryParams = event.queryStringParameters || {};
        
        let response;
        
        if (method === 'GET') {
            // Handle monitoring requests
            const action = queryParams.action || 'status';
            
            switch (action) {
                case 'status':
                    response = await getSystemStatus(crypto);
                    break;
                case 'performance':
                    response = await getPerformanceMetrics(crypto, queryParams);
                    break;
                case 'health':
                    response = await getHealthCheck(crypto);
                    break;
                default:
                    throw new Error(`Unknown monitoring action: ${action}`);
            }
        } else if (method === 'POST') {
            // Handle performance testing requests
            const body = JSON.parse(event.body || '{}');
            const action = body.action || 'benchmark';
            
            switch (action) {
                case 'benchmark':
                    response = await runPerformanceBenchmark(crypto, body);
                    break;
                case 'stress-test':
                    response = await runStressTest(crypto, body);
                    break;
                case 'migration-test':
                    response = await runMigrationTest(crypto, body);
                    break;
                default:
                    throw new Error(`Unknown performance action: ${action}`);
            }
        } else {
            throw new Error(`Unsupported HTTP method: ${method}`);
        }
        
        const processingTime = Date.now() - startTime;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: response,
                performance: {
                    processing_time_ms: processingTime,
                    timestamp: new Date().toISOString()
                }
            })
        };
        
    } catch (error) {
        console.error('Monitor function error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};

/**
 * Get comprehensive system status
 */
async function getSystemStatus(crypto) {
    const status = {
        timestamp: new Date().toISOString(),
        system: {
            node_version: process.version,
            memory_usage: process.memoryUsage(),
            uptime: process.uptime()
        },
        crypto: {
            initialized: crypto.isReady(),
            supported_algorithms: crypto.supportedAlgorithms,
            library_status: crypto.getStatus()
        }
    };
    
    // Verify library functionality
    try {
        const verification = await crypto.verifyLibrary();
        status.crypto.verification = verification;
    } catch (error) {
        status.crypto.verification_error = error.message;
    }
    
    return status;
}

/**
 * Get performance metrics
 */
async function getPerformanceMetrics(crypto, params) {
    const iterations = parseInt(params.iterations) || 10;
    const algorithm = params.algorithm || 'standard';
    
    const metrics = {
        timestamp: new Date().toISOString(),
        test_parameters: {
            iterations,
            algorithm,
            data_size: 1024 // 1KB test data
        },
        results: {
            keypair_generation: [],
            encryption: [],
            decryption: [],
            memory_usage: []
        }
    };
    
    const testData = 'A'.repeat(1024); // 1KB of test data
    
    for (let i = 0; i < iterations; i++) {
        const iterationStart = Date.now();
        const memoryBefore = process.memoryUsage();
        
        try {
            // Test keypair generation
            const keypairStart = Date.now();
            const keypair = await crypto.generateKeypair(algorithm);
            const keypairTime = Date.now() - keypairStart;
            metrics.results.keypair_generation.push(keypairTime);
            
            // Test encryption
            const encryptStart = Date.now();
            const encrypted = await crypto.encrypt(testData, keypair.publicKey, keypair.algorithm);
            const encryptTime = Date.now() - encryptStart;
            metrics.results.encryption.push(encryptTime);
            
            // Test decryption
            const decryptStart = Date.now();
            const decrypted = await crypto.decrypt(encrypted, keypair.privateKey);
            const decryptTime = Date.now() - decryptStart;
            metrics.results.decryption.push(decryptTime);
            
            // Verify data integrity
            if (decrypted !== testData) {
                throw new Error(`Data integrity check failed on iteration ${i + 1}`);
            }
            
            const memoryAfter = process.memoryUsage();
            metrics.results.memory_usage.push({
                iteration: i + 1,
                memory_delta: {
                    rss: memoryAfter.rss - memoryBefore.rss,
                    heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
                    heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal
                }
            });
            
        } catch (error) {
            metrics.results.errors = metrics.results.errors || [];
            metrics.results.errors.push({
                iteration: i + 1,
                error: error.message
            });
        }
    }
    
    // Calculate statistics
    metrics.statistics = calculateStatistics(metrics.results);
    
    return metrics;
}

/**
 * Get health check information
 */
async function getHealthCheck(crypto) {
    const health = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        checks: {}
    };
    
    try {
        // Check crypto library initialization
        health.checks.crypto_initialization = {
            status: crypto.isReady() ? 'pass' : 'fail',
            message: crypto.isReady() ? 'Crypto library initialized' : 'Crypto library not initialized'
        };
        
        // Check algorithm availability
        const verification = await crypto.verifyLibrary();
        health.checks.algorithm_availability = {
            status: verification.functional ? 'pass' : 'fail',
            message: verification.functional ? 'All algorithms functional' : 'Some algorithms not functional',
            details: verification.supportedAlgorithms
        };
        
        // Check memory usage
        const memoryUsage = process.memoryUsage();
        const memoryLimitMB = 128; // Netlify function memory limit
        const memoryUsedMB = memoryUsage.heapUsed / 1024 / 1024;
        
        health.checks.memory_usage = {
            status: memoryUsedMB < memoryLimitMB * 0.8 ? 'pass' : 'warn',
            message: `Memory usage: ${memoryUsedMB.toFixed(2)}MB / ${memoryLimitMB}MB`,
            usage_percentage: (memoryUsedMB / memoryLimitMB * 100).toFixed(2)
        };
        
        // Overall health status
        const failedChecks = Object.values(health.checks).filter(check => check.status === 'fail');
        const warnChecks = Object.values(health.checks).filter(check => check.status === 'warn');
        
        if (failedChecks.length > 0) {
            health.status = 'unhealthy';
        } else if (warnChecks.length > 0) {
            health.status = 'degraded';
        }
        
    } catch (error) {
        health.status = 'unhealthy';
        health.error = error.message;
    }
    
    return health;
}

/**
 * Run performance benchmark
 */
async function runPerformanceBenchmark(crypto, params) {
    const {
        iterations = 100,
        algorithm = 'standard',
        data_sizes = [1024, 4096, 16384], // 1KB, 4KB, 16KB
        concurrent_operations = 1
    } = params;
    
    const benchmark = {
        timestamp: new Date().toISOString(),
        parameters: {
            iterations,
            algorithm,
            data_sizes,
            concurrent_operations
        },
        results: {}
    };
    
    for (const dataSize of data_sizes) {
        const testData = 'A'.repeat(dataSize);
        const sizeResults = {
            data_size: dataSize,
            operations: {
                keypair_generation: [],
                encryption: [],
                decryption: []
            }
        };
        
        // Generate keypair once for this data size
        const keypair = await crypto.generateKeypair(algorithm);
        
        // Run benchmark iterations
        for (let i = 0; i < iterations; i++) {
            try {
                // Encryption benchmark
                const encryptStart = Date.now();
                const encrypted = await crypto.encrypt(testData, keypair.publicKey, keypair.algorithm);
                const encryptTime = Date.now() - encryptStart;
                sizeResults.operations.encryption.push(encryptTime);
                
                // Decryption benchmark
                const decryptStart = Date.now();
                const decrypted = await crypto.decrypt(encrypted, keypair.privateKey);
                const decryptTime = Date.now() - decryptStart;
                sizeResults.operations.decryption.push(decryptTime);
                
                // Verify integrity
                if (decrypted !== testData) {
                    throw new Error(`Integrity check failed for ${dataSize} bytes`);
                }
                
            } catch (error) {
                sizeResults.errors = sizeResults.errors || [];
                sizeResults.errors.push({
                    iteration: i + 1,
                    error: error.message
                });
            }
        }
        
        // Calculate statistics for this data size
        sizeResults.statistics = {
            encryption: calculateOperationStats(sizeResults.operations.encryption),
            decryption: calculateOperationStats(sizeResults.operations.decryption)
        };
        
        benchmark.results[`${dataSize}_bytes`] = sizeResults;
    }
    
    return benchmark;
}

/**
 * Run stress test
 */
async function runStressTest(crypto, params) {
    const {
        duration_seconds = 60,
        concurrent_operations = 5,
        algorithm = 'standard'
    } = params;
    
    const stressTest = {
        timestamp: new Date().toISOString(),
        parameters: {
            duration_seconds,
            concurrent_operations,
            algorithm
        },
        results: {
            total_operations: 0,
            successful_operations: 0,
            failed_operations: 0,
            operations_per_second: 0,
            errors: []
        }
    };
    
    const testData = 'Stress test data for post-quantum encryption performance evaluation';
    const keypair = await crypto.generateKeypair(algorithm);
    
    const startTime = Date.now();
    const endTime = startTime + (duration_seconds * 1000);
    
    const workers = [];
    
    // Create concurrent workers
    for (let i = 0; i < concurrent_operations; i++) {
        workers.push(runStressWorker(crypto, testData, keypair, endTime, i));
    }
    
    // Wait for all workers to complete
    const workerResults = await Promise.all(workers);
    
    // Aggregate results
    workerResults.forEach(result => {
        stressTest.results.total_operations += result.operations;
        stressTest.results.successful_operations += result.successful;
        stressTest.results.failed_operations += result.failed;
        stressTest.results.errors.push(...result.errors);
    });
    
    const actualDuration = (Date.now() - startTime) / 1000;
    stressTest.results.operations_per_second = stressTest.results.total_operations / actualDuration;
    stressTest.results.actual_duration_seconds = actualDuration;
    
    return stressTest;
}

/**
 * Run migration simulation test
 */
async function runMigrationTest(crypto, params) {
    const {
        entry_count = 100,
        algorithm = 'standard',
        verify_integrity = true
    } = params;
    
    const migrationTest = {
        timestamp: new Date().toISOString(),
        parameters: {
            entry_count,
            algorithm,
            verify_integrity
        },
        results: {
            entries_processed: 0,
            entries_migrated: 0,
            entries_failed: 0,
            total_time_ms: 0,
            average_time_per_entry_ms: 0,
            errors: []
        }
    };
    
    const startTime = Date.now();
    
    // Generate old and new keypairs
    const oldKeypair = await crypto.generateKeypair('standard'); // Simulate old keys
    const newKeypair = await crypto.generateKeypair(algorithm); // New keys
    
    // Simulate migration process
    for (let i = 0; i < entry_count; i++) {
        try {
            migrationTest.results.entries_processed++;
            
            // Simulate original data
            const originalData = `Entry ${i + 1} - Sensitive form data that needs migration`;
            
            // Encrypt with old keys (simulate existing encrypted data)
            const oldEncrypted = await crypto.encrypt(originalData, oldKeypair.publicKey, oldKeypair.algorithm);
            
            // Decrypt with old keys (migration step 1)
            const decrypted = await crypto.decrypt(oldEncrypted, oldKeypair.privateKey);
            
            // Re-encrypt with new keys (migration step 2)
            const newEncrypted = await crypto.encrypt(decrypted, newKeypair.publicKey, newKeypair.algorithm);
            
            // Verify integrity if requested
            if (verify_integrity) {
                const verifyDecrypted = await crypto.decrypt(newEncrypted, newKeypair.privateKey);
                if (verifyDecrypted !== originalData) {
                    throw new Error(`Integrity verification failed for entry ${i + 1}`);
                }
            }
            
            migrationTest.results.entries_migrated++;
            
        } catch (error) {
            migrationTest.results.entries_failed++;
            migrationTest.results.errors.push({
                entry: i + 1,
                error: error.message
            });
        }
    }
    
    const totalTime = Date.now() - startTime;
    migrationTest.results.total_time_ms = totalTime;
    migrationTest.results.average_time_per_entry_ms = totalTime / entry_count;
    
    return migrationTest;
}

/**
 * Stress test worker function
 */
async function runStressWorker(crypto, testData, keypair, endTime, workerId) {
    const result = {
        worker_id: workerId,
        operations: 0,
        successful: 0,
        failed: 0,
        errors: []
    };
    
    while (Date.now() < endTime) {
        try {
            result.operations++;
            
            // Perform encryption/decryption cycle
            const encrypted = await crypto.encrypt(testData, keypair.publicKey, keypair.algorithm);
            const decrypted = await crypto.decrypt(encrypted, keypair.privateKey);
            
            if (decrypted === testData) {
                result.successful++;
            } else {
                throw new Error('Data integrity check failed');
            }
            
        } catch (error) {
            result.failed++;
            result.errors.push({
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    }
    
    return result;
}

/**
 * Calculate statistics for performance metrics
 */
function calculateStatistics(results) {
    const stats = {};
    
    for (const [operation, times] of Object.entries(results)) {
        if (Array.isArray(times) && times.length > 0) {
            const sorted = times.sort((a, b) => a - b);
            stats[operation] = {
                count: times.length,
                min: Math.min(...times),
                max: Math.max(...times),
                mean: times.reduce((a, b) => a + b, 0) / times.length,
                median: sorted[Math.floor(sorted.length / 2)],
                p95: sorted[Math.floor(sorted.length * 0.95)],
                p99: sorted[Math.floor(sorted.length * 0.99)]
            };
        }
    }
    
    return stats;
}

/**
 * Calculate operation statistics
 */
function calculateOperationStats(times) {
    if (!Array.isArray(times) || times.length === 0) {
        return null;
    }
    
    const sorted = times.sort((a, b) => a - b);
    return {
        count: times.length,
        min_ms: Math.min(...times),
        max_ms: Math.max(...times),
        mean_ms: times.reduce((a, b) => a + b, 0) / times.length,
        median_ms: sorted[Math.floor(sorted.length / 2)],
        p95_ms: sorted[Math.floor(sorted.length * 0.95)],
        p99_ms: sorted[Math.floor(sorted.length * 0.99)],
        throughput_ops_per_sec: 1000 / (times.reduce((a, b) => a + b, 0) / times.length)
    };
}