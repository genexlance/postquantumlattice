# 🚀 Post-Quantum Lattice Shield Deployment Setup Guide

This guide will help you properly configure and deploy the Post-Quantum Lattice Shield microservice with all required environment variables and security settings.

## 📋 Prerequisites

- Node.js 18.19.1 or higher
- npm 10.0.0 or higher
- Netlify account
- WordPress site (for plugin integration)

## 🔐 Step 1: Generate API Key

The `PQLS_API_KEY` is required for the decryption endpoint security. Generate a secure API key:

```bash
# Generate API key options
node scripts/generate-api-key.js

# Quick generation
node scripts/generate-api-key.js --quick

# Validate existing key
node scripts/generate-api-key.js --validate your-existing-key
```

**Example Output:**
```
🔐 Post-Quantum Lattice Shield API Key Generator

🎲 Generated API Key Options:

1. Standard (64 bytes):
   vK8mN2pQ7rS9tU1wX4yZ6aB3cD5eF8gH0iJ2kL4mN6oP8qR0sT2uV4wX6yZ8aB1c

2. High Security (96 bytes):
   xY9zA2bC4dE6fG8hI0jK2lM4nO6pQ8rS0tU2vW4xY6zA8bC0dE2fG4hI6jK8lM0n

3. Maximum Security (128 bytes):
   pQ2rS4tU6vW8xY0zA2bC4dE6fG8hI0jK2lM4nO6pQ8rS0tU2vW4xY6zA8bC0dE2f
```

💡 **Recommendation:** Use option 2 (High Security) for production deployments.

## 🌐 Step 2: Configure Netlify Environment Variables

### Method 1: Netlify Dashboard (Recommended)

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** > **Environment variables**
3. Click **Add a variable**
4. Add the following environment variable:
   - **Key:** `PQLS_API_KEY`
   - **Value:** Your generated API key from Step 1
   - **Scopes:** Select both "Builds" and "Functions"
5. Click **Save**
6. Redeploy your site

### Method 2: Netlify CLI

```bash
# Set the API key using Netlify CLI
netlify env:set PQLS_API_KEY "your-generated-api-key-here"

# Verify the variable is set
netlify env:list
```

### Method 3: netlify.toml (Not Recommended for Production)

⚠️ **Warning:** Only use this method for development. Never commit real API keys to version control.

```toml
[build.environment]
  PQLS_API_KEY = "dev-api-key-only-for-testing"
```

## 🔧 Step 3: Local Development Setup

For local development, create a `.env` file in your project root:

```bash
# Create .env file
echo "PQLS_API_KEY=your-development-api-key-here" > .env

# Make sure .env is in .gitignore
echo ".env" >> .gitignore
```

**Example .env file:**
```
PQLS_API_KEY=dev-vK8mN2pQ7rS9tU1wX4yZ6aB3cD5eF8gH0iJ2kL4mN6oP8qR0sT2uV4wX6yZ8aB1c
NODE_ENV=development
```

## 🔌 Step 4: WordPress Plugin Configuration

1. Install and activate the Post-Quantum Lattice Shield WordPress plugin
2. Go to **WordPress Admin** > **Settings** > **Post-Quantum Lattice Shield**
3. Configure the following settings:
   - **Microservice URL:** Your Netlify site URL (e.g., `https://postquantumlatticeshield.netlify.app/`)
   - **API Key:** The same API key you set in Netlify
   - **Security Level:** Choose between "Standard" (ML-KEM-768) or "High" (ML-KEM-1024)
4. Click **Save Settings**
5. Use the **Test Connection** button to verify the setup

## 🧪 Step 5: Test the Deployment

### Test 1: Function Availability

```bash
# Test that functions are deployed and accessible
curl https://postquantumlatticeshield.netlify.app/.netlify/functions/status
```

**Expected Response:**
```json
{
  "status": "operational",
  "timestamp": "2025-01-16T22:30:00.000Z",
  "version": "1.0.0",
  "oqs": {
    "available": true,
    "algorithms": ["ML-KEM-768", "ML-KEM-1024"]
  }
}
```

### Test 2: Key Generation

```bash
# Test keypair generation
curl https://postquantumlatticeshield.netlify.app/.netlify/functions/generate-keypair
```

### Test 3: Encryption/Decryption Workflow

