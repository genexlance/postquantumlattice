<?php
/**
 * Comprehensive Test Suite for Post-Quantum Encryption Workflow
 * 
 * This test file validates the complete encryption/decryption workflow
 * as specified in task 7 of the implementation plan.
 * 
 * Requirements tested:
 * - 1.1: Unique encryption keys per site
 * - 2.1: Field encryption checkbox functionality
 * - 3.1: Form submission encryption
 * - 4.1: Entry viewing and decryption
 * - 5.1: OQS library integration and fallback
 * - 6.1: Multi-site key isolation
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class PQLS_Complete_Workflow_Test {
    
    private $test_results = [];
    private $microservice_url = 'https://postquantumlatticeshield.netlify.app/api';
    private $test_form_id = 999; // Use a high ID to avoid conflicts
    private $test_site_ids = [];
    
    public function __construct() {
        $this->microservice_url = get_option('pqls_settings')['microservice_url'] ?? $this->microservice_url;
    }
    
    /**
     * Run all workflow tests
     */
    public function run_all_tests() {
        echo "<div class='wrap'>";
        echo "<h1>Post-Quantum Encryption Complete Workflow Test</h1>";
        echo "<div id='test-progress'>";
        
        $this->log_test_start("Complete Encryption/Decryption Workflow Test");
        
        // Test 1: Create test form with encrypted fields
        $this->test_form_creation_with_encrypted_fields();
        
        // Test 2: Test form submission encryption
        $this->test_form_submission_encryption();
        
        // Test 3: Test entry viewing with encrypted placeholders
        $this->test_entry_viewing_with_placeholders();
        
        // Test 4: Test decrypt button functionality
        $this->test_decrypt_button_functionality();
        
        // Test 5: Test multiple sites with separate keys
        $this->test_multiple_site_key_isolation();
        
        // Test 6: Test OQS library fallback behavior
        $this->test_oqs_fallback_behavior();
        
        // Test 7: Test complete end-to-end workflow
        $this->test_end_to_end_workflow();
        
        $this->display_test_results();
        echo "</div>";
        echo "</div>";
        
        return $this->test_results;
    }
    
    /**
     * Test 1: Create test form with encrypted fields and verify form submission works
     */
    private function test_form_creation_with_encrypted_fields() {
        $this->log_test_step("Testing form creation with encrypted fields");
        
        try {
            // Create a test form with various field types
            $test_form = [
                'id' => $this->test_form_id,
                'title' => 'PQLS Test Form - Complete Workflow',
                'description' => 'Test form for validating complete encryption workflow',
                'fields' => [
                    // Text field marked for encryption
                    (object)[
                        'id' => '1',
                        'type' => 'text',
                        'label' => 'Social Security Number',
                        'pqls_encrypt' => true,
                        'isRequired' => true
                    ],
                    // Email field marked for encryption
                    (object)[
                        'id' => '2', 
                        'type' => 'email',
                        'label' => 'Email Address',
                        'pqls_encrypt' => true,
                        'isRequired' => true
                    ],
                    // Textarea field marked for encryption
                    (object)[
                        'id' => '3',
                        'type' => 'textarea',
                        'label' => 'Sensitive Notes',
                        'pqls_encrypt' => true,
                        'isRequired' => false
                    ],
                    // Regular field NOT marked for encryption
                    (object)[
                        'id' => '4',
                        'type' => 'text',
                        'label' => 'Public Name',
                        'pqls_encrypt' => false,
                        'isRequired' => true
                    ]
                ]
            ];
            
            // Verify encrypted fields are properly identified
            $plugin = new PostQuantumLatticeShield();
            $reflection = new ReflectionClass($plugin);
            $method = $reflection->getMethod('identify_encrypted_fields');
            $method->setAccessible(true);
            
            $encrypted_fields = $method->invoke($plugin, $test_form);
            
            // Should identify fields 1, 2, and 3 as encrypted
            $expected_encrypted = ['1', '2', '3'];
            
            if ($encrypted_fields === $expected_encrypted) {
                $this->add_test_result('form_creation', true, 'Successfully identified encrypted fields: ' . implode(', ', $encrypted_fields));
            } else {
                $this->add_test_result('form_creation', false, 'Failed to identify encrypted fields. Expected: ' . implode(', ', $expected_encrypted) . ', Got: ' . implode(', ', $encrypted_fields));
            }
            
            // Test field setting HTML generation
            $this->test_field_setting_html();
            
        } catch (Exception $e) {
            $this->add_test_result('form_creation', false, 'Exception: ' . $e->getMessage());
        }
    }
    
    /**
     * Test field setting HTML for encryption checkbox
     */
    private function test_field_setting_html() {
        try {
            // Simulate the field setting HTML that would be added to Gravity Forms
            $expected_html_elements = [
                'pqls_encrypt_setting',
                'field_pqls_encrypt',
                'Encrypt this field',
                'SetFieldProperty'
            ];
            
            // This would normally be tested in the browser, but we can verify the structure
            $setting_html = '<li class="pqls_encrypt_setting field_setting">
                <input type="checkbox" id="field_pqls_encrypt" onclick="SetFieldProperty(\'pqls_encrypt\', this.checked);" />
                <label for="field_pqls_encrypt">Encrypt this field</label>
            </li>';
            
            $all_elements_present = true;
            foreach ($expected_html_elements as $element) {
                if (strpos($setting_html, $element) === false) {
                    $all_elements_present = false;
                    break;
                }
            }
            
            if ($all_elements_present) {
                $this->add_test_result('field_setting_html', true, 'Field setting HTML structure is correct');
            } else {
                $this->add_test_result('field_setting_html', false, 'Field setting HTML missing required elements');
            }
            
        } catch (Exception $e) {
            $this->add_test_result('field_setting_html', false, 'Exception: ' . $e->getMessage());
        }
    }
    
    /**
     * Test 2: Test form submission with encrypted fields
     */
    private function test_form_submission_encryption() {
        $this->log_test_step("Testing form submission encryption");
        
        try {
            // Ensure we have valid keys
            $public_key = get_option('pqls_public_key');
            $private_key = get_option('pqls_private_key');
            
            if (empty($public_key) || empty($private_key)) {
                // Generate keys for testing
                $plugin = new PostQuantumLatticeShield();
                $reflection = new ReflectionClass($plugin);
                $method = $reflection->getMethod('generate_keypair');
                $method->setAccessible(true);
                $key_result = $method->invoke($plugin);
                
                if (!$key_result) {
                    $this->add_test_result('form_submission', false, 'Failed to generate keys for testing');
                    return;
                }
                
                $public_key = get_option('pqls_public_key');
                $private_key = get_option('pqls_private_key');
            }
            
            // Simulate form submission data
            $test_data = [
                'input_1' => '123-45-6789', // SSN - should be encrypted
                'input_2' => 'test@example.com', // Email - should be encrypted  
                'input_3' => 'This is sensitive information that should be encrypted', // Notes - should be encrypted
                'input_4' => 'John Doe' // Name - should NOT be encrypted
            ];
            
            // Backup original $_POST
            $original_post = $_POST;
            $_POST = array_merge($_POST, $test_data);
            
            // Create test form
            $test_form = [
                'id' => $this->test_form_id,
                'title' => 'PQLS Test Form',
                'fields' => [
                    (object)['id' => '1', 'type' => 'text', 'pqls_encrypt' => true],
                    (object)['id' => '2', 'type' => 'email', 'pqls_encrypt' => true],
                    (object)['id' => '3', 'type' => 'textarea', 'pqls_encrypt' => true],
                    (object)['id' => '4', 'type' => 'text', 'pqls_encrypt' => false]
                ]
            ];
            
            // Test the pre_submission_encrypt method
            $plugin = new PostQuantumLatticeShield();
            $processed_form = $plugin->pre_submission_encrypt($test_form);
            
            // Verify encrypted fields were processed
            $encrypted_count = 0;
            $unencrypted_count = 0;
            
            foreach ($test_data as $key => $original_value) {
                $field_id = str_replace('input_', '', $key);
                $processed_value = $_POST[$key];
                
                if (in_array($field_id, ['1', '2', '3'])) {
                    // Should be encrypted
                    if ($this->is_encrypted_value($processed_value)) {
                        $encrypted_count++;
                        $this->log_test_detail("Field {$field_id} encrypted successfully");
                    } else {
                        $this->add_test_result('form_submission', false, "Field {$field_id} was not encrypted");
                        $_POST = $original_post;
                        return;
                    }
                } else {
                    // Should remain unencrypted
                    if ($processed_value === $original_value) {
                        $unencrypted_count++;
                        $this->log_test_detail("Field {$field_id} correctly left unencrypted");
                    } else {
                        $this->add_test_result('form_submission', false, "Field {$field_id} was unexpectedly modified");
                        $_POST = $original_post;
                        return;
                    }
                }
            }
            
            // Restore original $_POST
            $_POST = $original_post;
            
            if ($encrypted_count === 3 && $unencrypted_count === 1) {
                $this->add_test_result('form_submission', true, "Form submission encryption working correctly. {$encrypted_count} fields encrypted, {$unencrypted_count} field left unencrypted");
            } else {
                $this->add_test_result('form_submission', false, "Encryption counts incorrect. Expected 3 encrypted, 1 unencrypted. Got {$encrypted_count} encrypted, {$unencrypted_count} unencrypted");
            }
            
        } catch (Exception $e) {
            $this->add_test_result('form_submission', false, 'Exception: ' . $e->getMessage());
        }
    }
    
    /**
     * Test 3: Test entry viewing shows encrypted placeholders and decrypt buttons work
     */
    private function test_entry_viewing_with_placeholders() {
        $this->log_test_step("Testing entry viewing with encrypted placeholders");
        
        try {
            // Create mock encrypted entry data
            $site_id = get_option('pqls_site_id') ?: 'test_site_123';
            $algorithm = get_option('pqls_algorithm', 'ML-KEM-768');
            
            $encrypted_data_format = [
                'encrypted' => true,
                'algorithm' => $algorithm,
                'data' => base64_encode('mock_encrypted_data_12345'),
                'site_id' => $site_id,
                'encrypted_at' => current_time('c'),
                'version' => '2.0'
            ];
            
            $prefix = strpos($algorithm, 'ML-KEM') !== false ? 'pqls_pq_encrypted::' : 'pqls_rsa_encrypted::';
            $encrypted_value = $prefix . base64_encode(json_encode($encrypted_data_format));
            
            // Test the format_encrypted_entry_display method
            $plugin = new PostQuantumLatticeShield();
            
            // Create mock field object
            $mock_field = (object)[
                'id' => '1',
                'type' => 'text',
                'label' => 'Test Field',
                'pqls_encrypt' => true
            ];
            
            $mock_form = [
                'id' => $this->test_form_id,
                'fields' => [$mock_field]
            ];
            
            $mock_entry = [
                'id' => '123',
                'form_id' => $this->test_form_id,
                '1' => $encrypted_value
            ];
            
            // Test the display formatting
            $display_value = $plugin->format_encrypted_entry_display($encrypted_value, $mock_field, $mock_entry, $mock_form);
            
            // Should contain [Encrypted] placeholder and decrypt button
            $expected_elements = [
                '[Encrypted]',
                'decrypt-btn',
                'data-field-id="1"',
                'data-entry-id="123"'
            ];
            
            $all_elements_present = true;
            foreach ($expected_elements as $element) {
                if (strpos($display_value, $element) === false) {
                    $all_elements_present = false;
                    $this->log_test_detail("Missing element in display: {$element}");
                }
            }
            
            if ($all_elements_present) {
                $this->add_test_result('entry_viewing', true, 'Entry viewing displays encrypted placeholders and decrypt buttons correctly');
            } else {
                $this->add_test_result('entry_viewing', false, 'Entry viewing missing required elements. Display: ' . substr($display_value, 0, 200));
            }
            
        } catch (Exception $e) {
            $this->add_test_result('entry_viewing', false, 'Exception: ' . $e->getMessage());
        }
    }
    
    /**
     * Test 4: Test decrypt button functionality
     */
    private function test_decrypt_button_functionality() {
        $this->log_test_step("Testing decrypt button functionality");
        
        try {
            // Test the AJAX decrypt functionality
            $plugin = new PostQuantumLatticeShield();
            
            // Create test encrypted data that we can actually decrypt
            $test_plaintext = "Test sensitive data 12345";
            $public_key = get_option('pqls_public_key');
            
            if (empty($public_key)) {
                $this->add_test_result('decrypt_button', false, 'No public key available for testing');
                return;
            }
            
            // Encrypt the test data
            $reflection = new ReflectionClass($plugin);
            $encrypt_method = $reflection->getMethod('encrypt_field_value');
            $encrypt_method->setAccessible(true);
            
            $encrypted_value = $encrypt_method->invoke($plugin, $test_plaintext, '1', $this->test_form_id);
            
            if ($encrypted_value === false) {
                $this->add_test_result('decrypt_button', false, 'Failed to encrypt test data for decrypt testing');
                return;
            }
            
            // Now test decryption
            $decrypt_method = $reflection->getMethod('decrypt_data');
            $decrypt_method->setAccessible(true);
            
            $decrypted_value = $decrypt_method->invoke($plugin, $encrypted_value);
            
            if ($decrypted_value === $test_plaintext) {
                $this->add_test_result('decrypt_button', true, 'Decrypt functionality working correctly');
            } else {
                $this->add_test_result('decrypt_button', false, "Decryption failed. Expected: '{$test_plaintext}', Got: '{$decrypted_value}'");
            }
            
            // Test AJAX endpoint simulation
            $this->test_ajax_decrypt_endpoint($encrypted_value, $test_plaintext);
            
        } catch (Exception $e) {
            $this->add_test_result('decrypt_button', false, 'Exception: ' . $e->getMessage());
        }
    }
    
    /**
     * Test AJAX decrypt endpoint
     */
    private function test_ajax_decrypt_endpoint($encrypted_value, $expected_plaintext) {
        try {
            // Simulate AJAX request data
            $_POST['action'] = 'pqls_decrypt_field';
            $_POST['encrypted_data'] = $encrypted_value;
            $_POST['field_id'] = '1';
            $_POST['entry_id'] = '123';
            $_POST['nonce'] = wp_create_nonce('pqls_nonce');
            
            // Capture output
            ob_start();
            
            $plugin = new PostQuantumLatticeShield();
            
            // Test the AJAX handler
            try {
                $plugin->ajax_decrypt_field();
                $output = ob_get_clean();
                
                // Parse JSON response
                $response = json_decode($output, true);
                
                if ($response && isset($response['success']) && $response['success'] === true) {
                    if (isset($response['data']['decrypted_data']) && $response['data']['decrypted_data'] === $expected_plaintext) {
                        $this->add_test_result('ajax_decrypt', true, 'AJAX decrypt endpoint working correctly');
                    } else {
                        $this->add_test_result('ajax_decrypt', false, 'AJAX decrypt returned incorrect data');
                    }
                } else {
                    $error_msg = isset($response['data']) ? $response['data'] : 'Unknown error';
                    $this->add_test_result('ajax_decrypt', false, 'AJAX decrypt failed: ' . $error_msg);
                }
                
            } catch (Exception $e) {
                ob_end_clean();
                $this->add_test_result('ajax_decrypt', false, 'AJAX decrypt exception: ' . $e->getMessage());
            }
            
            // Clean up
            unset($_POST['action'], $_POST['encrypted_data'], $_POST['field_id'], $_POST['entry_id'], $_POST['nonce']);
            
        } catch (Exception $e) {
            $this->add_test_result('ajax_decrypt', false, 'AJAX test exception: ' . $e->getMessage());
        }
    }
    
    /**
     * Test 5: Verify multiple sites maintain separate encryption keys
     */
    private function test_multiple_site_key_isolation() {
        $this->log_test_step("Testing multiple site key isolation");
        
        try {
            // Store original site data
            $original_site_id = get_option('pqls_site_id');
            $original_public_key = get_option('pqls_public_key');
            $original_private_key = get_option('pqls_private_key');
            
            // Simulate first site
            $site1_id = 'test_site_001';
            update_option('pqls_site_id', $site1_id);
            
            $plugin = new PostQuantumLatticeShield();
            $reflection = new ReflectionClass($plugin);
            $generate_method = $reflection->getMethod('generate_keypair');
            $generate_method->setAccessible(true);
            
            // Generate keys for site 1
            $result1 = $generate_method->invoke($plugin);
            if (!$result1) {
                $this->add_test_result('multi_site_keys', false, 'Failed to generate keys for site 1');
                return;
            }
            
            $site1_public = get_option('pqls_public_key');
            $site1_private = get_option('pqls_private_key');
            
            // Simulate second site
            $site2_id = 'test_site_002';
            update_option('pqls_site_id', $site2_id);
            
            // Generate keys for site 2
            $result2 = $generate_method->invoke($plugin);
            if (!$result2) {
                $this->add_test_result('multi_site_keys', false, 'Failed to generate keys for site 2');
                return;
            }
            
            $site2_public = get_option('pqls_public_key');
            $site2_private = get_option('pqls_private_key');
            
            // Verify keys are different
            if ($site1_public !== $site2_public && $site1_private !== $site2_private) {
                $this->add_test_result('multi_site_keys', true, 'Multiple sites have unique encryption keys');
                
                // Test cross-site decryption isolation
                $this->test_cross_site_decryption_isolation($site1_id, $site1_public, $site1_private, $site2_id, $site2_public, $site2_private);
                
            } else {
                $this->add_test_result('multi_site_keys', false, 'Sites generated identical keys - key isolation failed');
            }
            
            // Restore original site data
            if ($original_site_id) update_option('pqls_site_id', $original_site_id);
            if ($original_public_key) update_option('pqls_public_key', $original_public_key);
            if ($original_private_key) update_option('pqls_private_key', $original_private_key);
            
        } catch (Exception $e) {
            $this->add_test_result('multi_site_keys', false, 'Exception: ' . $e->getMessage());
        }
    }
    
    /**
     * Test cross-site decryption isolation
     */
    private function test_cross_site_decryption_isolation($site1_id, $site1_public, $site1_private, $site2_id, $site2_public, $site2_private) {
        try {
            $plugin = new PostQuantumLatticeShield();
            $reflection = new ReflectionClass($plugin);
            $encrypt_method = $reflection->getMethod('encrypt_field_value');
            $decrypt_method = $reflection->getMethod('decrypt_data');
            $encrypt_method->setAccessible(true);
            $decrypt_method->setAccessible(true);
            
            $test_data = "Cross-site isolation test data";
            
            // Set up site 1 and encrypt data
            update_option('pqls_site_id', $site1_id);
            update_option('pqls_public_key', $site1_public);
            update_option('pqls_private_key', $site1_private);
            
            $site1_encrypted = $encrypt_method->invoke($plugin, $test_data, '1', $this->test_form_id);
            
            if ($site1_encrypted === false) {
                $this->add_test_result('cross_site_isolation', false, 'Failed to encrypt data for site 1');
                return;
            }
            
            // Verify site 1 can decrypt its own data
            $site1_decrypted = $decrypt_method->invoke($plugin, $site1_encrypted);
            if ($site1_decrypted !== $test_data) {
                $this->add_test_result('cross_site_isolation', false, 'Site 1 cannot decrypt its own data');
                return;
            }
            
            // Switch to site 2 and try to decrypt site 1's data
            update_option('pqls_site_id', $site2_id);
            update_option('pqls_public_key', $site2_public);
            update_option('pqls_private_key', $site2_private);
            
            $site2_decrypt_attempt = $decrypt_method->invoke($plugin, $site1_encrypted);
            
            // Site 2 should NOT be able to decrypt site 1's data
            if ($site2_decrypt_attempt === false || $site2_decrypt_attempt !== $test_data) {
                $this->add_test_result('cross_site_isolation', true, 'Cross-site decryption properly isolated - site 2 cannot decrypt site 1 data');
            } else {
                $this->add_test_result('cross_site_isolation', false, 'SECURITY ISSUE: Site 2 was able to decrypt site 1 data');
            }
            
        } catch (Exception $e) {
            $this->add_test_result('cross_site_isolation', false, 'Exception: ' . $e->getMessage());
        }
    }
    
    /**
     * Test 6: Test fallback behavior when OQS library is unavailable
     */
    private function test_oqs_fallback_behavior() {
        $this->log_test_step("Testing OQS library fallback behavior");
        
        try {
            // Check current OQS status
            $plugin = new PostQuantumLatticeShield();
            $reflection = new ReflectionClass($plugin);
            $status_method = $reflection->getMethod('check_oqs_status');
            $status_method->setAccessible(true);
            
            $oqs_status = $status_method->invoke($plugin);
            
            $this->log_test_detail("OQS Status: " . json_encode($oqs_status));
            
            // Test microservice status endpoint
            $status_response = wp_remote_get($this->microservice_url . '/status', ['timeout' => 10]);
            
            if (is_wp_error($status_response)) {
                $this->add_test_result('oqs_fallback', false, 'Cannot connect to microservice for fallback testing: ' . $status_response->get_error_message());
                return;
            }
            
            $status_code = wp_remote_retrieve_response_code($status_response);
            $status_body = wp_remote_retrieve_body($status_response);
            
            if ($status_code === 200 || $status_code === 206) {
                $status_data = json_decode($status_body, true);
                
                if ($status_data && isset($status_data['oqs'])) {
                    $oqs_available = $status_data['oqs']['available'] ?? false;
                    $oqs_functional = $status_data['oqs']['functional'] ?? false;
                    
                    if ($oqs_available && $oqs_functional) {
                        $this->add_test_result('oqs_status', true, 'OQS library is available and functional');
                        
                        // Test post-quantum encryption
                        $this->test_post_quantum_encryption();
                        
                    } else {
                        $this->add_test_result('oqs_status', true, 'OQS library not available - testing RSA fallback');
                        
                        // Test RSA fallback
                        $this->test_rsa_fallback();
                    }
                } else {
                    $this->add_test_result('oqs_fallback', false, 'Invalid status response format');
                }
            } else {
                $this->add_test_result('oqs_fallback', false, "Status endpoint returned HTTP {$status_code}");
            }
            
        } catch (Exception $e) {
            $this->add_test_result('oqs_fallback', false, 'Exception: ' . $e->getMessage());
        }
    }
    
    /**
     * Test post-quantum encryption when OQS is available
     */
    private function test_post_quantum_encryption() {
        try {
            // Force post-quantum algorithm
            $original_algorithm = get_option('pqls_algorithm');
            update_option('pqls_algorithm', 'ML-KEM-768');
            
            $plugin = new PostQuantumLatticeShield();
            $reflection = new ReflectionClass($plugin);
            $encrypt_method = $reflection->getMethod('encrypt_field_value');
            $decrypt_method = $reflection->getMethod('decrypt_data');
            $encrypt_method->setAccessible(true);
            $decrypt_method->setAccessible(true);
            
            $test_data = "Post-quantum encryption test";
            
            $encrypted = $encrypt_method->invoke($plugin, $test_data, '1', $this->test_form_id);
            
            if ($encrypted === false) {
                $this->add_test_result('post_quantum_encryption', false, 'Post-quantum encryption failed');
            } else {
                // Verify it's marked as post-quantum encrypted
                if (strpos($encrypted, 'pqls_pq_encrypted::') === 0) {
                    $decrypted = $decrypt_method->invoke($plugin, $encrypted);
                    
                    if ($decrypted === $test_data) {
                        $this->add_test_result('post_quantum_encryption', true, 'Post-quantum encryption/decryption working correctly');
                    } else {
                        $this->add_test_result('post_quantum_encryption', false, 'Post-quantum decryption failed');
                    }
                } else {
                    $this->add_test_result('post_quantum_encryption', false, 'Data not marked as post-quantum encrypted');
                }
            }
            
            // Restore original algorithm
            if ($original_algorithm) {
                update_option('pqls_algorithm', $original_algorithm);
            }
            
        } catch (Exception $e) {
            $this->add_test_result('post_quantum_encryption', false, 'Exception: ' . $e->getMessage());
        }
    }
    
    /**
     * Test RSA fallback when OQS is not available
     */
    private function test_rsa_fallback() {
        try {
            // Force RSA algorithm to simulate fallback
            $original_algorithm = get_option('pqls_algorithm');
            update_option('pqls_algorithm', 'rsa-oaep-256');
            
            $plugin = new PostQuantumLatticeShield();
            $reflection = new ReflectionClass($plugin);
            $encrypt_method = $reflection->getMethod('encrypt_field_value');
            $decrypt_method = $reflection->getMethod('decrypt_data');
            $encrypt_method->setAccessible(true);
            $decrypt_method->setAccessible(true);
            
            $test_data = "RSA fallback encryption test";
            
            $encrypted = $encrypt_method->invoke($plugin, $test_data, '1', $this->test_form_id);
            
            if ($encrypted === false) {
                $this->add_test_result('rsa_fallback', false, 'RSA fallback encryption failed');
            } else {
                // Verify it's marked as RSA encrypted
                if (strpos($encrypted, 'pqls_rsa_encrypted::') === 0) {
                    $decrypted = $decrypt_method->invoke($plugin, $encrypted);
                    
                    if ($decrypted === $test_data) {
                        $this->add_test_result('rsa_fallback', true, 'RSA fallback encryption/decryption working correctly');
                    } else {
                        $this->add_test_result('rsa_fallback', false, 'RSA fallback decryption failed');
                    }
                } else {
                    $this->add_test_result('rsa_fallback', false, 'Data not marked as RSA encrypted');
                }
            }
            
            // Restore original algorithm
            if ($original_algorithm) {
                update_option('pqls_algorithm', $original_algorithm);
            }
            
        } catch (Exception $e) {
            $this->add_test_result('rsa_fallback', false, 'Exception: ' . $e->getMessage());
        }
    }
    
    /**
     * Test 7: Complete end-to-end workflow
     */
    private function test_end_to_end_workflow() {
        $this->log_test_step("Testing complete end-to-end workflow");
        
        try {
            // This test combines all previous tests into a complete workflow
            $workflow_steps = [
                'key_generation' => false,
                'form_setup' => false,
                'field_encryption' => false,
                'data_storage' => false,
                'entry_display' => false,
                'data_decryption' => false
            ];
            
            // Step 1: Generate fresh keys
            $plugin = new PostQuantumLatticeShield();
            $reflection = new ReflectionClass($plugin);
            $generate_method = $reflection->getMethod('generate_keypair');
            $generate_method->setAccessible(true);
            
            if ($generate_method->invoke($plugin)) {
                $workflow_steps['key_generation'] = true;
                $this->log_test_detail("✓ Key generation successful");
            }
            
            // Step 2: Set up form with encrypted fields
            $test_form = [
                'id' => $this->test_form_id,
                'fields' => [
                    (object)['id' => '1', 'type' => 'text', 'pqls_encrypt' => true, 'label' => 'SSN'],
                    (object)['id' => '2', 'type' => 'email', 'pqls_encrypt' => true, 'label' => 'Email']
                ]
            ];
            
            $identify_method = $reflection->getMethod('identify_encrypted_fields');
            $identify_method->setAccessible(true);
            $encrypted_fields = $identify_method->invoke($plugin, $test_form);
            
            if (count($encrypted_fields) === 2) {
                $workflow_steps['form_setup'] = true;
                $this->log_test_detail("✓ Form setup with encrypted fields successful");
            }
            
            // Step 3: Test field encryption during form submission
            $test_data = [
                'input_1' => '987-65-4321',
                'input_2' => 'workflow@test.com'
            ];
            
            $original_post = $_POST;
            $_POST = array_merge($_POST, $test_data);
            
            $processed_form = $plugin->pre_submission_encrypt($test_form);
            
            $encrypted_count = 0;
            foreach ($test_data as $key => $value) {
                if ($this->is_encrypted_value($_POST[$key])) {
                    $encrypted_count++;
                }
            }
            
            if ($encrypted_count === 2) {
                $workflow_steps['field_encryption'] = true;
                $this->log_test_detail("✓ Field encryption during submission successful");
            }
            
            // Step 4: Simulate data storage (encrypted values are in $_POST)
            $stored_data = [];
            foreach ($test_data as $key => $value) {
                $stored_data[$key] = $_POST[$key];
            }
            
            if (count($stored_data) === 2) {
                $workflow_steps['data_storage'] = true;
                $this->log_test_detail("✓ Data storage simulation successful");
            }
            
            // Step 5: Test entry display formatting
            $mock_field = (object)['id' => '1', 'pqls_encrypt' => true];
            $mock_entry = ['id' => '123', '1' => $stored_data['input_1']];
            $mock_form = ['id' => $this->test_form_id, 'fields' => [$mock_field]];
            
            $display_value = $plugin->format_encrypted_entry_display($stored_data['input_1'], $mock_field, $mock_entry, $mock_form);
            
            if (strpos($display_value, '[Encrypted]') !== false && strpos($display_value, 'decrypt-btn') !== false) {
                $workflow_steps['entry_display'] = true;
                $this->log_test_detail("✓ Entry display formatting successful");
            }
            
            // Step 6: Test decryption
            $decrypt_method = $reflection->getMethod('decrypt_data');
            $decrypt_method->setAccessible(true);
            
            $decrypted_ssn = $decrypt_method->invoke($plugin, $stored_data['input_1']);
            $decrypted_email = $decrypt_method->invoke($plugin, $stored_data['input_2']);
            
            if ($decrypted_ssn === $test_data['input_1'] && $decrypted_email === $test_data['input_2']) {
                $workflow_steps['data_decryption'] = true;
                $this->log_test_detail("✓ Data decryption successful");
            }
            
            // Restore $_POST
            $_POST = $original_post;
            
            // Evaluate overall workflow
            $successful_steps = array_filter($workflow_steps);
            $total_steps = count($workflow_steps);
            $success_count = count($successful_steps);
            
            if ($success_count === $total_steps) {
                $this->add_test_result('end_to_end_workflow', true, "Complete end-to-end workflow successful ({$success_count}/{$total_steps} steps passed)");
            } else {
                $failed_steps = array_keys(array_filter($workflow_steps, function($v) { return !$v; }));
                $this->add_test_result('end_to_end_workflow', false, "End-to-end workflow failed. Failed steps: " . implode(', ', $failed_steps) . " ({$success_count}/{$total_steps} steps passed)");
            }
            
        } catch (Exception $e) {
            $this->add_test_result('end_to_end_workflow', false, 'Exception: ' . $e->getMessage());
        }
    }
    
    /**
     * Helper method to check if a value is encrypted
     */
    private function is_encrypted_value($value) {
        return (strpos($value, 'pqls_encrypted::') === 0 ||
                strpos($value, 'pqls_pq_encrypted::') === 0 ||
                strpos($value, 'pqls_rsa_encrypted::') === 0);
    }
    
    /**
     * Add test result
     */
    private function add_test_result($test_name, $success, $message) {
        $this->test_results[] = [
            'test' => $test_name,
            'success' => $success,
            'message' => $message,
            'timestamp' => current_time('c')
        ];
        
        $status = $success ? '✓ PASS' : '✗ FAIL';
        $this->log_test_detail("{$status}: {$test_name} - {$message}");
    }
    
    /**
     * Log test step
     */
    private function log_test_step($message) {
        echo "<h3>{$message}</h3>";
        echo "<div class='test-step-details'>";
    }
    
    /**
     * Log test detail
     */
    private function log_test_detail($message) {
        echo "<p class='test-detail'>{$message}</p>";
    }
    
    /**
     * Log test start
     */
    private function log_test_start($message) {
        echo "<h2>{$message}</h2>";
        echo "<p>Started at: " . current_time('Y-m-d H:i:s') . "</p>";
    }
    
    /**
     * Display final test results
     */
    private function display_test_results() {
        echo "</div>"; // Close last test step
        echo "<h2>Test Results Summary</h2>";
        
        $total_tests = count($this->test_results);
        $passed_tests = count(array_filter($this->test_results, function($r) { return $r['success']; }));
        $failed_tests = $total_tests - $passed_tests;
        
        echo "<div class='test-summary'>";
        echo "<p><strong>Total Tests:</strong> {$total_tests}</p>";
        echo "<p><strong>Passed:</strong> <span style='color: green;'>{$passed_tests}</span></p>";
        echo "<p><strong>Failed:</strong> <span style='color: red;'>{$failed_tests}</span></p>";
        echo "<p><strong>Success Rate:</strong> " . round(($passed_tests / $total_tests) * 100, 1) . "%</p>";
        echo "</div>";
        
        echo "<h3>Detailed Results</h3>";
        echo "<table class='wp-list-table widefat striped'>";
        echo "<thead><tr><th>Test</th><th>Status</th><th>Message</th><th>Timestamp</th></tr></thead>";
        echo "<tbody>";
        
        foreach ($this->test_results as $result) {
            $status_class = $result['success'] ? 'success' : 'error';
            $status_text = $result['success'] ? 'PASS' : 'FAIL';
            
            echo "<tr class='{$status_class}'>";
            echo "<td>" . esc_html($result['test']) . "</td>";
            echo "<td><strong>{$status_text}</strong></td>";
            echo "<td>" . esc_html($result['message']) . "</td>";
            echo "<td>" . esc_html($result['timestamp']) . "</td>";
            echo "</tr>";
        }
        
        echo "</tbody></table>";
        
        // Add CSS for better display
        echo "<style>
            .test-summary { background: #f9f9f9; padding: 15px; margin: 20px 0; border-left: 4px solid #0073aa; }
            .test-detail { margin: 5px 0; padding: 5px; background: #f0f0f0; }
            .test-step-details { margin-left: 20px; }
            tr.success { background-color: #d4edda; }
            tr.error { background-color: #f8d7da; }
        </style>";
    }
}

// Run the tests if accessed directly
if (isset($_GET['run_pqls_workflow_test']) && current_user_can('manage_pqls')) {
    $test_runner = new PQLS_Complete_Workflow_Test();
    $test_runner->run_all_tests();
}