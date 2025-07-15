<?php
/**
 * Test script to diagnose decryption issues
 * Place this file in the same directory as your plugin and run it via WordPress admin
 */

// Include WordPress to access functions
require_once($_SERVER['DOCUMENT_ROOT'] . '/wp-config.php');

echo "<h3>Post Quantum Lattice Shield - Decryption Test</h3>";

// Test 1: Check API key
$api_key = get_option('pqls_api_key');
echo "<p><strong>API Key:</strong> " . ($api_key ? 'Set (' . substr($api_key, 0, 10) . '...)' : 'NOT SET') . "</p>";

// Test 2: Check microservice URL
$settings = get_option('pqls_settings', array());
$microservice_url = $settings['microservice_url'] ?? 'https://postquantumlatticeshield.netlify.app/api';
echo "<p><strong>Microservice URL:</strong> " . $microservice_url . "</p>";

// Test 3: Check private key
$private_key = get_option('pqls_private_key');
echo "<p><strong>Private Key:</strong> " . ($private_key ? 'Set (' . substr($private_key, 0, 20) . '...)' : 'NOT SET') . "</p>";

// Test 4: Test connection to microservice
echo "<p><strong>Testing connection to microservice...</strong></p>";

$headers = array('Content-Type' => 'application/json');
if ($api_key) {
    $headers['Authorization'] = 'Bearer ' . $api_key;
}

$response = wp_remote_get($microservice_url . '/generate-keypair', array(
    'timeout' => 10,
    'headers' => $headers
));

if (is_wp_error($response)) {
    echo "<p style='color: red;'>Connection failed: " . $response->get_error_message() . "</p>";
} else {
    $status_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    
    if ($status_code === 200) {
        echo "<p style='color: green;'>Connection successful! Status: " . $status_code . "</p>";
    } else {
        echo "<p style='color: red;'>Connection failed! Status: " . $status_code . "</p>";
        echo "<p>Response: " . htmlspecialchars($body) . "</p>";
    }
}

// Test 5: Test decryption with sample data
echo "<p><strong>Testing decryption with sample data...</strong></p>";

$test_encrypted = '[ENCRYPTED:dGVzdA==]'; // base64 encoded 'test'
$plugin = new PostQuantumLatticeShield();

// Use reflection to call private method
$reflection = new ReflectionClass($plugin);
$method = $reflection->getMethod('decrypt_data');
$method->setAccessible(true);

$result = $method->invoke($plugin, $test_encrypted);

if ($result !== false) {
    echo "<p style='color: green;'>Decryption test successful!</p>";
} else {
    echo "<p style='color: red;'>Decryption test failed - check WordPress error logs for details</p>";
}

echo "<p><em>Check your WordPress debug.log file for detailed error messages.</em></p>"; 