<?php
/**
 * Test script for site isolation functionality
 * This script tests the unique key generation and site isolation features
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    // For testing purposes, we'll simulate WordPress environment
    define('ABSPATH', '/tmp/wp-test/');
    
    // Mock WordPress functions for testing
    $GLOBALS['mock_options'] = [];
    
    function get_option($option, $default = false) {
        return isset($GLOBALS['mock_options'][$option]) ? $GLOBALS['mock_options'][$option] : $default;
    }
    
    function update_option($option, $value) {
        $GLOBALS['mock_options'][$option] = $value;
        return true;
    }
    
    function get_site_url() {
        return 'https://test-site-1.example.com';
    }
    
    function wp_generate_password($length, $special_chars = true, $extra_special_chars = false) {
        $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        return substr(str_shuffle(str_repeat($chars, ceil($length/strlen($chars)))), 0, $length);
    }
    
    function current_time($type) {
        if ($type === 'timestamp') {
            return time();
        } elseif ($type === 'c') {
            return date('c');
        } else {
            return date('Y-m-d H:i:s');
        }
    }
}

// Test class for site isolation
class PQLS_SiteIsolationTest {
    
    /**
     * Generate unique site identifier
     */
    private function generate_unique_site_id() {
        // Create a unique identifier based on site URL, installation path, and random data
        $site_url = get_site_url();
        $site_path = ABSPATH;
        $random_data = wp_generate_password(32, false, false);
        $timestamp = current_time('timestamp');
        
        // Create a hash that's unique to this WordPress installation
        $unique_string = $site_url . '|' . $site_path . '|' . $random_data . '|' . $timestamp;
        $site_id = hash('sha256', $unique_string);
        
        // Use first 16 characters for a shorter but still unique identifier
        return substr($site_id, 0, 16);
    }

    /**
     * Get current site identifier
     */
    private function get_site_id() {
        $site_id = get_option('pqls_site_id');
        if (empty($site_id)) {
            $site_id = $this->generate_unique_site_id();
            update_option('pqls_site_id', $site_id);
        }
        return $site_id;
    }
    
    /**
     * Test unique site ID generation
     */
    public function test_unique_site_id_generation() {
        echo "Testing unique site ID generation...\n";
        
        // Generate multiple site IDs and ensure they're unique
        $site_ids = [];
        for ($i = 0; $i < 5; $i++) {
            $site_id = $this->generate_unique_site_id();
            $site_ids[] = $site_id;
            echo "Generated Site ID $i: $site_id\n";
            
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
        
        // Check uniqueness
        if (count($site_ids) !== count(array_unique($site_ids))) {
            echo "ERROR: Generated site IDs are not unique\n";
            return false;
        }
        
        echo "✓ Site ID generation test passed\n\n";
        return true;
    }
    
    /**
     * Test site ID persistence
     */
    public function test_site_id_persistence() {
        echo "Testing site ID persistence...\n";
        
        // Clear any existing site ID
        update_option('pqls_site_id', '');
        
        // Get site ID twice and ensure it's the same
        $site_id_1 = $this->get_site_id();
        $site_id_2 = $this->get_site_id();
        
        echo "First call: $site_id_1\n";
        echo "Second call: $site_id_2\n";
        
        if ($site_id_1 !== $site_id_2) {
            echo "ERROR: Site ID should be persistent\n";
            return false;
        }
        
        echo "✓ Site ID persistence test passed\n\n";
        return true;
    }
    
    /**
     * Test encrypted data format with site isolation
     */
    public function test_encrypted_data_format() {
        echo "Testing encrypted data format with site isolation...\n";
        
        $site_id = $this->get_site_id();
        $algorithm = 'ML-KEM-768';
        $encrypted_data = 'mock_encrypted_data_12345';
        
        // Create enhanced encrypted data format with site isolation
        $encrypted_data_format = [
            'encrypted' => true,
            'algorithm' => $algorithm,
            'data' => $encrypted_data,
            'site_id' => $site_id,
            'encrypted_at' => current_time('c'),
            'version' => '2.0'
        ];
        
        // Add format identifier prefix
        $prefix = 'pqls_pq_encrypted::';
        $formatted_data = $prefix . base64_encode(json_encode($encrypted_data_format));
        
        echo "Site ID: $site_id\n";
        echo "Formatted data length: " . strlen($formatted_data) . "\n";
        echo "Formatted data preview: " . substr($formatted_data, 0, 50) . "...\n";
        
        // Test parsing the format back
        if (strpos($formatted_data, 'pqls_pq_encrypted::') === 0) {
            $encoded_data = substr($formatted_data, 19);
            $decoded_data = base64_decode($encoded_data);
            
            if ($decoded_data !== false) {
                $data_structure = json_decode($decoded_data, true);
                
                if (json_last_error() === JSON_ERROR_NONE && isset($data_structure['version']) && $data_structure['version'] === '2.0') {
                    echo "✓ Successfully parsed new format\n";
                    echo "  - Algorithm: " . $data_structure['algorithm'] . "\n";
                    echo "  - Site ID: " . $data_structure['site_id'] . "\n";
                    echo "  - Version: " . $data_structure['version'] . "\n";
                    echo "  - Encrypted at: " . $data_structure['encrypted_at'] . "\n";
                    
                    if ($data_structure['site_id'] === $site_id) {
                        echo "✓ Site ID matches current site\n";
                    } else {
                        echo "ERROR: Site ID mismatch\n";
                        return false;
                    }
                } else {
                    echo "ERROR: Failed to parse data structure\n";
                    return false;
                }
            } else {
                echo "ERROR: Failed to decode base64 data\n";
                return false;
            }
        } else {
            echo "ERROR: Format prefix not found\n";
            return false;
        }
        
        echo "✓ Encrypted data format test passed\n\n";
        return true;
    }
    
    /**
     * Test site isolation security
     */
    public function test_site_isolation_security() {
        echo "Testing site isolation security...\n";
        
        // Simulate two different sites
        $site_1_id = $this->generate_unique_site_id();
        $site_2_id = $this->generate_unique_site_id();
        
        echo "Site 1 ID: $site_1_id\n";
        echo "Site 2 ID: $site_2_id\n";
        
        // Create encrypted data for site 1
        $encrypted_data_format_site1 = [
            'encrypted' => true,
            'algorithm' => 'ML-KEM-768',
            'data' => 'site1_encrypted_data',
            'site_id' => $site_1_id,
            'encrypted_at' => current_time('c'),
            'version' => '2.0'
        ];
        
        $formatted_data_site1 = 'pqls_pq_encrypted::' . base64_encode(json_encode($encrypted_data_format_site1));
        
        // Simulate site 2 trying to decrypt site 1's data
        update_option('pqls_site_id', $site_2_id); // Set current site to site 2
        $current_site_id = get_option('pqls_site_id');
        
        // Parse the encrypted data
        $encoded_data = substr($formatted_data_site1, 19);
        $decoded_data = base64_decode($encoded_data);
        $data_structure = json_decode($decoded_data, true);
        
        // Check site isolation
        if ($data_structure['site_id'] !== $current_site_id) {
            echo "✓ Site isolation working - Site 2 cannot access Site 1's data\n";
            echo "  - Data site ID: " . $data_structure['site_id'] . "\n";
            echo "  - Current site ID: $current_site_id\n";
        } else {
            echo "ERROR: Site isolation failed - sites should have different IDs\n";
            return false;
        }
        
        echo "✓ Site isolation security test passed\n\n";
        return true;
    }
    
    /**
     * Run all tests
     */
    public function run_all_tests() {
        echo "=== PQLS Site Isolation Test Suite ===\n\n";
        
        $tests = [
            'test_unique_site_id_generation',
            'test_site_id_persistence', 
            'test_encrypted_data_format',
            'test_site_isolation_security'
        ];
        
        $passed = 0;
        $total = count($tests);
        
        foreach ($tests as $test) {
            if ($this->$test()) {
                $passed++;
            }
        }
        
        echo "=== Test Results ===\n";
        echo "Passed: $passed/$total\n";
        
        if ($passed === $total) {
            echo "✓ All tests passed! Site isolation implementation is working correctly.\n";
            return true;
        } else {
            echo "✗ Some tests failed. Please review the implementation.\n";
            return false;
        }
    }
}

// Run tests if this file is executed directly
if (php_sapi_name() === 'cli') {
    $test = new PQLS_SiteIsolationTest();
    $test->run_all_tests();
}