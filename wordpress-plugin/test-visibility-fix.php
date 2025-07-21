<?php
/**
 * Test Visibility Fix - Validate that method visibility issues are resolved
 */

echo "Testing Method Visibility Fix...\n\n";

// Test that we can access the methods that were causing issues
try {
    // Create error handler instance
    $error_handler = new PQLS_ErrorHandler();
    
    echo "Testing method accessibility:\n";
    
    // Test log_activity method (was private, now should be public)
    if (method_exists($error_handler, 'log_activity')) {
        $reflection = new ReflectionMethod($error_handler, 'log_activity');
        if ($reflection->isPublic()) {
            echo "✓ log_activity() is public\n";
        } else {
            echo "✗ log_activity() is not public\n";
        }
    } else {
        echo "✗ log_activity() method not found\n";
    }
    
    // Test can_retry method (was private, now should be public)
    if (method_exists($error_handler, 'can_retry')) {
        $reflection = new ReflectionMethod($error_handler, 'can_retry');
        if ($reflection->isPublic()) {
            echo "✓ can_retry() is public\n";
        } else {
            echo "✗ can_retry() is not public\n";
        }
    } else {
        echo "✗ can_retry() method not found\n";
    }
    
    // Test other methods that should be public
    $public_methods = [
        'handle_form_error',
        'handle_crypto_error', 
        'handle_key_generation_error',
        'retry_microservice_request'
    ];
    
    foreach ($public_methods as $method_name) {
        if (method_exists($error_handler, $method_name)) {
            $reflection = new ReflectionMethod($error_handler, $method_name);
            if ($reflection->isPublic()) {
                echo "✓ {$method_name}() is public\n";
            } else {
                echo "✗ {$method_name}() is not public\n";
            }
        } else {
            echo "✗ {$method_name}() method not found\n";
        }
    }
    
    echo "\n✅ Method visibility test completed!\n";
    echo "\nThe plugin activation error should now be resolved.\n";
    
} catch (Exception $e) {
    echo "✗ Error during testing: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
}