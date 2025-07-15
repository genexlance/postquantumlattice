const pqclean = require('pqclean');
const Joi = require('joi');

// Input validation schema
const encryptSchema = Joi.object({
  publicKey: Joi.string().base64().required(),
  payload: Joi.string().required()
});

// Rate limiting storage (in-memory for simplicity)
const rateLimitStore = new Map();

// Simple rate limiting function
function checkRateLimit(clientIp) {
  const now = Date.now();
  const windowSize = 60 * 1000; // 1 minute
  const maxRequests = 100; // max 100 requests per minute per IP
  
  if (!rateLimitStore.has(clientIp)) {
    rateLimitStore.set(clientIp, []);
  }
  
  const requests = rateLimitStore.get(clientIp);
  // Filter out old requests
  const recentRequests = requests.filter(timestamp => now - timestamp < windowSize);
  
  if (recentRequests.length >= maxRequests) {
    return false;
  }
  
  // Add current request
  recentRequests.push(now);
  rateLimitStore.set(clientIp, recentRequests);
  
  return true;
}

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Rate limiting
    const clientIp = event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ error: 'Rate limit exceeded' })
      };
    }

    // Parse and validate request body
    const body = JSON.parse(event.body);
    const { error, value } = encryptSchema.validate(body);
    
    if (error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: error.details[0].message })
      };
    }

    const { publicKey, payload } = value;

    // Initialize ML-KEM using pqclean
    const kemAlgorithm = 'ml-kem-512'; // Using ML-KEM-512 for balance of security and performance
    const kem = new pqclean.KEM(kemAlgorithm);

    // Decode the public key from base64
    const publicKeyBuffer = Buffer.from(publicKey, 'base64');
    
    // Generate key (encapsulate) to get shared secret and ciphertext
    const { key, encryptedKey } = kem.generateKey(publicKeyBuffer);
    
    // For simplicity, we'll use a basic XOR encryption with the shared secret
    // In production, you'd want to use a proper symmetric encryption algorithm
    const payloadBuffer = Buffer.from(payload, 'utf8');
    const encryptedPayload = Buffer.alloc(payloadBuffer.length);
    
    // XOR the payload with the shared secret (cycling through the secret)
    for (let i = 0; i < payloadBuffer.length; i++) {
      encryptedPayload[i] = payloadBuffer[i] ^ key[i % key.length];
    }

    // Combine the KEM ciphertext with the encrypted payload
    const combinedCiphertext = Buffer.concat([encryptedKey, encryptedPayload]);
    
    // Return the encrypted result
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        encrypted: combinedCiphertext.toString('base64'),
        algorithm: kemAlgorithm
      })
    };

  } catch (error) {
    console.error('Encryption error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 