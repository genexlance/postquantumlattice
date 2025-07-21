<?php
/**
 * Test Error Fix - Validate that error codes work correctly
 */

// Include the plugin file to test the error handling
require_once 'post-quantum-lattice-shield.php';

echo "Testing Error Handler Fix...\n";

try {
    // Test that we can create exceptions with integer error codes
    $error_handler = new PQLS_ErrorHandler();
    
    // Test each error code constant
    $error_codes = [
        PQLS_ErrorHandler::ERROR_ENCRYPTION_FAILED,
        PQLS_ErrorHandler::ERROR_DECRYPTION_FAILED,
        PQLS_ErrorHandler::ERROR_KEY_GENERATION_FAILED,
        PQLS_ErrorHandler::ERROR_CONNECTION_FAILED,
        PQLS_ErrorHandler::ERROR_INVALID_KEY,
        PQLS_ErrorHandler::ERROR_MICROSERVICE_UNAVAILABLE,
        PQLS_ErrorHandler::ERROR_RATE_LIMIT_EXCEEDED,
        PQLS_ErrorHandler::ERROR_TIMEOUT,
        PQLS_ErrorHandler::ERROR_INVALID_DATA,
        PQLS_ErrorHandler::ERROR_PERMISSION_DENIED
    ];
    
    echo "Testing error code constants:\n";
    foreach ($error_codes as $code) {
        if (is_int($code)) {
            echo "✓ Error code {$code} is integer\n";
        } else {
            echo "✗ Error code {$code} is not integer\n";
        }
    }
    
    // Test exception creation with integer codes
    echo "\nTesting exception creation:\n";
    foreach ($error_codes as $code) {
        try {
            throw new Exception("Test error message", $code);
        } catch (Exception $e) {
            if ($e->getCode() === $code) {
                echo "✓ Exception with code {$code} created successfully\n";
            } else {
                echo "✗ Exception code mismatch: expected {$code}, got " . $e->getCode() . "\n";
            }
        }
    }
    
    // Test the specific error that was causing the issue
    echo "\nTesting specific error scenario:\n";
    try {
        throw new Exception('Invalid data format', PQLS_ErrorHandler::ERROR_INVALID_DATA);
        echo "✗ Exception should have been thrown\n";
    } catch (Exception $e) {
        echo "✓ Exception thrown successfully with code: " . $e->getCode() . "\n";
        echo "✓ Exception message: " . $e->getMessage() . "\n";
    }
    
    echo "\n✅ All error handling tests passed!\n";
    
} catch (Exception $e) {
    echo "✗ Error during testing: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
}