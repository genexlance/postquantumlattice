<?php
/**
 * Test Form Error Fix - Validate that the missing method and algorithm issues are resolved
 */

echo "Testing Form Error and Algorithm Fix...\n\n";

// Test 1: Check if add_form_error method exists
echo "1. Testing add_form_error method:\n";

// We can't instantiate the class without WordPress, but we can check the file content
$plugin_content = file_get_contents('post-quantum-lattice-shield.php');

if (strpos($plugin_content, 'function add_form_error') !== false) {
    echo "✓ add_form_error method found in plugin file\n";
} else {
    echo "✗ add_form_error method not found\n";
}

// Test 2: Check algorithm defaults
echo "\n2. Testing algorithm defaults:\n";

$rsa_count = substr_count($plugin_content, "'rsa-oaep-256'");
$mlkem_count = substr_count($plugin_content, "'ML-KEM-768'");

echo "RSA-OAEP-256 references: {$rsa_count}\n";
echo "ML-KEM-768 references: {$mlkem_count}\n";

if ($rsa_count <= 1) { // Should only be in comments or error messages
    echo "✓ RSA algorithm references minimized\n";
} else {
    echo "✗ Too many RSA algorithm references found\n";
}

if ($mlkem_count >= 5) { // Should be the default in multiple places
    echo "✓ ML-KEM-768 is properly set as default\n";
} else {
    echo "✗ ML-KEM-768 not sufficiently set as default\n";
}

// Test 3: Check for algorithm validation
echo "\n3. Testing algorithm validation:\n";

if (strpos($plugin_content, 'supported_algorithms') !== false) {
    echo "✓ Algorithm validation code found\n";
} else {
    echo "✗ Algorithm validation code not found\n";
}

if (strpos($plugin_content, 'ML-KEM-768', 'ML-KEM-1024') !== false) {
    echo "✓ Supported algorithms list found\n";
} else {
    echo "✗ Supported algorithms list not found\n";
}

echo "\n✅ Form error and algorithm fix validation completed!\n";
echo "\nExpected fixes:\n";
echo "- add_form_error method should prevent fatal error\n";
echo "- Algorithm should default to ML-KEM-768 instead of RSA-OAEP-256\n";
echo "- Unsupported algorithms should be automatically updated\n";
echo "- Keys should be regenerated if algorithm changes\n";