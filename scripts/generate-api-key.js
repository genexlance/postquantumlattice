#!/usr/bin/env node

/**
 * API Key Generation Script for Post-Quantum Lattice Shield
 * Generates secure API keys for the PQLS_API_KEY environment variable
 */

const crypto = require('crypto');

console.log('🔐 Post-Quantum Lattice Shield API Key Generator\n');

/**
 * Generate a cryptographically secure API key
 */
function generateSecureApiKey(length = 64) {
    // Generate random bytes
    const randomBytes = crypto.randomBytes(length);
    
    // Convert to base64url (URL-safe base64)
    const base64url = randomBytes
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    
    return base64url;
}

/**
 * Generate multiple API key options
 */
function generateApiKeyOptions() {
    console.log('🎲 Generated API Key Options:\n');
    
    const options = [
        { name: 'Standard (64 bytes)', key: generateSecureApiKey(64) },
        { name: 'High Security (96 bytes)', key: generateSecureApiKey(96) },
        { name: 'Maximum Security (128 bytes)', key: generateSecureApiKey(128) }
    ];
    
    options.forEach((option, index) => {
        console.log(`${index + 1}. ${option.name}:`);
        console.log(`   ${option.key}\n`);
    });
    
    return options;
}

/**
 * Validate an existing API key
 */
function validateApiKey(apiKey) {
    if (!apiKey) {
        return { valid: false, reason: 'API key is empty' };
    }
    
    if (apiKey.length < 32) {
        return { valid: false, reason: 'API key is too short (minimum 32 characters)' };
    }
    
    if (apiKey.includes(' ')) {
        return { valid: false, reason: 'API key contains spaces' };
    }
    
    // Check for common weak patterns
    const weakPatterns = [
        'test',
        'dev',
        'demo',
        '12345',
        'password',
        'secret',
        'key'
    ];
    
    const lowerKey = apiKey.toLowerCase();
    for (const pattern of weakPatterns) {
        if (lowerKey.includes(pattern)) {
            return { valid: false, reason: `API key contains weak pattern: ${pattern}` };
        }
    }
    
    return { valid: true, reason: 'API key appears secure' };
}

/**
 * Display setup instructions
 */
function displaySetupInstructions(apiKey) {
    console.log('📋 Setup Instructions:\n');
    
    console.log('1. 🌐 For Netlify Deployment:');
    console.log('   a. Go to your Netlify site dashboard');
    console.log('   b. Navigate to Site settings > Environment variables');
    console.log('   c. Add a new environment variable:');
    console.log('      Key: PQLS_API_KEY');
    console.log(`      Value: ${apiKey}`);
    console.log('   d. Save and redeploy your site\n');
    
    console.log('2. 🔧 For Local Development:');
    console.log('   a. Create a .env file in your project root (if not exists)');
    console.log('   b. Add the following line:');
    console.log(`      PQLS_API_KEY=${apiKey}`);
    console.log('   c. Make sure .env is in your .gitignore file\n');
    
    console.log('3. 🔌 For WordPress Plugin:');
    console.log('   a. Go to WordPress Admin > Settings > Post-Quantum Lattice Shield');
    console.log('   b. Enter the API key in the "API Key" field');
    console.log(`      API Key: ${apiKey}`);
    console.log('   c. Save settings\n');
    
    console.log('4. 🧪 Test the Setup:');
    console.log('   a. Use the WordPress plugin test functionality');
    console.log('   b. Or test directly with curl:');
    console.log(`   curl -X POST https://your-site.netlify.app/.netlify/functions/decrypt \\`);
    console.log(`        -H "Authorization: Bearer ${apiKey}" \\`);
    console.log(`        -H "Content-Type: application/json" \\`);
    console.log(`        -d '{"encryptedData":"test","privateKey":"test"}'`);
    console.log('');
}

/**
 * Main function
 */
function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage: node generate-api-key.js [options]\n');
        console.log('Options:');
        console.log('  --validate <key>  Validate an existing API key');
        console.log('  --quick          Generate a single API key quickly');
        console.log('  --help, -h       Show this help message');
        return;
    }
    
    if (args.includes('--validate')) {
        const keyIndex = args.indexOf('--validate') + 1;
        const keyToValidate = args[keyIndex];
        
        if (!keyToValidate) {
            console.log('❌ Please provide an API key to validate');
            console.log('Usage: node generate-api-key.js --validate <your-api-key>');
            return;
        }
        
        const validation = validateApiKey(keyToValidate);
        console.log(`🔍 API Key Validation Result:`);
        console.log(`Status: ${validation.valid ? '✅ Valid' : '❌ Invalid'}`);
        console.log(`Reason: ${validation.reason}\n`);
        
        if (validation.valid) {
            displaySetupInstructions(keyToValidate);
        } else {
            console.log('💡 Generate a new secure API key by running this script without arguments.');
        }
        
        return;
    }
    
    if (args.includes('--quick')) {
        const quickKey = generateSecureApiKey(64);
        console.log('🚀 Quick API Key Generated:\n');
        console.log(`${quickKey}\n`);
        displaySetupInstructions(quickKey);
        return;
    }
    
    // Default: Generate multiple options
    const options = generateApiKeyOptions();
    
    console.log('💡 Recommendation: Use option 2 (High Security) for production deployments.\n');
    
    // Use the high security option for instructions
    const recommendedKey = options[1].key;
    displaySetupInstructions(recommendedKey);
    
    console.log('⚠️  Security Notes:');
    console.log('• Never commit API keys to version control');
    console.log('• Store API keys securely in environment variables');
    console.log('• Rotate API keys regularly (every 90 days recommended)');
    console.log('• Use different API keys for development and production');
    console.log('• Monitor API key usage in your logs\n');
    
    console.log('🔄 To generate new keys, run this script again.');
    console.log('🔍 To validate an existing key: node generate-api-key.js --validate <your-key>');
}

if (require.main === module) {
    main();
}

module.exports = {
    generateSecureApiKey,
    validateApiKey,
    displaySetupInstructions
};