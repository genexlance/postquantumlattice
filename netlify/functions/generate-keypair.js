const crypto = require('crypto');

exports.handler = async () => {
    try {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem',
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem',
            },
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                publicKey,
                privateKey,
                algorithm: 'RSA-OAEP-256',
            }),
        };
    } catch (error) {
        console.error('Key generation error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'An unexpected error occurred during key generation.',
                details: error.message,
            }),
        };
    }
}; 