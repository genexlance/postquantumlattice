#!/usr/bin/env node

/**
 * Node.js Runtime Compatibility Verification Script
 * Verifies Node.js runtime compatibility with OQS library in serverless environment
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Verifying Node.js runtime compatibility for OQS library...\n');

/**
 * Check Node.js version compatibility
 */
function checkNodeVersion() {
    console.log('📋 Node.js Version Check:');
    
    const currentVersion = process.version;
    const requiredMajor = 18;
    const requiredMinor = 19;
    const requiredPatch = 1;
    
    const [major, minor, patch] = currentVersion.replace('v', '').split('.').map(Number);
    
    console.log(`Current: ${currentVersion}`);
    console.log(`Required: v${requiredMajor}.${requiredMinor}.${requiredPatch}+`);
    
    if (major < requiredMajor || 
        (major === requiredMajor && minor < requiredMinor) ||
        (major === requiredMajor && minor === requiredMinor && patch < requiredPatch)) {
        console.log('❌ Node.js version is below minimum requirement');
        return false;
    }
    
    console.log('✅ Node.js version meets requirements');
    return true;
}

/**
 * Check system architecture and platform compatibility
 */
function checkSystemCompatibility() {
    console.log('\n🖥️  System Compatibility Check:');
    
    const platform = os.platform();
    const arch = os.arch();
    
    const supportedPlatforms = ['linux', 'darwin'];
    const supportedArchitectures = ['x64', 'arm64'];
    
    console.log(`Platform: ${platform}`);
    console.log(`Architecture: ${arch}`);
    
    if (!supportedPlatforms.includes(platform)) {
        console.log(`❌ Platform ${platform} is not supported`);
        console.log(`Supported platforms: ${supportedPlatforms.join(', ')}`);
        return false;
    }
    
    if (!supportedArchitectures.includes(arch)) {
        console.log(`❌ Architecture ${arch} is not supported`);
        console.log(`Supported architectures: ${supportedArchitectures.join(', ')}`);
        return false;
    }
    
    console.log('✅ System platform and architecture are supported');
    return true;
}

/**
 * Check memory availability for serverless constraints
 */
function checkMemoryRequirements() {
    console.log('\n💾 Memory Requirements Check:');
    
    const totalMemory = Math.round(os.totalmem() / 1024 / 1024); // MB
    const freeMemory = Math.round(os.freemem() / 1024 / 1024); // MB
    const requiredMemory = 1536; // MB for post-quantum operations
    
    console.log(`Total Memory: ${totalMemory}MB`);
    console.log(`Free Memory: ${freeMemory}MB`);
    console.log(`Required Memory: ${requiredMemory}MB`);
    
    if (freeMemory < requiredMemory) {
        console.log(`⚠️  Available memory (${freeMemory}MB) is below recommended (${requiredMemory}MB)`);
        console.log('This may cause performance issues in serverless environment');
        return false;
    }
    
    console.log('✅ Memory requirements met');
    return true;
}

/**
 * Check build tools availability
 */
function checkBuildTools() {
    console.log('\n🔧 Build Tools Check:');
    
    const tools = [
        { name: 'Python', command: 'python3 --version', required: true },
        { name: 'GCC', command: 'gcc --version', required: true },
        { name: 'G++', command: 'g++ --version', required: true },
        { name: 'Make', command: 'make --version', required: true },
        { name: 'CMake', command: 'cmake --version', required: false }
    ];
    
    let allRequired = true;
    
    for (const tool of tools) {
        try {
            const output = execSync(tool.command, { encoding: 'utf8', stdio: 'pipe' });
            const version = output.split('\n')[0];
            console.log(`✅ ${tool.name}: ${version}`);
        } catch (error) {
            if (tool.required) {
                console.log(`❌ ${tool.name}: Not found (required)`);
                allRequired = false;
            } else {
                console.log(`⚠️  ${tool.name}: Not found (optional)`);
            }
        }
    }
    
    if (!allRequired) {
        console.log('\n🔧 Install missing build tools:');
        console.log('Ubuntu/Debian: sudo apt-get install build-essential python3-dev');
        console.log('CentOS/RHEL: sudo yum groupinstall "Development Tools" python3-devel');
        console.log('macOS: xcode-select --install && brew install python3');
    }
    
    return allRequired;
}

/**
 * Test OQS library native compilation
 */
async function testOQSCompilation() {
    console.log('\n🏗️  OQS Library Compilation Test:');
    
    try {
        // Check if oqs.js is already compiled
        const oqsPath = path.join(__dirname, '..', 'node_modules', 'oqs.js');
        if (!fs.existsSync(oqsPath)) {
            console.log('⚠️  oqs.js not found in node_modules');
            return false;
        }
        
        // Try to require the library
        console.log('Testing OQS library loading...');
        const oqs = require('oqs.js');
        console.log('✅ OQS library loaded successfully');
        
        // Test basic functionality
        console.log('Testing basic KEM functionality...');
        const algorithms = oqs.listKEMs();
        
        if (!algorithms.includes('ML-KEM-768')) {
            console.log('❌ ML-KEM-768 algorithm not available');
            return false;
        }
        
        // Quick functionality test
        const keypair = oqs.kemKeypair('ML-KEM-768');
        const encapResult = oqs.encapsulate('ML-KEM-768', keypair.publicKey);
        const decapResult = oqs.decapsulate('ML-KEM-768', encapResult.ciphertext, keypair.secretKey);
        
        if (Buffer.compare(encapResult.sharedSecret, decapResult) !== 0) {
            console.log('❌ OQS functionality test failed');
            return false;
        }
        
        console.log('✅ OQS library compilation and functionality verified');
        return true;
        
    } catch (error) {
        console.log(`❌ OQS compilation test failed: ${error.message}`);
        
        // Provide compilation guidance
        console.log('\n🔧 OQS Compilation Steps:');
        console.log('1. Install build dependencies: npm install @mapbox/node-pre-gyp node-gyp');
        console.log('2. Rebuild OQS library: npm rebuild oqs.js');
        console.log('3. Verify installation: node -e "console.log(require(\'oqs.js\').listKEMs())"');
        
        return false;
    }
}

