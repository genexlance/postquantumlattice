const pqclean = require('pqclean');
const Joi = require('joi');

// Input validation schema
const decryptSchema = Joi.object({
  privateKey: Joi.string().base64().required(),
  ciphertext: Joi.string().base64().required()
});

// Rate limiting storage (in-memory for simplicity)
const rateLimitStore = new Map();

// Stricter rate limiting for decryption (more sensitive operation)
function checkRateLimit(clientIp) {
  const now = Date.now();
  const windowSize = 60 * 1000; // 1 minute
  const maxRequests = 10; // max 10 decryption requests per minute per IP
  
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

// API key authentication
function authenticateRequest(event) {
  // Log all incoming headers for debugging
  console.log('--- Authentication Start ---');
  console.log('Incoming Headers:', JSON.stringify(event.headers, null, 2));

  const authHeader = event.headers.authorization || event.headers.Authorization;
  const expectedKey = process.env.PQLS_API_KEY;

  // Log the values the function is seeing
  console.log('Auth Header Received:', authHeader);
  console.log('Expected Key from process.env.PQLS_API_KEY (first 5 chars):', expectedKey ? expectedKey.substring(0, 5) + '...' : 'Not Set');

  if (!expectedKey) {
    console.log('Authentication failed: PQLS_API_KEY is not set in the environment.');
    return false; // No API key configured
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Authentication failed: Missing or malformed "Bearer" token.');
    return false;
  }

  const providedKey = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  // Log the keys being compared
  console.log('Provided Key from Header (first 5 chars):', providedKey.substring(0, 5) + '...');
  
  const isAuthenticated = providedKey.trim() === expectedKey.trim();
  
  console.log('Are keys identical?', isAuthenticated);
  console.log('--- Authentication End ---');
  
  return isAuthenticated;
}

exports.handler = async (event) => {
    console.log('Decrypt function invoked.');
    console.log('Received headers:', JSON.stringify(event.headers, null, 2));
    console.log('Received body:', event.body);

    // 1. API Key Authentication
    const apiKey = process.env.DECRYPT_API_KEY;
    const authHeader = event.headers.authorization;

    if (!apiKey) {
        console.error('DECRYPT_API_KEY is not set in environment variables.');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error.' })
        };
    }

    if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
        console.error('Unauthorized access attempt. Invalid or missing API key.');
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Unauthorized' })
        };
    }

  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    // Authenticate the request
    if (!authenticateRequest(event)) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    // Parse and validate the request body
    const body = JSON.parse(event.body);
    const { error, value } = decryptSchema.validate(body);

    if (error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: error.details[0].message })
      };
    }

    const { privateKey, ciphertext } = value;

    // Initialize ML-KEM using pqclean
    const kemAlgorithm = 'ml-kem-512';
    const kem = new pqclean.KEM(kemAlgorithm);

    // Decode the private key and ciphertext from base64
    const privateKeyBuffer = Buffer.from(privateKey, 'base64');
    const ciphertextBuffer = Buffer.from(ciphertext, 'base64');
    
    // Extract the KEM ciphertext (first part) and encrypted payload (rest)
    const kemCiphertextLength = kem.ciphertextLength;
    const kemCiphertext = ciphertextBuffer.slice(0, kemCiphertextLength);
    const encryptedPayload = ciphertextBuffer.slice(kemCiphertextLength);
    
    // Decapsulate to get the shared secret
    const sharedSecret = kem.decapsulate(kemCiphertext, privateKeyBuffer);
    
    // Decrypt the payload by XORing with the shared secret
    const decryptedPayload = Buffer.alloc(encryptedPayload.length);
    for (let i = 0; i < encryptedPayload.length; i++) {
      decryptedPayload[i] = encryptedPayload[i] ^ sharedSecret[i % sharedSecret.length];
    }

    // Convert back to string
    const decryptedText = decryptedPayload.toString('utf8');
    
    // Return the decrypted result
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        decrypted: decryptedText,
        algorithm: kemAlgorithm
      })
    };

  } catch (error) {
    console.error('Decryption error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Decryption failed' })
    };
  }
};
