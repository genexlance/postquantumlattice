const pqclean = require('pqclean');

// Rate limiting storage (in-memory for simplicity)
const rateLimitStore = new Map();

// Simple rate limiting function
function checkRateLimit(clientIp) {
  const now = Date.now();
  const windowSize = 60 * 1000; // 1 minute
  const maxRequests = 10; // max 10 keypair generations per minute per IP
  
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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
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

    // Initialize ML-KEM using pqclean
    const kemAlgorithm = 'ml-kem-512'; // Using ML-KEM-512 for balance of security and performance
    const kem = new pqclean.KEM(kemAlgorithm);

    // Generate a new keypair
    const { publicKey, privateKey } = kem.keypair();

    // Return the keypair (base64 encoded for easy transport)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        publicKey: publicKey.toString('base64'),
        privateKey: privateKey.toString('base64'),
        algorithm: kemAlgorithm,
        note: 'This is for development/testing only. In production, generate keypairs on the WordPress site.'
      })
    };

  } catch (error) {
    console.error('Keypair generation error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 