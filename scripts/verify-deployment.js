#!/usr/bin/env node

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
            path: `/.netlify/functions/${functionName}`,
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
            console.log(`Testing ${functionName}...`);
            const result = await testFunction(functionName);
            results.push(result);
            
            if (result.status === 200) {
                console.log(`✅ ${functionName}: OK`);
            } else {
                console.log(`⚠️  ${functionName}: Status ${result.status}`);
            }
        } catch (error) {
            console.log(`❌ ${functionName}: ${error.error}`);
            results.push(error);
        }
    }
    
    console.log('\n📊 Deployment verification summary:');
    console.log(JSON.stringify(results, null, 2));
    
    const successCount = results.filter(r => r.status === 200).length;
    console.log(`\n${successCount}/${FUNCTIONS_TO_TEST.length} functions verified successfully`);
    
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
