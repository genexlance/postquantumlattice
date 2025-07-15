# Post Quantum Lattice Shield

A secure microservice for encrypting WordPress form data using post-quantum lattice-based asymmetric encryption (Kyber).

## Overview

Post Quantum Lattice Shield provides a secure solution for encrypting sensitive form data submitted through WordPress Gravity Forms. The system uses Kyber post-quantum encryption algorithms to protect against both classical and quantum computing attacks.

## Architecture

- **Microservice**: Netlify-hosted serverless functions providing encryption endpoints
- **WordPress Plugin**: Integrates with Gravity Forms to encrypt selected fields
- **Encryption**: Uses ML-KEM-512 lattice-based cryptography for post-quantum security

## Features

- 🔒 **Post-Quantum Security**: Kyber lattice-based encryption resistant to quantum attacks
- ⚡ **Seamless Integration**: Direct integration with WordPress Gravity Forms
- 🌐 **Cloud-Powered**: Serverless architecture on Netlify for reliability
- 🔧 **Easy Configuration**: Simple admin interface for field selection
- 📊 **Rate Limiting**: Built-in protection against abuse
- 🔄 **CORS Support**: Secure cross-origin requests from WordPress sites

## API Endpoints

### POST /api/encrypt
Encrypts form data using provided public key.

**Request:**
```json
{
  "publicKey": "base64_encoded_public_key",
  "payload": "sensitive_data_to_encrypt"
}
```

**Response:**
```json
{
  "encrypted": "base64_encoded_ciphertext",
  "algorithm": "ml-kem-512"
}
```

### GET /api/generate-keypair
Generates a new Kyber keypair for development/testing.

**Response:**
```json
{
  "publicKey": "base64_encoded_public_key",
  "privateKey": "base64_encoded_private_key",
  "algorithm": "ml-kem-512"
}
```

## Quick Start

### Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Visit `http://localhost:8888` to view the landing page

### Deployment

The service is designed to be deployed on Netlify:

1. Connect your repository to Netlify
2. Build settings are configured in `netlify.toml`
3. Deploy automatically triggers on push to main branch

## Project Structure

```
postquantumlattice/
├── netlify/
│   └── functions/
│       ├── encrypt.js          # Main encryption endpoint
│       └── generate-keypair.js # Key generation for testing
├── public/
│   ├── css/
│   │   └── styles.css         # Landing page styles
│   ├── js/
│   │   └── main.js            # Frontend functionality
│   ├── plugin-download/       # WordPress plugin distribution
│   └── index.html             # Landing page
├── package.json               # Node.js dependencies
├── netlify.toml              # Netlify configuration
└── README.md                 # This file
```

## Security Features

- **Rate Limiting**: 100 requests per minute per IP for encryption, 10 for keypair generation
- **Input Validation**: All inputs validated using Joi schema validation
- **CORS Protection**: Configured for secure cross-origin requests
- **Error Handling**: Comprehensive error handling without information leakage
- **HTTPS Only**: All communications secured with TLS

## Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Netlify Functions
- **Encryption**: pqclean (ml-kem-512)
- **Validation**: Joi
- **Rate Limiting**: express-rate-limit
- **Frontend**: Vanilla HTML/CSS/JavaScript

## Development Status

✅ **Completed:**
- Project setup and configuration
- Microservice with encryption endpoints
- Modern responsive landing page
- Rate limiting and security features
- CORS configuration for WordPress integration

🚧 **In Progress:**
- WordPress plugin development
- Comprehensive API documentation

📋 **Planned:**
- Security audit and testing
- Deployment to production
- User documentation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support, please open an issue in the GitHub repository or contact the development team. 

To set up the microservice, you will need to create a `netlify.toml` file in the root of the project and add the following content:

```toml
[build]
  functions = "netlify/functions"
  publish = "public"

[functions]
  node_bundler = "esbuild"
  [functions.node_options]
    # Add any Node.js options here
```

You will also need to set the `PQLS_API_KEY` environment variable in your Netlify site settings.

### Building the Plugin

To build the plugin, you will need to have Node.js and npm installed. Once you have them installed, run the following commands in the root of the project:

```bash
npm install
npm run build
```

This will create a `postquantumlatticeshield.zip` file in the `public/plugin-download` directory. You can then upload this file to your WordPress site. 