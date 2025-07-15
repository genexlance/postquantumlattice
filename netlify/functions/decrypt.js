const crypto = require('crypto');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const apiKey = process.env.PQLS_API_KEY;
    if (!apiKey) {
        const errorBody = JSON.stringify({ error: "Server configuration error: PQLS_API_KEY is not set on the server." });
        console.error("Configuration Error: PQLS_API_KEY is not set.");
        return { statusCode: 500, body: errorBody };
    }

    const authHeader = event.headers.authorization;
    if (!authHeader || authHeader.split(' ')[1] !== apiKey) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    try {
        const { encryptedData, privateKey: privateKeyPem } = JSON.parse(event.body);

        if (!encryptedData || !privateKeyPem) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing encryptedData or privateKey' }) };
        }

        const privateKey = crypto.createPrivateKey(privateKeyPem);

        const decryptedData = crypto.privateDecrypt(
            {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256',
            },
            Buffer.from(encryptedData, 'base64')
        );

        return {
            statusCode: 200,
            body: JSON.stringify({ decryptedData: decryptedData.toString('utf8') }),
        };
    } catch (error) {
        console.error('Decryption error:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: 'An unexpected error occurred during decryption.', details: error.message }) 
        };
    }
};