```bash
# 1. Generate a keypair
KEYPAIR=$(curl -s https://postquantumlatticeshield.netlify.app/.netlify/functions/generate-keypair)
PUBLIC_KEY=$(echo $KEYPAIR | jq -r '.publicKey')
PRIVATE_KEY=$(echo $KEYPAIR | jq -r '.privateKey')

# 2. Encrypt test data
ENCRYPTED=$(curl -s -X POST https://postquantumlatticeshield.netlify.app/.netlify/functions/encrypt \
  -H "Content-Type: application/json" \
  -d "{\"data\":\"Hello, Post-Quantum World!\",\"publicKey\":\"$PUBLIC_KEY\"}")

# 3. Decrypt the data
curl -X POST https://postquantumlatticeshield.netlify.app/.netlify/functions/decrypt \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d "{\"encryptedData\":$ENCRYPTED,\"privateKey\":\"$PRIVATE_KEY\"}"
```

### Test 4: WordPress Plugin Test

1. Go to **WordPress Admin** > **Settings** > **Post-Quantum Lattice Shield**
2. Click the **Test Decryption** button
3. Verify you see: "✅ Decryption test passed!"

## 🔍 Troubleshooting

### Issue: "PQLS_API_KEY is not set on the server"

**Solution:**
1. Verify the environment variable is set in Netlify dashboard
2. Redeploy the site after setting the variable
3. Check that the variable name is exactly `PQLS_API_KEY` (case-sensitive)

### Issue: "Unauthorized" (401 error)

**Solution:**
1. Verify the API key in WordPress plugin matches the Netlify environment variable
2. Check that the Authorization header format is: `Bearer your-api-key`
3. Ensure there are no extra spaces or characters in the API key

### Issue: "OQS library not available"

**Solution:**
1. Check the build logs in Netlify for OQS compilation errors
2. Verify Node.js version is 18.19.1 or higher
3. Try redeploying the site to trigger a fresh build

### Issue: Functions timeout or memory errors

**Solution:**
1. Check function memory allocation in `netlify.toml`
2. Verify the functions are using the optimized memory settings
3. Monitor function execution time in Netlify dashboard

## 📊 Monitoring and Maintenance

### Log Monitoring

Monitor your Netlify function logs for:
- API key usage patterns
- Encryption/decryption success rates
- Performance metrics
- Error patterns

### Security Best Practices

1. **Rotate API Keys Regularly**
   ```bash
   # Generate new API key
   node scripts/generate-api-key.js --quick
   
   # Update in Netlify dashboard
   # Update in WordPress plugin
   ```

2. **Monitor API Usage**
   - Set up Netlify analytics
   - Monitor for unusual traffic patterns
   - Set up alerts for high error rates

3. **Regular Security Updates**
   - Keep Node.js dependencies updated
   - Monitor for OQS library updates
   - Review and update security configurations

### Performance Optimization

1. **Function Cold Starts**
   - Functions are optimized for serverless constraints
   - Memory allocation is tuned for post-quantum operations
   - OQS library is cached for better performance

2. **WordPress Integration**
   - Use caching for public keys
   - Batch encrypt multiple fields when possible
   - Monitor form submission performance

## 🆘 Support

If you encounter issues:

1. Check the [troubleshooting section](#-troubleshooting) above
2. Review Netlify function logs
3. Test with the provided curl commands
4. Open an issue in the GitHub repository with:
   - Error messages
   - Function logs
   - Configuration details (without API keys)

## 🔄 Updates and Maintenance

### Updating the Deployment

```bash
# Pull latest changes
git pull origin main

# Run tests
npm run test:all

# Deploy to preview
npm run deploy:preview

# Verify deployment
npm run verify:deployment

# Deploy to production
npm run deploy:production
```

### Monitoring Deployment Health

```bash
# Check runtime compatibility
npm run verify:runtime

# Test OQS library
npm run test:oqs

# Run all tests
npm run test:all
```

---

## 📝 Quick Reference

| Environment Variable | Purpose | Required | Example |
|---------------------|---------|----------|---------|
| `PQLS_API_KEY` | Decryption endpoint security | Yes | `vK8mN2pQ7rS9tU1w...` |
| `NODE_ENV` | Environment mode | No | `production` |
| `OQS_ENABLE_KEM_ML_KEM` | Enable ML-KEM algorithms | Auto-set | `ON` |

| Function | Memory | Timeout | Purpose |
|----------|--------|---------|---------|
| encrypt | 1536MB | 30s | Encrypt form data |
| decrypt | 1536MB | 30s | Decrypt form data |
| generate-keypair | 1024MB | 20s | Generate key pairs |
| status | 512MB | 15s | Health check |
| monitor | 512MB | 15s | System monitoring |

---

**🎉 Congratulations!** Your Post-Quantum Lattice Shield is now properly configured and ready for production use with full ML-KEM post-quantum encryption support!