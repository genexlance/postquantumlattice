<?php
/**
 * Test Runner for Complete Workflow Testing
 * 
 * This script can be run to execute the complete workflow tests
 * for the Post-Quantum Encryption system.
 */

// Prevent direct access outside of WordPress
if (!defined('ABSPATH')) {
    // If not in WordPress, try to load WordPress
    $wp_load_paths = [
        '../../../wp-load.php',
        '../../../../wp-load.php',
        '../../../../../wp-load.php'
    ];
    
    $wp_loaded = false;
    foreach ($wp_load_paths as $path) {
        if (file_exists($path)) {
            require_once $path;
            $wp_loaded = true;
            break;
        }
    }
    
    if (!$wp_loaded) {
        die('WordPress not found. Please run this script from within WordPress or adjust the path.');
    }
}

// Check if user has permission
if (!current_user_can('manage_pqls')) {
    die('Insufficient permissions to run tests.');
}

// Load the test class
require_once 'test-complete-workflow.php';

// Set up HTML output
?>
<!DOCTYPE html>
<html>
<head>
    <title>PQLS Complete Workflow Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .wrap { max-width: 1200px; margin: 0 auto; }
        .test-summary { background: #f9f9f9; padding: 15px; margin: 20px 0; border-left: 4px solid #0073aa; }
        .test-detail { margin: 5px 0; padding: 5px; background: #f0f0f0; }
        .test-step-details { margin-left: 20px; }
        tr.success { background-color: #d4edda; }
        tr.error { background-color: #f8d7da; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .status-pass { color: green; font-weight: bold; }
        .status-fail { color: red; font-weight: bold; }
    </style>
</head>
<body>

<?php
// Run the comprehensive workflow test
echo "<h1>Post-Quantum Lattice Shield - Complete Workflow Test</h1>";
echo "<p>Testing all aspects of the encryption/decryption workflow as specified in task 7.</p>";
echo "<hr>";

try {
    $test_runner = new PQLS_Complete_Workflow_Test();
    $results = $test_runner->run_all_tests();
    
    // Additional summary information
    echo "<hr>";
    echo "<h2>Test Environment Information</h2>";
    echo "<ul>";
    echo "<li><strong>WordPress Version:</strong> " . get_bloginfo('version') . "</li>";
    echo "<li><strong>Plugin Version:</strong> " . (defined('PQLS_VERSION') ? PQLS_VERSION : 'Unknown') . "</li>";
    echo "<li><strong>PHP Version:</strong> " . PHP_VERSION . "</li>";
    echo "<li><strong>Test Time:</strong> " . current_time('Y-m-d H:i:s') . "</li>";
    echo "<li><strong>Site ID:</strong> " . get_option('pqls_site_id', 'Not set') . "</li>";
    echo "<li><strong>Current Algorithm:</strong> " . get_option('pqls_algorithm', 'Not set') . "</li>";
    echo "<li><strong>Microservice URL:</strong> " . (get_option('pqls_settings')['microservice_url'] ?? 'Default') . "</li>";
    echo "</ul>";
    
    // Requirements coverage summary
    echo "<h2>Requirements Coverage</h2>";
    echo "<p>This test validates the following requirements from the specification:</p>";
    echo "<ul>";
    echo "<li><strong>Requirement 1.1:</strong> Unique encryption keys per site - Tested in multi-site key isolation</li>";
    echo "<li><strong>Requirement 2.1:</strong> Field encryption checkbox functionality - Tested in form creation</li>";
    echo "<li><strong>Requirement 3.1:</strong> Form submission encryption - Tested in form submission</li>";
    echo "<li><strong>Requirement 4.1:</strong> Entry viewing and decryption - Tested in entry viewing and decrypt button</li>";
    echo "<li><strong>Requirement 5.1:</strong> OQS library integration and fallback - Tested in OQS fallback behavior</li>";
    echo "<li><strong>Requirement 6.1:</strong> Multi-site key isolation - Tested in cross-site decryption isolation</li>";
    echo "</ul>";
    
} catch (Exception $e) {
    echo "<div style='background: #f8d7da; padding: 15px; border: 1px solid #f5c6cb; color: #721c24;'>";
    echo "<h3>Test Execution Error</h3>";
    echo "<p>An error occurred while running the tests: " . esc_html($e->getMessage()) . "</p>";
    echo "<p>Stack trace:</p>";
    echo "<pre>" . esc_html($e->getTraceAsString()) . "</pre>";
    echo "</div>";
}

?>

<hr>
<p><em>Test completed at <?php echo current_time('Y-m-d H:i:s'); ?></em></p>

</body>
</html>