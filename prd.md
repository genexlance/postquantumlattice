Product Requirements Document (PRD)
Project Name: Post Quantum Lattice Shield

1. Objective
The goal is to create a secure system for encrypting form data submitted via WordPress sites using post-quantum lattice-based asymmetric encryption (Kyber). The system consists of a Netlify-hosted microservice and a WordPress plugin that integrates with Gravity Forms.

2. Components
2.1 Microservice (Primary Component)
Hosting: Deployed on Netlify

Purpose: Accept requests from WordPress plugins and return Kyber-encrypted data

Endpoints:

POST /encrypt: Accepts a public key and a plaintext payload, returns encrypted ciphertext

GET /plugin-download: Serves the WordPress plugin ZIP file for download

(Optional for dev/testing) GET /generate-keypair: Returns a generated Kyber key pair

2.2 WordPress Plugin (Secondary Component)
Purpose: Hook into Gravity Forms to encrypt selected form fields before submission is stored

Functionality:

Generates and stores a Kyber key pair on activation (or manually from settings page)

Saves public key in WordPress DB (wp_options)

Sends selected field values to the microservice for encryption

Replaces submitted values with ciphertext before saving

Offers admin settings page to:

Select fields to encrypt

View public key

Regenerate key pair (with warning)

3. Data Flow
On form submission, the plugin intercepts the data via Gravity Forms hook

It identifies the fields marked for encryption

It sends a POST request to the microservice:

json
Copy
Edit
{
  "publicKey": "base64 string",
  "payload": "sensitive string"
}
The microservice returns:

json
Copy
Edit
{
  "encrypted": "base64 ciphertext"
}
The plugin replaces the original value with the encrypted string before Gravity Forms saves it

4. Encryption Model
Type: Asymmetric lattice-based encryption (Kyber)

Public Key: Stored in WordPress site (safe to expose)

Private Key: Stored only in WordPress site for keypair generation; not used by the plugin

Encryption Handling: All encryption is performed by the microservice

Decryption: Not included in MVP; may be added in future with authenticated endpoint

5. Deployment Structure
Netlify Site:

Contains:

/functions/encrypt.js (Netlify Function)

Optional /functions/generate-keypair.js

/public/index.html frontend landing page

/public/plugin-download/plugin.zip (downloadable WordPress plugin)

Plugin:

Stored in the Netlify site under /public/plugin-download/

Can be downloaded by users from the microservice frontend

6. Technical Stack
Microservice:
Language: Node.js

Libs: @openquantumsafe/liboqs-node, express, body-parser

Platform: Netlify

Plugin:
Platform: WordPress

Language: PHP

Dependencies: Gravity Forms, WordPress REST API

7. Security Considerations
Public key is safe to store and transmit

Transport must use HTTPS (enforced by Netlify)

No private key ever leaves the WordPress site

Microservice should implement rate-limiting

Optional API key or nonce token for plugin → microservice authentication

8. MVP Feature List
Feature	Microservice	Plugin
/encrypt endpoint	✅	–
Key pair generation (Node or PHP)	✅ (optional)	✅
Gravity Forms field encryption	–	✅
Plugin settings panel	–	✅
Field-level encryption selection	–	✅
Public key storage in WP	–	✅
ZIP download served from site	✅	–

9. Future Enhancements
Decryption support via secure endpoint

Key rotation and multi-key support

GPG-style digital signatures

Admin-controlled access logs or audit trail

Encrypted export/import

10. Distribution
The plugin will be made available for download directly from the frontend of the Netlify-hosted microservice site

No public plugin directory publishing planned at this time

Let me know if you'd like this dropped into a formatted document (Google Docs, Markdown, PDF), or if you're ready to start scaffolding out the Netlify function and repo structure.