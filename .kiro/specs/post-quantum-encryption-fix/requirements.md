# Requirements Document

## Introduction

The Post Quantum Lattice Shield system currently has incomplete encryption/decryption functionality. The WordPress plugin and microservice need to be properly integrated to provide working post-quantum encryption for Gravity Forms fields. Each WordPress site should have unique keys and administrators should be able to mark specific form fields for encryption through a simple checkbox interface.

## Requirements

### Requirement 1

**User Story:** As a WordPress site administrator, I want to generate unique encryption keys for my site, so that my site has its own secure encryption identity separate from other sites using the plugin.

#### Acceptance Criteria

1. WHEN the plugin is first activated THEN it SHALL automatically generate unique ML-KEM-768 keys for the site
2. WHEN key generation is requested THEN the system SHALL call the microservice generate-keypair endpoint
3. WHEN keys are generated THEN they SHALL be stored securely in WordPress options with proper prefixes
4. WHEN key generation fails THEN the system SHALL display clear error messages and retry options

### Requirement 2

**User Story:** As a WordPress administrator, I want to mark specific Gravity Forms fields for encryption using a simple checkbox, so that I can control which sensitive data gets encrypted.

#### Acceptance Criteria

1. WHEN editing a Gravity Forms field THEN there SHALL be an "Encrypt this field" checkbox in the field settings
2. WHEN the encryption checkbox is checked THEN the field SHALL be marked for encryption in the form configuration
3. WHEN viewing form entries THEN encrypted fields SHALL display as "[Encrypted]" with a decrypt button
4. WHEN the form is rendered THEN encrypted fields SHALL have a visual indicator showing they will be encrypted

### Requirement 3

**User Story:** As a website visitor, I want my sensitive form data to be automatically encrypted when I submit forms, so that my information is protected without any extra steps on my part.

#### Acceptance Criteria

1. WHEN a form with encrypted fields is submitted THEN those fields SHALL be encrypted before storage
2. WHEN encryption occurs THEN it SHALL use the site's unique public key and the microservice encrypt endpoint
3. WHEN encryption fails THEN the form submission SHALL be blocked with a user-friendly error message
4. WHEN form submission succeeds THEN the user SHALL see normal confirmation without knowing encryption occurred

### Requirement 4

**User Story:** As a WordPress administrator, I want to decrypt and view encrypted form entries, so that I can access the submitted data when needed.

#### Acceptance Criteria

1. WHEN viewing form entries THEN encrypted fields SHALL show a "Decrypt" button
2. WHEN the decrypt button is clicked THEN the system SHALL call the microservice decrypt endpoint
3. WHEN decryption succeeds THEN the decrypted data SHALL be displayed in place
4. WHEN decryption fails THEN a clear error message SHALL be shown

### Requirement 5

**User Story:** As a system administrator, I want the microservice to properly handle OQS library dependencies, so that post-quantum encryption works reliably in the Netlify environment.

#### Acceptance Criteria

1. WHEN the microservice starts THEN it SHALL verify OQS library availability and log the status
2. WHEN OQS library is not available THEN the system SHALL fall back to RSA encryption with clear warnings
3. WHEN encryption/decryption requests are made THEN the system SHALL use the best available algorithm
4. WHEN library issues occur THEN detailed error messages SHALL be logged for debugging

### Requirement 6

**User Story:** As a WordPress site owner, I want the plugin to work with multiple sites independently, so that each site maintains its own encryption keys and configuration.

#### Acceptance Criteria

1. WHEN the plugin is installed on multiple sites THEN each site SHALL have unique encryption keys
2. WHEN one site's keys are regenerated THEN other sites SHALL be unaffected
3. WHEN viewing encrypted data THEN it SHALL only be decryptable with the correct site's private key
4. WHEN the microservice processes requests THEN it SHALL handle multiple different public/private key pairs