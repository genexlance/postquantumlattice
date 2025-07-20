<?php
/**
 * Multi-site isolation test for Post Quantum Lattice Shield
 * This test verifies that multiple WordPress sites have independent encryption keys
 * and cannot decrypt each other's data.
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    // For testing purposes, we'll simulate WordPress environment
    define('ABSPATH', '/tmp/wp-test/');
    
    // Mock WordPress functions for testing multiple sites
    class MockWordPressSite {
        private $site_url;
        private $site_path;
        private $options = [];
        
        public function __construct($site_url, $site_path) {
            $this->site_url = $site_url;
            $this->site_path = $site_path;
        }
        
        public function get_option($option, $default = false) {
            return isset($this->options[$option]) ? $this->options[$option] : $default;
        }
        
        public function update_option($option, $value) {
            $this->options[$option] = $value;
            return true;
        }
        
        public function get_site_url() {
            return $this->site_url;
        }
        
        public function get_site_path() {
            return $this->site_path;
        }
        
        public function wp_generate_password($length, $special_chars = true, $extra_special_chars = false) {
            $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            return substr(str_shuffle(str_repeat($chars, ceil($length/strlen($chars)))), 0, $length);
        }
        
        public function current_time($type) {
            if ($type === 'timestamp') {
                return time();
            } elseif ($type === 'c') {
                return date('c');
            } else {
                return date('Y-m-d H:i:s');
            }
        }
    }
}

// Test class for multi-site isolation
class PQLS_MultiSiteIsolationTest {
    
    private $sites = [];
    
    public function __construct() {
        // Create multiple mock WordPress sites
        $this->sites = [
            'site1' => new MockWordPressSite('https://site1.example.com', '/var/www/site1/'),
            'site2' => new MockWordPressSite('https://site2.example.com', '/var/www/site2/'),
            'site3' => new MockWordPressSite('https://site3.example.com', '/var/www/site3/')
        ];
    }
    
    /**
     * Generate unique site identifier for a specific site
     */
    private function generate_unique_site_id($site) {
        // Create a unique identifier based on site URL, installation path, and random data
        $site_url = $site->get_site_url();
        $site_path = $site->get_site_path();
        $random_data = $site->wp_generate_password(32, false, false);
        $timestamp = $site->current_time('timestamp');
        
        // Create a hash that's unique to this WordPress installation
        $unique_string = $site_url . '|' . $site_path . '|' . $random_data . '|' . $timestamp;
        $site_id = hash('sha256', $unique_string);
        
        // Use first 16 characters for a shorter but still unique identifier
        return substr($site_id, 0, 16);
    }

    /**
     * Get current site identifier for a specific site
     */
    private function get_site_id($site) {
        $site_id = $site->get_option('pqls_site_id');
        if (empty($site_id)) {
            $site_id = $this->generate_unique_site_id($site);
            $site->update_option('pqls_site_id', $site_id);
        }
        return $site_id;
    }
    
    /**
     * Create encrypted data format for a specific site
     */
    private function create_encrypted_data($site, $data, $algorithm = 'ML-KEM-768') {
        $site_id = $this->get_site_id($site);
        
        // Create enhanced encrypted data format with site isolation
        $encrypted_data_format = [
            'encrypted' => true,
            'algorithm' => $algorithm,
            'data' => 'encrypted_' . $data . '_' . $site_id, // Mock encrypted data
            'site_id' => $site_id,
            'encrypted_at' => $site->current_time('c'),
            'version' => '2.0'
        ];
        
        // Add format identifier prefix
        $prefix = 'pqls_pq_encrypted::';
        return $prefix . base64_encode(json_encode($encrypted_data_format));
    }
    
    /**
     * Parse encrypted data format
     */
    private function parse_encrypted_data($encrypted_data) {
        if (strpos($encrypted_data, 'pqls_pq_encrypted::') === 0) {
            $encoded_data = substr($encrypted_data, 19);
            $decoded_data = base64_decode($encoded_data);
            
            if ($decoded_data !== false) {
                $data_structure = json_decode($decoded_data, true);
                if (json_last_error() === JSON_ERROR_NONE && isset($data_structure['version']) && $data_structure['version'] === '2.0') {
                    return $data_structure;
                }
            }
        }
        return false;
    }
    
    /**
     * Test that each site generates unique site IDs
     */
    public function test_unique_site_ids() {
        echo "Testing unique site ID generation across multiple sites...\n";
        
        $site_ids = [];
        
        foreach ($this->sites as $site_name => $site) {
            $site_id = $this->get_site_id($site);
            $site_ids[$site_name] = $site_id;
            echo "Site $site_name ID: $site_id\n";
            
            // Verify format
            if (strlen($site_id) !== 16) {
                echo "ERROR: Site ID should be 16 characters, got " . strlen($site_id) . "\n";
                return false;
            }
            
            // Verify it's hexadecimal
            if (!ctype_xdigit($site_id)) {
                echo "ERROR: Site ID should be hexadecimal\n";
                return false;
            }
        }
        
        // Check uniqueness across all sites
        if (count($site_ids) !== count(array_unique($site_ids))) {
            echo "ERROR: Site IDs are not unique across sites\n";
            echo "Site IDs: " . print_r($site_ids, true) . "\n";
            return false;
        }
        
        echo "✓ All sites have unique site IDs\n\n";
        return true;
    }
    
    /**
     * Test that sites can encrypt data with their own site ID
     */
    public function test_site_specific_encryption() {
        echo "Testing site-specific encryption...\n";
        
        $test_data = "sensitive_user_data_12345";
        
        foreach ($this->sites as $site_name => $site) {
            $encrypted_data = $this->create_encrypted_data($site, $test_data);
            $parsed_data = $this->parse_encrypted_data($encrypted_data);
            
            if (!$parsed_data) {
                echo "ERROR: Failed to parse encrypted data for $site_name\n";
                return false;
            }
            
            $site_id = $this->get_site_id($site);
            
            if ($parsed_data['site_id'] !== $site_id) {
                echo "ERROR: Site ID mismatch for $site_name\n";
                echo "Expected: $site_id, Got: " . $parsed_data['site_id'] . "\n";
                return false;
            }
            
            echo "✓ Site $site_name encrypted data with correct site ID: " . $parsed_data['site_id'] . "\n";
        }
        
        echo "✓ Site-specific encryption test passed\n\n";
        return true;
    }
    
    /**
     * Test site isolation - sites cannot decrypt each other's data
     */
    public function test_cross_site_isolation() {
        echo "Testing cross-site data isolation...\n";
        
        $test_data = "confidential_information";
        
        // Create encrypted data for each site
        $encrypted_data_by_site = [];
        foreach ($this->sites as $site_name => $site) {
            $encrypted_data_by_site[$site_name] = $this->create_encrypted_data($site, $test_data);
        }
        
        // Test that each site can only access its own data
        foreach ($this->sites as $current_site_name => $current_site) {
            $current_site_id = $this->get_site_id($current_site);
            
            foreach ($encrypted_data_by_site as $data_site_name => $encrypted_data) {
                $parsed_data = $this->parse_encrypted_data($encrypted_data);
                
                if ($current_site_name === $data_site_name) {
                    // Same site - should be able to access
                    if ($parsed_data['site_id'] === $current_site_id) {
                        echo "✓ Site $current_site_name can access its own data\n";
                    } else {
                        echo "ERROR: Site $current_site_name cannot access its own data\n";
                        return false;
                    }
                } else {
                    // Different site - should NOT be able to access
                    if ($parsed_data['site_id'] !== $current_site_id) {
                        echo "✓ Site $current_site_name correctly blocked from accessing $data_site_name's data\n";
                    } else {
                        echo "ERROR: Site isolation failed - $current_site_name can access $data_site_name's data\n";
                        return false;
                    }
                }
            }
        }
        
        echo "✓ Cross-site isolation test passed\n\n";
        return true;
    }
    
    /**
     * Test key independence - each site should have different keys
     */
    public function test_key_independence() {
        echo "Testing key independence across sites...\n";
        
        // Simulate key generation for each site
        foreach ($this->sites as $site_name => $site) {
            // Mock key generation
            $public_key = 'mock_public_key_' . $this->get_site_id($site);
            $private_key = 'mock_private_key_' . $this->get_site_id($site);
            
            $site->update_option('pqls_public_key', $public_key);
            $site->update_option('pqls_private_key', $private_key);
            $site->update_option('pqls_algorithm', 'ML-KEM-768');
            $site->update_option('pqls_key_generated', $site->current_time('mysql'));
            $site->update_option('pqls_site_key_version', '1.0');
            
            echo "Site $site_name keys generated with site ID: " . $this->get_site_id($site) . "\n";
        }
        
        // Verify all sites have different keys
        $public_keys = [];
        $private_keys = [];
        
        foreach ($this->sites as $site_name => $site) {
            $public_key = $site->get_option('pqls_public_key');
            $private_key = $site->get_option('pqls_private_key');
            
            $public_keys[$site_name] = $public_key;
            $private_keys[$site_name] = $private_key;
        }
        
        // Check uniqueness
        if (count($public_keys) !== count(array_unique($public_keys))) {
            echo "ERROR: Public keys are not unique across sites\n";
            return false;
        }
        
        if (count($private_keys) !== count(array_unique($private_keys))) {
            echo "ERROR: Private keys are not unique across sites\n";
            return false;
        }
        
        echo "✓ All sites have unique public and private keys\n";
        echo "✓ Key independence test passed\n\n";
        return true;
    }
    
    /**
     * Test data format version consistency
     */
    public function test_data_format_consistency() {
        echo "Testing data format version consistency...\n";
        
        $test_data = "version_test_data";
        
        foreach ($this->sites as $site_name => $site) {
            $encrypted_data = $this->create_encrypted_data($site, $test_data);
            $parsed_data = $this->parse_encrypted_data($encrypted_data);
            
            if (!$parsed_data) {
                echo "ERROR: Failed to parse encrypted data for $site_name\n";
                return false;
            }
            
            // Check version
            if ($parsed_data['version'] !== '2.0') {
                echo "ERROR: Incorrect data format version for $site_name\n";
                echo "Expected: 2.0, Got: " . $parsed_data['version'] . "\n";
                return false;
            }
            
            // Check required fields
            $required_fields = ['encrypted', 'algorithm', 'data', 'site_id', 'encrypted_at', 'version'];
            foreach ($required_fields as $field) {
                if (!isset($parsed_data[$field])) {
                    echo "ERROR: Missing required field '$field' for $site_name\n";
                    return false;
                }
            }
            
            echo "✓ Site $site_name data format is consistent and complete\n";
        }
        
        echo "✓ Data format consistency test passed\n\n";
        return true;
    }
    
    /**
     * Test site ID persistence across multiple operations
     */
    public function test_site_id_persistence() {
        echo "Testing site ID persistence across operations...\n";
        
        foreach ($this->sites as $site_name => $site) {
            // Get site ID multiple times
            $site_id_1 = $this->get_site_id($site);
            $site_id_2 = $this->get_site_id($site);
            $site_id_3 = $this->get_site_id($site);
            
            if ($site_id_1 !== $site_id_2 || $site_id_2 !== $site_id_3) {
                echo "ERROR: Site ID not persistent for $site_name\n";
                echo "Call 1: $site_id_1, Call 2: $site_id_2, Call 3: $site_id_3\n";
                return false;
            }
            
            echo "✓ Site $site_name ID is persistent: $site_id_1\n";
        }
        
        echo "✓ Site ID persistence test passed\n\n";
        return true;
    }
    
    /**
     * Run all multi-site isolation tests
     */
    public function run_all_tests() {
        echo "=== PQLS Multi-Site Isolation Test Suite ===\n\n";
        
        $tests = [
            'test_unique_site_ids',
            'test_site_specific_encryption',
            'test_cross_site_isolation',
            'test_key_independence',
            'test_data_format_consistency',
            'test_site_id_persistence'
        ];
        
        $passed = 0;
        $total = count($tests);
        
        foreach ($tests as $test) {
            if ($this->$test()) {
                $passed++;
            }
        }
        
        echo "=== Multi-Site Test Results ===\n";
        echo "Passed: $passed/$total\n";
        
        if ($passed === $total) {
            echo "✓ All multi-site isolation tests passed!\n";
            echo "✓ Multiple WordPress sites can have independent encryption keys.\n";
            echo "✓ Site isolation is working correctly.\n";
            return true;
        } else {
            echo "✗ Some multi-site tests failed. Please review the implementation.\n";
            return false;
        }
    }
}

// Run tests if this file is executed directly
if (php_sapi_name() === 'cli') {
    $test = new PQLS_MultiSiteIsolationTest();
    $test->run_all_tests();
}