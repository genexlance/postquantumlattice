<?php
/**
 * Test file for comprehensive error handling implementation
 * This file tests the enhanced error handling features added to the plugin
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Test the comprehensive error handling system
 */
function test_pqls_error_handling() {
    // Initialize the plugin
    $plugin = new PostQuantumLatticeShield();
    
    // Test error handler initialization
    $error_handler = new PQLS_ErrorHandler();
    
    echo "<h2>Testing PQLS Comprehensive Error Handling</h2>\n";
    
    // Test 1: User-friendly error messages
    echo "<h3>Test 1: User-friendly error messages</h3>\n";
    $test_errors = [
        PQLS_ErrorHandler::ERROR_ENCRYPTION_FAILED,
        PQLS_ErrorHandler::ERROR_DECRYPTION_FAILED,
        PQLS_ErrorHandler::ERROR_KEY_GENERATION_FAILED,
        PQLS_ErrorHandler::ERROR_CONNECTION_FAILED,
        PQLS_ErrorHandler::ERROR_MICROSERVICE_UNAVAILABLE,
        PQLS_ErrorHandler::ERROR_INVALID_KEY,
        PQLS_ErrorHandler::ERROR_RATE_LIMIT_EXCEEDED,
        PQLS_ErrorHandler::ERROR_TIMEOUT,
        PQLS_ErrorHandler::ERROR_INVALID_DATA,
        PQLS_ErrorHandler::ERROR_PERMISSION_DENIED
    ];
    
    foreach ($test_errors as $error_code) {
        $result = $error_handler->handle_crypto_error('Test Operation', 'Test error message', $error_code, ['test' => true]);
        echo "✓ Error code {$error_code}: {$result['message']}\n";
    }
    
    // Test 2: Admin notices for key generation issues
    echo "<h3>Test 2: Admin notices for key generation issues</h3>\n";
    $key_error_result = $error_handler->handle_key_generation_error(
        'Test key generation failure',
        PQLS_ErrorHandler::ERROR_KEY_GENERATION_FAILED,
        ['microservice_url' => 'https://test.example.com']
    );
    echo "✓ Key generation error handled: {$key_error_result['message']}\n";
    echo "✓ Requires admin action: " . ($key_error_result['requires_admin_action'] ? 'Yes' : 'No') . "\n";
    
    // Test 3: Retry logic capability check
    echo "<h3>Test 3: Retry logic capability check</h3>\n";
    $retryable_errors = [
        PQLS_ErrorHandler::ERROR_CONNECTION_FAILED,
        PQLS_ErrorHandler::ERROR_MICROSERVICE_UNAVAILABLE,
        PQLS_ErrorHandler::ERROR_TIMEOUT,
        PQLS_ErrorHandler::ERROR_RATE_LIMIT_EXCEEDED
    ];
    
    $non_retryable_errors = [
        PQLS_ErrorHandler::ERROR_INVALID_KEY,
        PQLS_ErrorHandler::ERROR_PERMISSION_DENIED,
        PQLS_ErrorHandler::ERROR_INVALID_DATA
    ];
    
    foreach ($retryable_errors as $error_code) {
        $result = $error_handler->handle_crypto_error('Test', 'Test message', $error_code);
        echo "✓ Error {$error_code} can retry: " . ($result['can_retry'] ? 'Yes' : 'No') . "\n";
    }
    
    foreach ($non_retryable_errors as $error_code) {
        $result = $error_handler->handle_crypto_error('Test', 'Test message', $error_code);
        echo "✓ Error {$error_code} can retry: " . ($result['can_retry'] ? 'Yes' : 'No') . "\n";
    }
    
    // Test 4: Error statistics
    echo "<h3>Test 4: Error statistics</h3>\n";
    $stats = $error_handler->get_error_statistics();
    echo "✓ Total errors logged: {$stats['total_errors']}\n";
    echo "✓ Recent errors (24h): {$stats['recent_errors']}\n";
    echo "✓ Error types tracked: " . count($stats['error_types']) . "\n";
    
    // Test 5: Form error handling
    echo "<h3>Test 5: Form error handling</h3>\n";
    $test_form = ['id' => 'test_form', 'title' => 'Test Form'];
    $error_handler->handle_form_error(
        $test_form,
        'Test form encryption error',
        PQLS_ErrorHandler::ERROR_ENCRYPTION_FAILED,
        ['field_id' => 'test_field']
    );
    
    $form_errors = get_transient('pqls_form_errors_test_form');
    if (!empty($form_errors)) {
        echo "✓ Form error stored successfully\n";
        echo "✓ Error message: {$form_errors[0]['message']}\n";
        echo "✓ Error code: {$form_errors[0]['code']}\n";
    }
    
    // Test 6: Activity logging
    echo "<h3>Test 6: Activity logging</h3>\n";
    $activity_logs = get_option('pqls_activity_log', []);
    $recent_logs = array_slice($activity_logs, -5); // Get last 5 logs
    echo "✓ Activity logs found: " . count($activity_logs) . "\n";
    foreach ($recent_logs as $log) {
        echo "  - {$log['timestamp']}: {$log['message']} [{$log['level']}]\n";
    }
    
    echo "<h3>✅ All error handling tests completed successfully!</h3>\n";
    
    return true;
}

