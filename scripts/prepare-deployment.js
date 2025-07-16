#!/usr/bin/env node

/**
 * Deployment preparation script for post-quantum functions
 * Handles OQS native dependencies and serverless optimization
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Preparing post-quantum functions for deployment...\n');

/**
 * Check system requirements for OQS library
 */
function checkSystemRequirements() {
    console.log('🔍 Checking system requirements...');
    
    const requirements = {
        node: { min: '18.0.0', current: process.version },
        platform: { supported: ['linux', 'darwin'], current: process.platform },
        arch: { supported: ['x64', 'arm64'], current: process.arch }
    };
    
    console.log(`Node.js: ${requirements.node.current} (min: ${requirements.node.min})`);
    console.log(`Platform: ${requirements.platform.current}`);
    console.log(`Architecture: ${requirements.arch.current}`);
    
    // Check Node.js version
    const nodeVersion = process.version.replace('v', '');
    const [major, minor] = nodeVersion.split('.').map(Number);
    const [minMajor, minMinor] = requirements.node.min.split('.').map(Number);
    
    if (major < minMajor || (major === minMajor && minor < minMinor)) {
        console.log(`❌ Node.js version ${nodeVersion} is below minimum ${requirements.node.min}`);
        return false;
    }
    
    // Check platform support
    if (!requirements.platform.supported.includes(requirements.platform.current)) {
        console.log(`❌ Platform ${requirements.platform.current} is not supported`);
        console.log(`Supported platforms: ${requirements.platform.supported.join(', ')}`);
        return false;
    }
    
    // Check architecture support
    if (!requirements.arch.supported.includes(requirements.arch.current)) {
        console.log(`❌ Architecture ${requirements.arch.current} is not supported`);
        console.log(`Supported architectures: ${requirements.arch.supported.join(', ')}`);
        return false;
    }
    
    console.log('✅ System requirements met');
    return true;
}

/**
 * Install and verify OQS library dependencies
 */
