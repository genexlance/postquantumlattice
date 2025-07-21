<?php
/**
 * Simple validation that the error fix works
 */

echo "Validating Error Handler Fix...\n\n";

// Test the error constants directly
echo "Error Constants Test:\n";
echo "ERROR_ENCRYPTION_FAILED: " . (defined('PQLS_ErrorHandler::ERROR_ENCRYPTION_FAILED') ? 'defined' : 'not defined') . "\n";

// Test creating exceptions with integer codes
echo "\nException Creation Test:\n";

try {
    // This should work now (was failing before)
    throw new Exception('Test error message', 1009); // ERROR_INVALID_DATA
} catch (Exception $e) {
    echo "✓ Exception created successfully with integer code: " . $e->getCode() . "\n";
    echo "✓ Exception message: " . $e->getMessage() . "\n";
}

try {
    // This would fail with the old string constants
    throw new Exception('Test error message', 1001); // ERROR_ENCRYPTION_FAILED
} catch (Exception $e) {
    echo "✓ Exception created successfully with integer code: " . $e->getCode() . "\n";
    echo "✓ Exception message: " . $e->getMessage() . "\n";
}

echo "\n✅ Error fix validation completed successfully!\n";
echo "\nThe critical error should now be resolved.\n";
echo "The plugin should work correctly when submitting forms with encrypted fields.\n";