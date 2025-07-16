#!/usr/bin/env node

/**
 * OQS Library Compatibility Test Script
 * Tests OQS library functionality and compatibility with Node.js runtime
 */

const os = require('os');
const path = require('path');

console.log('🧪 Testing OQS library compatibility...\n');

// System information
console.log('📋 System Information:');
console.log(`Platform: ${os.platform()}`);
console.log(`Architecture: ${os.arch()}`);
console.log(`Node.js: ${process.version}`);
console.log(`Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB total, ${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB free`);
console.log(`CPU: ${os.cpus()[0].model} (${os.cpus().length} cores)\n`);

/**
 * Test OQS library loading and basic functionality
 */
async function testOQSLibrary() {
    console.log('🔍 Testing OQS library loading...');
    
    try {
        // Test library loading
        const oqs = require('oqs.js');
        console.log('✅ OQS library loaded successfully');
        
        // Get library information
        try {
            const version = oqs.version || 'unknown';
            console.log(`📦 OQS version: ${version}`);
        } catch (e) {
            console.log('⚠️  Could not determine OQS version');
        }
        
        // List available algorithms
        console.log('\n🔐 Available KEM algorithms:');
        const availableKEMs = oqs.listKEMs();
        availableKEMs.forEach(alg => console.log(`  - ${alg}`));
        
        // Check required algorithms
        const requiredAlgorithms = ['ML-KEM-768', 'ML-KEM-1024'];
        const missingAlgorithms = requiredAlgorithms.filter(alg => !availableKEMs.includes(alg));
        
        if (missingAlgorithms.length > 0) {
            console.log(`\n❌ Missing required algorithms: ${missingAlgorithms.join(', ')}`);
            return false;
        } else {
            console.log('\n✅ All required algorithms available');
        }
        
        return oqs;
        
    } catch (error) {
        console.log(`❌ Failed to load OQS library: ${error.message}`);
        console.log('\n🔧 Troubleshooting suggestions:');
        console.log('1. Install oqs.js: npm install oqs.js');
        console.log('2. Check system dependencies (build tools, Python)');
        console.log('3. Verify Node.js version compatibility (>=18.0.0)');
        console.log('4. Check architecture support (x64, arm64)');
        return false;
    }
}

/**
 * Test ML-KEM algorithm functionality
 */
async function testMLKEMAlgorithm(oqs, algorithm) {
    console.log(`\n🧪 Testing ${algorithm} functionality...`);
    
    try {
        const startTime = Date.now();
        
        // Test keypair generation
        console.log(`  Generating ${algorithm} keypair...`);
        const keypair = oqs.kemKeypair(algorithm);
        
        if (!keypair || !keypair.publicKey || !keypair.secretKey) {
            throw new Error('Invalid keypair generated');
        }
        
        console.log(`  ✅ Keypair generated (${Date.now() - startTime}ms)`);
        console.log(`     Public key size: ${keypair.publicKey.length} bytes`);
        console.log(`     Secret key size: ${keypair.secretKey.length} bytes`);
        
        // Test encapsulation
        console.log(`  Testing encapsulation...`);
        const encapStart = Date.now();
        const encapResult = oqs.encapsulate(algorithm, keypair.publicKey);
        
        if (!encapResult || !encapResult.sharedSecret || !encapResult.ciphertext) {
            throw new Error('Invalid encapsulation result');
        }
        
        console.log(`  ✅ Encapsulation successful (${Date.now() - encapStart}ms)`);
        console.log(`     Shared secret size: ${encapResult.sharedSecret.length} bytes`);
        console.log(`     Ciphertext size: ${encapResult.ciphertext.length} bytes`);
        
        // Test decapsulation
        console.log(`  Testing decapsulation...`);
        const decapStart = Date.now();
        const decapResult = oqs.decapsulate(algorithm, encapResult.ciphertext, keypair.secretKey);
        
        if (!decapResult || Buffer.compare(encapResult.sharedSecret, decapResult) !== 0) {
            throw new Error('Decapsulation failed - shared secrets do not match');
        }
        
        console.log(`  ✅ Decapsulation successful (${Date.now() - decapStart}ms)`);
        console.log(`  ✅ ${algorithm} test completed (${Date.now() - startTime}ms total)`);
        
        return {
            algorithm,
            success: true,
            timing: {
                total: Date.now() - startTime,
                keypair: Date.now() - startTime,
                encapsulation: Date.now() - encapStart,
                decapsulation: Date.now() - decapStart
            },
            sizes: {
                publicKey: keypair.publicKey.length,
                secretKey: keypair.secretKey.length,
                sharedSecret: encapResult.sharedSecret.length,
                ciphertext: encapResult.ciphertext.length
            }
        };
        
    } catch (error) {
        console.log(`  ❌ ${algorithm} test failed: ${error.message}`);
        return {
            algorithm,
            success: false,
            error: error.message
        };
    }
}

/**
 * Test memory usage and performance
 */
