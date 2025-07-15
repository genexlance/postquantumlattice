const crypto = require('crypto');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { data, publicKey: publicKeyPem } = JSON.parse(event.body);

        if (!data || !publicKeyPem) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing data or publicKey' }) };
        }

        const publicKey = crypto.createPublicKey(publicKeyPem);

        const encryptedData = crypto.publicEncrypt(
            {
                key: publicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256',
            },
            Buffer.from(data)
        );

        return {
            statusCode: 200,
            body: JSON.stringify({ encryptedData: encryptedData.toString('base64') }),
        };
    } catch (error) {
        console.error('Encryption error:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: 'An unexpected error occurred during encryption.', details: error.message }) 
        };
    }
}; 