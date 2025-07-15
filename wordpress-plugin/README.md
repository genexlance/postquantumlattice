# Post Quantum Lattice Shield - WordPress Plugin

A WordPress plugin that secures form data using post-quantum ML-KEM-512 encryption through integration with Gravity Forms.

## Features

- **Post-Quantum Security**: Uses ML-KEM-512 lattice-based encryption
- **Gravity Forms Integration**: Seamlessly encrypts selected form fields
- **Field-Level Control**: Choose which fields to encrypt per form
- **Automatic Key Management**: Generates and manages encryption keys
- **Microservice Architecture**: Leverages remote encryption service
- **Admin Interface**: Easy-to-use settings panel
- **Connection Testing**: Verify microservice connectivity
- **Security Auditing**: Comprehensive logging and monitoring

## Requirements

- WordPress 5.0 or higher
- PHP 7.4 or higher
- Gravity Forms plugin (active)
- Post Quantum Lattice Shield microservice (deployed)

## Installation

1. **Download the Plugin**
   - Download the plugin ZIP file from your microservice
   - Or clone this repository into your WordPress plugins directory

2. **Upload to WordPress**
   - Go to WordPress Admin → Plugins → Add New
   - Click "Upload Plugin"
   - Choose the ZIP file and click "Install Now"
   - Activate the plugin

3. **Configure Settings**
   - Go to Settings → PQ Lattice Shield
   - Enter your microservice URL
   - Test the connection
   - Select fields to encrypt
   - Save settings

## Configuration

### Microservice URL
Enter the URL of your deployed Netlify microservice:
```
https://your-site.netlify.app/api
```

### Field Selection
For each Gravity Form:
1. View the list of available fields
2. Check the boxes for fields you want to encrypt
3. Save your settings

### Key Management
- Keys are automatically generated on plugin activation
- Use "Regenerate Key Pair" to create new keys
- Use "Test Connection" to verify microservice connectivity

## Usage

Once configured, the plugin automatically:
1. Intercepts form submissions
2. Encrypts selected fields using the microservice
3. Stores encrypted data in the database
4. Displays "[ENCRYPTED:...data...]" format in entries

## Security

### What's Encrypted
- Only fields you select are encrypted
- Encryption happens before database storage
- Uses post-quantum resistant algorithms

### Key Storage
- **Public Key**: Stored in WordPress database (safe to view)
- **Private Key**: Stored securely, used only for key generation
- **Encryption**: Performed remotely via HTTPS

### Data Format
Encrypted data is stored in the format:
```
[ENCRYPTED:base64_encoded_ciphertext]
```

## Troubleshooting

### Common Issues

**"Gravity Forms Required" Error**
- Install and activate Gravity Forms plugin
- Ensure it's properly configured

**Connection Test Fails**
- Check microservice URL is correct
- Verify microservice is deployed and running
- Ensure HTTPS is used
- Check firewall/network settings

**Fields Not Encrypting**
- Verify fields are selected in settings
- Check error logs for encryption failures
- Test microservice connection

### Debug Mode
Enable WordPress debug mode to see detailed error messages:
```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
```

Check `/wp-content/debug.log` for PQLS error messages.

## API Reference

### Microservice Endpoints Used

**Generate Keypair**
```http
GET /api/generate-keypair
```

**Encrypt Data**
```http
POST /api/encrypt
Content-Type: application/json

{
  "publicKey": "base64_public_key",
  "payload": "data_to_encrypt"
}
```

### WordPress Hooks

**Actions**
- `pqls_before_encryption` - Fired before field encryption
- `pqls_after_encryption` - Fired after field encryption
- `pqls_key_regenerated` - Fired when keys are regenerated

**Filters**
- `pqls_encrypt_field` - Filter to modify field encryption behavior
- `pqls_microservice_url` - Filter to modify microservice URL
- `pqls_encryption_timeout` - Filter to modify request timeout

## Development

### File Structure
```
wordpress-plugin/
├── post-quantum-lattice-shield.php    # Main plugin file
├── assets/
│   ├── admin.css                       # Admin styles
│   └── admin.js                        # Admin JavaScript
└── README.md                           # This file
```

### Customization
You can extend the plugin by:
1. Adding custom hooks and filters
2. Creating custom admin pages
3. Adding field type support
4. Implementing decryption features

## Support

For support:
1. Check the troubleshooting section
2. Review error logs
3. Test microservice connectivity
4. Submit issues on GitHub

## License

MIT License - see LICENSE file for details.

## Changelog

### 1.0.0
- Initial release
- ML-KEM-512 encryption support
- Gravity Forms integration
- Admin interface
- Connection testing
- Field-level encryption selection 