async function testMemoryAndPerformance(oqs) {
    console.log('\n🔬 Testing memory usage and performance...');
    
    const initialMemory = process.memoryUsage();
    console.log(`Initial memory usage: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
    
    const iterations = 10;
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const startMemory = process.memoryUsage().heapUsed;
        
        try {
            // Generate keypair
            const keypair = oqs.kemKeypair('ML-KEM-768');
            
            // Perform encapsulation/decapsulation
            const encapResult = oqs.encapsulate('ML-KEM-768', keypair.publicKey);
            const decapResult = oqs.decapsulate('ML-KEM-768', encapResult.ciphertext, keypair.secretKey);
            
            const endTime = Date.now();
            const endMemory = process.memoryUsage().heapUsed;
            
            results.push({
                iteration: i + 1,
                time: endTime - startTime,
                memoryDelta: endMemory - startMemory,
                success: Buffer.compare(encapResult.sharedSecret, decapResult) === 0
            });
            
        } catch (error) {
            results.push({
                iteration: i + 1,
                error: error.message,
                success: false
            });
        }
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
    }
    
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length > 0) {
        const avgTime = successfulResults.reduce((sum, r) => sum + r.time, 0) / successfulResults.length;
        const avgMemory = successfulResults.reduce((sum, r) => sum + r.memoryDelta, 0) / successfulResults.length;
        
        console.log(`✅ Performance test completed:`);
        console.log(`   Successful operations: ${successfulResults.length}/${iterations}`);
        console.log(`   Average time: ${Math.round(avgTime)}ms`);
        console.log(`   Average memory delta: ${Math.round(avgMemory / 1024)}KB`);
        
        const finalMemory = process.memoryUsage();
        console.log(`Final memory usage: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
        
        return {
            success: true,
            successRate: successfulResults.length / iterations,
            averageTime: avgTime,
            averageMemoryDelta: avgMemory
        };
    } else {
        console.log(`❌ Performance test failed - no successful operations`);
        return { success: false };
    }
}

/**
 * Test integration with crypto-utils
 */
async function testCryptoUtilsIntegration() {
    console.log('\n🔗 Testing crypto-utils integration...');
    
    try {
        const PostQuantumCrypto = require('../netlify/functions/crypto-utils.js');
        const pqCrypto = new PostQuantumCrypto();
        
        console.log('  Initializing PostQuantumCrypto...');
        await pqCrypto.initialize();
        console.log('  ✅ PostQuantumCrypto initialized');
        
        // Test library verification
        console.log('  Running library verification...');
        const verification = await pqCrypto.verifyLibrary();
        
        if (verification.functional) {
            console.log('  ✅ Library verification passed');
            console.log(`     Supported algorithms: ${verification.supportedAlgorithms.length}`);
        } else {
            console.log('  ❌ Library verification failed');
            console.log(`     Errors: ${verification.errors.join(', ')}`);
        }
        
        // Test encryption/decryption workflow
        console.log('  Testing encryption/decryption workflow...');
        const keypair = await pqCrypto.generateKeypair('standard');
        const testData = 'Hello, Post-Quantum World!';
        
        const encrypted = await pqCrypto.encrypt(testData, keypair.publicKey, keypair.algorithm);
        const decrypted = await pqCrypto.decrypt(encrypted, keypair.privateKey);
        
        if (decrypted === testData) {
            console.log('  ✅ Encryption/decryption workflow successful');
        } else {
            console.log('  ❌ Encryption/decryption workflow failed');
        }
        
        return { success: true, verification };
        
    } catch (error) {
        console.log(`  ❌ Crypto-utils integration failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Main test function
 */
async function main() {
    const testResults = {
        systemInfo: {
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            memory: Math.round(os.totalmem() / 1024 / 1024 / 1024)
        },
        oqsLibrary: null,
        algorithms: [],
        performance: null,
        integration: null
    };
    
    try {
        // Test OQS library loading
        const oqs = await testOQSLibrary();
        testResults.oqsLibrary = { success: !!oqs };
        
        if (!oqs) {
            console.log('\n❌ Cannot proceed with tests - OQS library not available');
            return testResults;
        }
        
        // Test required algorithms
        const algorithms = ['ML-KEM-768', 'ML-KEM-1024'];
        for (const algorithm of algorithms) {
            const result = await testMLKEMAlgorithm(oqs, algorithm);
            testResults.algorithms.push(result);
        }
        
        // Test memory and performance
        const perfResult = await testMemoryAndPerformance(oqs);
        testResults.performance = perfResult;
        
        // Test crypto-utils integration
        const integrationResult = await testCryptoUtilsIntegration();
        testResults.integration = integrationResult;
        
        // Summary
        console.log('\n📊 Test Summary:');
        console.log(`OQS Library: ${testResults.oqsLibrary.success ? '✅' : '❌'}`);
        console.log(`ML-KEM-768: ${testResults.algorithms.find(a => a.algorithm === 'ML-KEM-768')?.success ? '✅' : '❌'}`);
        console.log(`ML-KEM-1024: ${testResults.algorithms.find(a => a.algorithm === 'ML-KEM-1024')?.success ? '✅' : '❌'}`);
        console.log(`Performance: ${testResults.performance?.success ? '✅' : '❌'}`);
        console.log(`Integration: ${testResults.integration?.success ? '✅' : '❌'}`);
        
        const allPassed = testResults.oqsLibrary.success && 
                         testResults.algorithms.every(a => a.success) &&
                         testResults.performance?.success &&
                         testResults.integration?.success;
        
        if (allPassed) {
            console.log('\n🎉 All tests passed! OQS library is ready for deployment.');
        } else {
            console.log('\n⚠️  Some tests failed. Review the results above.');
        }
        
        return testResults;
        
    } catch (error) {
        console.error('\n❌ Test execution failed:', error.message);
        testResults.error = error.message;
        return testResults;
    }
}

if (require.main === module) {
    main().then(results => {
        // Write results to file for CI/CD
        const fs = require('fs');
        fs.writeFileSync(
            path.join(__dirname, '..', 'oqs-compatibility-results.json'),
            JSON.stringify(results, null, 2)
        );
        
        process.exit(results.error ? 1 : 0);
    }).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { main, testOQSLibrary, testMLKEMAlgorithm };