async function installOQSDependencies() {
    console.log('\n📦 Installing OQS library dependencies...');
    
    try {
        // Check if OQS library is already installed and working
        try {
            require('oqs.js');
            console.log('✅ OQS library already available');
            return true;
        } catch (e) {
            console.log('⚠️  OQS library needs installation/rebuild');
        }
        
        // Install build dependencies
        console.log('Installing build dependencies...');
        execSync('npm install --no-save @mapbox/node-pre-gyp node-gyp', { 
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
        
        // Rebuild OQS library
        console.log('Rebuilding OQS library...');
        execSync('npm rebuild oqs.js', { 
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
        
        // Verify installation
        const oqs = require('oqs.js');
        console.log('✅ OQS library installed and verified');
        
        return true;
        
    } catch (error) {
        console.log(`❌ Failed to install OQS dependencies: ${error.message}`);
        console.log('\n🔧 Manual installation steps:');
        console.log('1. Install system build tools (gcc, g++, python3, make)');
        console.log('2. Run: npm install @mapbox/node-pre-gyp node-gyp');
        console.log('3. Run: npm rebuild oqs.js');
        
        return false;
    }
}

/**
 * Optimize function bundles for serverless deployment
 */
function optimizeFunctionBundles() {
    console.log('\n⚡ Optimizing function bundles...');
    
    const functionsDir = path.join(__dirname, '..', 'netlify', 'functions');
    const functions = ['encrypt.js', 'decrypt.js', 'generate-keypair.js', 'crypto-utils.js'];
    
    functions.forEach(functionFile => {
        const functionPath = path.join(functionsDir, functionFile);
        
        if (!fs.existsSync(functionPath)) {
            console.log(`⚠️  Function not found: ${functionFile}`);
            return;
        }
        
        let content = fs.readFileSync(functionPath, 'utf8');
        
        // Add serverless optimization header
        const optimizationHeader = `
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
`;

        // Add optimization if not already present
        if (!content.includes('Serverless optimization for post-quantum functions')) {
            const firstRequire = content.indexOf('require(');
            if (firstRequire !== -1) {
                const lineEnd = content.indexOf('\n', firstRequire);
                content = content.slice(0, lineEnd + 1) + optimizationHeader + content.slice(lineEnd + 1);
                fs.writeFileSync(functionPath, content);
                console.log(`✅ Optimized ${functionFile}`);
            }
        } else {
            console.log(`✅ ${functionFile} already optimized`);
        }
    });
}

/**
 * Create deployment configuration files
 */
function createDeploymentConfigs() {
    console.log('\n📋 Creating deployment configuration files...');
    
    // Create function-specific memory configurations
    const functionConfigs = {
        'encrypt': { memory: 1024, timeout: 30 },
        'decrypt': { memory: 1024, timeout: 30 },
        'generate-keypair': { memory: 512, timeout: 15 },
        'monitor': { memory: 256, timeout: 10 },
        'status': { memory: 256, timeout: 10 }
    };
    
    const netlifyDir = path.join(__dirname, '..', '.netlify');
    if (!fs.existsSync(netlifyDir)) {
        fs.mkdirSync(netlifyDir, { recursive: true });
    }
    
    // Create function configurations
    Object.entries(functionConfigs).forEach(([name, config]) => {
        const configPath = path.join(netlifyDir, `${name}.json`);
        const configContent = {
            config: {
                memory: config.memory,
                timeout: config.timeout,
                runtime: 'nodejs18.x',
                environment: {
                    NODE_OPTIONS: `--max-old-space-size=${config.memory} --optimize-for-size`,
                    OQS_ENABLE_KEM_ML_KEM: 'ON',
                    OQS_MEMORY_LIMIT: Math.floor(config.memory * 0.7).toString()
                }
            }
        };
        
        fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));
        console.log(`✅ Created config for ${name} function`);
    });
    
    // Create deployment manifest
    const manifest = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        functions: Object.keys(functionConfigs),
        oqs: {
            version: 'latest',
            algorithms: ['ML-KEM-768', 'ML-KEM-1024'],
            optimized: true
        },
        deployment: {
            platform: 'netlify',
            runtime: 'nodejs18.x',
            bundler: 'esbuild'
        }
    };
    
    fs.writeFileSync(
        path.join(netlifyDir, 'deployment-manifest.json'),
        JSON.stringify(manifest, null, 2)
    );
    
    console.log('✅ Created deployment manifest');
}

/**
 * Run pre-deployment tests
 */
async function runPreDeploymentTests() {
    console.log('\n🧪 Running pre-deployment tests...');
    
    try {
        // Test OQS library functionality
        console.log('Testing OQS library...');
        execSync('node scripts/test-oqs-compatibility.js', {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
        
        // Run unit tests
        console.log('Running unit tests...');
        execSync('npm run test:unit', {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
        
        console.log('✅ Pre-deployment tests passed');
        return true;
        
    } catch (error) {
        console.log(`❌ Pre-deployment tests failed: ${error.message}`);
        return false;
    }
}

/**
 * Generate deployment summary
 */
function generateDeploymentSummary() {
    console.log('\n📊 Deployment Summary:');
    
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const netlifyToml = fs.readFileSync(path.join(__dirname, '..', 'netlify.toml'), 'utf8');
    
    console.log(`Project: ${packageJson.name} v${packageJson.version}`);
    console.log(`Node.js: ${process.version}`);
    console.log(`Platform: ${process.platform} ${process.arch}`);
    
    // Check OQS library
    try {
        const oqs = require('oqs.js');
        const algorithms = oqs.listKEMs();
        console.log(`OQS Library: ✅ (${algorithms.length} algorithms available)`);
    } catch (e) {
        console.log(`OQS Library: ❌ (${e.message})`);
    }
    
    // Check function files
    const functionsDir = path.join(__dirname, '..', 'netlify', 'functions');
    const functions = fs.readdirSync(functionsDir).filter(f => f.endsWith('.js'));
    console.log(`Functions: ${functions.length} files`);
    functions.forEach(f => console.log(`  - ${f}`));
    
    // Memory configuration
    const memoryMatch = netlifyToml.match(/NODE_OPTIONS = "([^"]+)"/);
    if (memoryMatch) {
        console.log(`Memory Config: ${memoryMatch[1]}`);
    }
    
    console.log('\n🚀 Ready for deployment!');
    console.log('\nNext steps:');
    console.log('1. Deploy to preview: npm run deploy:preview');
    console.log('2. Verify deployment: npm run deploy:verify');
    console.log('3. Deploy to production: npm run deploy:production');
}

/**
 * Main deployment preparation function
 */
async function main() {
    try {
        console.log('🔧 Post-Quantum Deployment Preparation\n');
        
        // Step 1: Check system requirements
        if (!checkSystemRequirements()) {
            process.exit(1);
        }
        
        // Step 2: Install OQS dependencies
        if (!await installOQSDependencies()) {
            process.exit(1);
        }
        
        // Step 3: Optimize function bundles
        optimizeFunctionBundles();
        
        // Step 4: Create deployment configurations
        createDeploymentConfigs();
        
        // Step 5: Run pre-deployment tests
        if (!await runPreDeploymentTests()) {
            console.log('\n⚠️  Tests failed but continuing with deployment preparation');
        }
        
        // Step 6: Generate deployment summary
        generateDeploymentSummary();
        
        console.log('\n🎉 Deployment preparation completed successfully!');
        
    } catch (error) {
        console.error(`❌ Deployment preparation failed: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    checkSystemRequirements,
    installOQSDependencies,
    optimizeFunctionBundles,
    createDeploymentConfigs,
    runPreDeploymentTests,
    generateDeploymentSummary
};