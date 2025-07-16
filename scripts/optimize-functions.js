#!/usr/bin/env node

/**
 * Function optimization script for Netlify deployment
 * Optimizes functions for serverless constraints and OQS library compatibility
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Optimizing Netlify functions for post-quantum deployment...');

const FUNCTIONS_DIR = path.join(__dirname, '..', 'netlify', 'functions');
const OPTIMIZATION_CONFIG = {
    // Memory optimization settings
    maxOldSpaceSize: 1024, // MB
    maxSemiSpaceSize: 64,  // MB
    
    // Performance settings
    enableOptimizations: true,
    enableGCOptimizations: true,
    
    // OQS library settings
    oqsMemoryLimit: 256, // MB
    oqsCacheSize: 32     // MB
};

/**
 * Add memory optimization headers to function files
 */
function optimizeFunctionMemory() {
    const functionFiles = [
        'encrypt.js',
        'decrypt.js', 
        'generate-keypair.js',
        'crypto-utils.js'
    ];

    functionFiles.forEach(filename => {
        const filePath = path.join(FUNCTIONS_DIR, filename);
        
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  Function file not found: ${filename}`);
            return;
        }

        let content = fs.readFileSync(filePath, 'utf8');
        
        // Add memory optimization header if not already present
        const optimizationHeader = `
// Memory optimization for serverless environment
if (process.env.NODE_ENV === 'production') {
    // Optimize garbage collection for post-quantum operations
    if (global.gc) {
        setInterval(() => {
            if (process.memoryUsage().heapUsed > ${OPTIMIZATION_CONFIG.oqsMemoryLimit * 1024 * 1024}) {
                global.gc();
            }
        }, 30000); // Run GC every 30 seconds if memory usage is high
    }
    
    // Set memory limits for OQS operations
    process.env.OQS_MEMORY_LIMIT = '${OPTIMIZATION_CONFIG.oqsMemoryLimit}';
    process.env.OQS_CACHE_SIZE = '${OPTIMIZATION_CONFIG.oqsCacheSize}';
}
`;

        // Only add if not already present
        if (!content.includes('Memory optimization for serverless environment')) {
            // Insert after the first require statement or at the beginning
            const requireIndex = content.indexOf('require(');
            if (requireIndex !== -1) {
                const lineEnd = content.indexOf('\n', requireIndex);
                content = content.slice(0, lineEnd + 1) + optimizationHeader + content.slice(lineEnd + 1);
            } else {
                content = optimizationHeader + content;
            }
            
            fs.writeFileSync(filePath, content);
            console.log(`✅ Optimized memory settings for ${filename}`);
        } else {
            console.log(`✅ ${filename} already optimized`);
        }
    });
}

/**
 * Create function-specific configuration files
 */
function createFunctionConfigs() {
    const configs = {
        'encrypt.json': {
            memory: 1024,
            timeout: 30,
            environment: {
                NODE_OPTIONS: '--max-old-space-size=1024 --optimize-for-size',
                OQS_ENABLE_KEM_ML_KEM: 'ON',
                OQS_MEMORY_LIMIT: '256'
            }
        },
        'decrypt.json': {
            memory: 1024,
            timeout: 30,
            environment: {
                NODE_OPTIONS: '--max-old-space-size=1024 --optimize-for-size',
                OQS_ENABLE_KEM_ML_KEM: 'ON',
                OQS_MEMORY_LIMIT: '256'
            }
        },
        'generate-keypair.json': {
            memory: 512,
            timeout: 15,
            environment: {
                NODE_OPTIONS: '--max-old-space-size=512 --optimize-for-size',
                OQS_ENABLE_KEM_ML_KEM: 'ON',
                OQS_MEMORY_LIMIT: '128'
            }
        }
    };

    Object.entries(configs).forEach(([filename, config]) => {
        const configPath = path.join(FUNCTIONS_DIR, filename);
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`✅ Created configuration for ${filename}`);
    });
}

/**
 * Verify OQS library compatibility and native dependencies
 */
function verifyOQSCompatibility() {
    console.log('🔍 Verifying OQS library compatibility...');
    
    try {
        // Try to load the OQS library
        const oqs = require('oqs.js');
        console.log('✅ OQS library loaded successfully');
        
        // Get library version and build info
        try {
            const version = oqs.version || 'unknown';
            console.log(`📦 OQS version: ${version}`);
        } catch (e) {
            console.log('⚠️  Could not determine OQS version');
        }
        
        // Check for required algorithms
        const availableKEMs = oqs.listKEMs();
        const requiredAlgorithms = ['ML-KEM-768', 'ML-KEM-1024'];
        
        console.log(`📋 Available KEM algorithms: ${availableKEMs.length}`);
        availableKEMs.slice(0, 5).forEach(alg => console.log(`   - ${alg}`));
        if (availableKEMs.length > 5) {
            console.log(`   ... and ${availableKEMs.length - 5} more`);
        }
        
        const missingAlgorithms = requiredAlgorithms.filter(alg => !availableKEMs.includes(alg));
        
        if (missingAlgorithms.length > 0) {
            console.log(`⚠️  Missing algorithms: ${missingAlgorithms.join(', ')}`);
            console.log(`Available algorithms: ${availableKEMs.join(', ')}`);
        } else {
            console.log('✅ All required algorithms available');
        }
        
        // Test basic functionality for both required algorithms
        for (const algorithm of requiredAlgorithms) {
            if (availableKEMs.includes(algorithm)) {
                try {
                    console.log(`🧪 Testing ${algorithm}...`);
                    const testKeypair = oqs.kemKeypair(algorithm);
                    if (testKeypair && testKeypair.publicKey && testKeypair.secretKey) {
                        console.log(`✅ ${algorithm} functionality verified`);
                        
                        // Test encapsulation/decapsulation
                        const encapResult = oqs.encapsulate(algorithm, testKeypair.publicKey);
                        const decapResult = oqs.decapsulate(algorithm, encapResult.ciphertext, testKeypair.secretKey);
                        
                        if (Buffer.compare(encapResult.sharedSecret, decapResult) === 0) {
                            console.log(`✅ ${algorithm} encap/decap verified`);
                        } else {
                            console.log(`❌ ${algorithm} encap/decap failed`);
                        }
                    } else {
                        console.log(`❌ ${algorithm} functionality test failed`);
                    }
                } catch (algError) {
                    console.log(`❌ ${algorithm} test failed: ${algError.message}`);
                }
            }
        }
        
        // Check memory usage
        const memUsage = process.memoryUsage();
        console.log(`💾 Memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap, ${Math.round(memUsage.rss / 1024 / 1024)}MB RSS`);
        
        return true;
        
    } catch (error) {
        console.log(`❌ OQS library verification failed: ${error.message}`);
        console.log('💡 Make sure oqs.js is properly installed and compatible with your system');
        
        // Provide troubleshooting information
        console.log('\n🔧 Troubleshooting steps:');
        console.log('1. Install build dependencies: npm install @mapbox/node-pre-gyp node-gyp');
        console.log('2. Rebuild OQS library: npm rebuild oqs.js');
        console.log('3. Check Node.js version compatibility (18.19.0)');
        console.log('4. Verify system architecture support (x64, arm64)');
        console.log('5. Ensure system has required build tools (gcc, g++, python3)');
        
        return false;
    }
}

/**
 * Create deployment verification script
 */
function createDeploymentVerification() {
    const verificationScript = `#!/usr/bin/env node

/**
 * Post-deployment verification script
 * Verifies that OQS library works correctly in the deployed environment
 */

const https = require('https');

const FUNCTIONS_TO_TEST = [
    'generate-keypair',
    'encrypt', 
    'decrypt',
    'status'
];

async function testFunction(functionName) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: process.env.NETLIFY_URL || 'localhost',
            port: process.env.NETLIFY_URL ? 443 : 8888,
            path: \`/.netlify/functions/\${functionName}\`,
            method: 'GET',
            timeout: 10000
        };

        const req = (process.env.NETLIFY_URL ? https : require('http')).request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    function: functionName,
                    status: res.statusCode,
                    response: data
                });
            });
        });

        req.on('error', (error) => {
            reject({
                function: functionName,
                error: error.message
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject({
                function: functionName,
                error: 'Request timeout'
            });
        });

        req.end();
    });
}

async function verifyDeployment() {
    console.log('🚀 Verifying post-quantum functions deployment...');
    
    const results = [];
    
    for (const functionName of FUNCTIONS_TO_TEST) {
        try {
            console.log(\`Testing \${functionName}...\`);
            const result = await testFunction(functionName);
            results.push(result);
            
            if (result.status === 200) {
                console.log(\`✅ \${functionName}: OK\`);
            } else {
                console.log(\`⚠️  \${functionName}: Status \${result.status}\`);
            }
        } catch (error) {
            console.log(\`❌ \${functionName}: \${error.error}\`);
            results.push(error);
        }
    }
    
    console.log('\\n📊 Deployment verification summary:');
    console.log(JSON.stringify(results, null, 2));
    
    const successCount = results.filter(r => r.status === 200).length;
    console.log(\`\\n\${successCount}/\${FUNCTIONS_TO_TEST.length} functions verified successfully\`);
    
    if (successCount === FUNCTIONS_TO_TEST.length) {
        console.log('🎉 All functions deployed and working correctly!');
        process.exit(0);
    } else {
        console.log('⚠️  Some functions may need attention');
        process.exit(1);
    }
}

if (require.main === module) {
    verifyDeployment().catch(console.error);
}

module.exports = { verifyDeployment, testFunction };
`;

    fs.writeFileSync(path.join(__dirname, 'verify-deployment.js'), verificationScript);
    console.log('✅ Created deployment verification script');
}

// Main optimization process
async function main() {
    try {
        console.log('Starting function optimization...\n');
        
        // Step 1: Optimize function memory usage
        optimizeFunctionMemory();
        
        // Step 2: Create function-specific configurations
        createFunctionConfigs();
        
        // Step 3: Verify OQS library compatibility
        verifyOQSCompatibility();
        
        // Step 4: Create deployment verification script
        createDeploymentVerification();
        
        console.log('\n🎉 Function optimization completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Test functions locally: npm run dev');
        console.log('2. Run deployment verification: node scripts/verify-deployment.js');
        console.log('3. Deploy to Netlify: netlify deploy');
        
    } catch (error) {
        console.error('❌ Optimization failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    optimizeFunctionMemory,
    createFunctionConfigs,
    verifyOQSCompatibility,
    createDeploymentVerification
};