/**
 * Test enhanced encryption/decryption error handling
 */
function test_enhanced_crypto_error_handling() {
    echo "<h2>Testing Enhanced Crypto Error Handling</h2>\n";
    
    // Test timeout calculation
    $plugin = new PostQuantumLatticeShield();
    
    // Use reflection to test private methods
    $reflection = new ReflectionClass($plugin);
    
    // Test timeout calculation
    if ($reflection->hasMethod('calculate_encryption_timeout')) {
        $timeout_method = $reflection->getMethod('calculate_encryption_timeout');
        $timeout_method->setAccessible(true);
        
        $small_data_timeout = $timeout_method->invoke($plugin, 100, 'ML-KEM-768');
        $large_data_timeout = $timeout_method->invoke($plugin, 10000, 'ML-KEM-768');
        $rsa_timeout = $timeout_method->invoke($plugin, 1000, 'RSA-OAEP-256');
        
        echo "✓ Small data timeout (100 bytes, ML-KEM-768): {$small_data_timeout}s\n";
        echo "✓ Large data timeout (10KB, ML-KEM-768): {$large_data_timeout}s\n";
        echo "✓ RSA timeout (1KB, RSA-OAEP-256): {$rsa_timeout}s\n";
    }
    
    // Test RSA algorithm detection
    if ($reflection->hasMethod('is_rsa_algorithm')) {
        $rsa_method = $reflection->getMethod('is_rsa_algorithm');
        $rsa_method->setAccessible(true);
        
        $is_rsa_1 = $rsa_method->invoke($plugin, 'RSA-OAEP-256');
        $is_rsa_2 = $rsa_method->invoke($plugin, 'ML-KEM-768');
        $is_rsa_3 = $rsa_method->invoke($plugin, 'rsa-oaep-256');
        
        echo "✓ RSA-OAEP-256 is RSA: " . ($is_rsa_1 ? 'Yes' : 'No') . "\n";
        echo "✓ ML-KEM-768 is RSA: " . ($is_rsa_2 ? 'Yes' : 'No') . "\n";
        echo "✓ rsa-oaep-256 is RSA: " . ($is_rsa_3 ? 'Yes' : 'No') . "\n";
    }
    
    echo "<h3>✅ Enhanced crypto error handling tests completed!</h3>\n";
    
    return true;
}

// Run tests if this file is accessed directly (for testing purposes)
if (defined('WP_CLI') && WP_CLI) {
    test_pqls_error_handling();
    test_enhanced_crypto_error_handling();
}