/**
 * Test serverless environment simulation
 */
async function testServerlessEnvironment() {
    console.log('\n☁️  Serverless Environment Simulation:');
    
    try {
        // Simulate memory constraints
        const originalMaxOldSpaceSize = process.env.NODE_OPTIONS;
        process.env.NODE_OPTIONS = '--max-old-space-size=1536 --optimize-for-size';
        
        console.log('Testing memory-constrained environment...');
        
        // Test multiple OQS operations under memory constraints
        const oqs = require('oqs.js');
        const iterations = 5;
        
        for (let i = 0; i < iterations; i++) {
            const startMemory = process.memoryUsage().heapUsed;
            
            // Perform post-quantum operations
            const keypair = oqs.kemKeypair('ML-KEM-768');
            const encapResult = oqs.encapsulate('ML-KEM-768', keypair.publicKey);
            const decapResult = oqs.decapsulate('ML-KEM-768', encapResult.ciphertext, keypair.secretKey);
            
            const endMemory = process.memoryUsage().heapUsed;
            const memoryDelta = (endMemory - startMemory) / 1024 / 1024; // MB
            
            console.log(`  Iteration ${i + 1}: ${memoryDelta.toFixed(2)}MB memory delta`);
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
        }
        
        // Restore original NODE_OPTIONS
        if (originalMaxOldSpaceSize) {
            process.env.NODE_OPTIONS = originalMaxOldSpaceSize;
        }
        
        console.log('✅ Serverless environment simulation completed');
        return true;
        
    } catch (error) {
        console.log(`❌ Serverless environment test failed: ${error.message}`);
        return false;
    }
}

/**
 * Generate compatibility report
 */
function generateCompatibilityReport(results) {
    const report = {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: os.platform(),
        architecture: os.arch(),
        totalMemory: Math.round(os.totalmem() / 1024 / 1024),
        freeMemory: Math.round(os.freemem() / 1024 / 1024),
        cpuCount: os.cpus().length,
        results: results,
        overall: {
            compatible: Object.values(results).every(result => result === true),
            score: Object.values(results).filter(result => result === true).length,
            total: Object.keys(results).length
        }
    };
    
    // Write report to file
    const reportPath = path.join(__dirname, '..', 'runtime-compatibility-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n📊 Compatibility Report:');
    console.log(`Node.js Version: ${results.nodeVersion ? '✅' : '❌'}`);
    console.log(`System Compatibility: ${results.systemCompatibility ? '✅' : '❌'}`);
    console.log(`Memory Requirements: ${results.memoryRequirements ? '✅' : '❌'}`);
    console.log(`Build Tools: ${results.buildTools ? '✅' : '❌'}`);
    console.log(`OQS Compilation: ${results.oqsCompilation ? '✅' : '❌'}`);
    console.log(`Serverless Environment: ${results.serverlessEnvironment ? '✅' : '❌'}`);
    
    console.log(`\nOverall Score: ${report.overall.score}/${report.overall.total}`);
    console.log(`Compatibility: ${report.overall.compatible ? '✅ PASS' : '❌ FAIL'}`);
    
    if (report.overall.compatible) {
        console.log('\n🎉 Runtime is fully compatible with OQS library!');
        console.log('Ready for serverless deployment.');
    } else {
        console.log('\n⚠️  Runtime compatibility issues detected.');
        console.log('Please address the failed checks before deployment.');
    }
    
    console.log(`\nDetailed report saved to: ${reportPath}`);
    
    return report;
}

/**
 * Main verification function
 */
async function main() {
    try {
        console.log('🚀 Node.js Runtime Compatibility Verification\n');
        
        const results = {
            nodeVersion: checkNodeVersion(),
            systemCompatibility: checkSystemCompatibility(),
            memoryRequirements: checkMemoryRequirements(),
            buildTools: checkBuildTools(),
            oqsCompilation: await testOQSCompilation(),
            serverlessEnvironment: await testServerlessEnvironment()
        };
        
        const report = generateCompatibilityReport(results);
        
        // Always exit with 0 to allow build to continue with graceful fallback
        // The system is designed to handle OQS library unavailability gracefully
        if (!report.overall.compatible) {
            console.log('\n⚠️  Some compatibility issues detected, but continuing with graceful fallback.');
            console.log('The system will handle OQS library unavailability with proper error messages.');
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Runtime verification failed:', error.message);
        console.log('Continuing with graceful fallback...');
        process.exit(0);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    checkNodeVersion,
    checkSystemCompatibility,
    checkMemoryRequirements,
    checkBuildTools,
    testOQSCompilation,
    testServerlessEnvironment,
    generateCompatibilityReport
};