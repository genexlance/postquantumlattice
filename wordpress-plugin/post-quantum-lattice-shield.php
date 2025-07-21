<?php
/**
 * Plugin Name: WP PostQuantum
 * Plugin URI: https://github.com/genexlance/postquantumlatticeshield
 * Description: Secure form data encryption using post-quantum cryptography (ML-KEM-768/1024) with RSA fallback. Integrates with Gravity Forms to encrypt sensitive field data with quantum-resistant security.
 * Version: 1.1.0
 * Author: Your Name
 * License: MIT
 * Requires at least: 5.0
 * Tested up to: 6.4
 * Requires PHP: 7.4
 * Text Domain: pqls
 * Domain Path: /languages
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('PQLS_VERSION', '1.0.0');
define('PQLS_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('PQLS_PLUGIN_URL', plugin_dir_url(__FILE__));
define('PQLS_MICROSERVICE_URL', 'https://postquantumlatticeshield.netlify.app/api');

/**
 * Comprehensive Error Handler Class
 */
class PQLS_ErrorHandler {
    
    // Error codes for different types of failures (using integers for Exception compatibility)
    const ERROR_ENCRYPTION_FAILED = 1001;
    const ERROR_DECRYPTION_FAILED = 1002;
    const ERROR_KEY_GENERATION_FAILED = 1003;
    const ERROR_CONNECTION_FAILED = 1004;
    const ERROR_INVALID_KEY = 1005;
    const ERROR_MICROSERVICE_UNAVAILABLE = 1006;
    const ERROR_RATE_LIMIT_EXCEEDED = 1007;
    const ERROR_TIMEOUT = 1008;
    const ERROR_INVALID_DATA = 1009;
    const ERROR_PERMISSION_DENIED = 1010;
    
    // Error code to string mapping for user-friendly messages
    private static $error_code_names = [
        1001 => 'ENCRYPTION_FAILED',
        1002 => 'DECRYPTION_FAILED',
        1003 => 'KEY_GENERATION_FAILED',
        1004 => 'CONNECTION_FAILED',
        1005 => 'INVALID_KEY',
        1006 => 'MICROSERVICE_UNAVAILABLE',
        1007 => 'RATE_LIMIT_EXCEEDED',
        1008 => 'TIMEOUT',
        1009 => 'INVALID_DATA',
        1010 => 'PERMISSION_DENIED'
    ];
    
    // Retry configuration
    private $max_retries = 3;
    private $retry_delay = 1; // seconds
    private $backoff_multiplier = 2;
    
    public function __construct() {
        // Initialize error logging
        add_action('admin_notices', array($this, 'display_admin_notices'));
        add_action('wp_ajax_pqls_dismiss_notice', array($this, 'ajax_dismiss_notice'));
        add_action('wp_ajax_nopriv_pqls_dismiss_notice', array($this, 'ajax_dismiss_notice'));
    }
    
    /**
     * Handle form submission errors with user-friendly messages
     */
    public function handle_form_error($form, $message, $error_code = null, $context = []) {
        $user_friendly_message = $this->get_user_friendly_message($error_code, $message, $context);
        
        // Store error in transient for display
        $form_errors = get_transient('pqls_form_errors_' . $form['id']) ?: [];
        $form_errors[] = [
            'message' => $user_friendly_message,
            'code' => $error_code,
            'timestamp' => current_time('mysql'),
            'context' => $context
        ];
        set_transient('pqls_form_errors_' . $form['id'], $form_errors, 300); // 5 minutes
        
        // Log the detailed error
        $this->log_error('Form Error', $message, $error_code, array_merge($context, [
            'form_id' => $form['id'],
            'form_title' => $form['title'] ?? 'Unknown'
        ]));
        
        // Add admin notice for persistent issues
        if ($this->is_critical_error($error_code)) {
            $this->add_admin_notice($user_friendly_message, 'error', $error_code);
        }
    }
    
    /**
     * Handle encryption/decryption operation errors
     */
    public function handle_crypto_error($operation, $error_message, $error_code = null, $context = []) {
        $user_message = $this->get_user_friendly_message($error_code, $error_message, $context);
        
        // Log the error with full context
        $this->log_error($operation, $error_message, $error_code, $context);
        
        // Add admin notice for configuration issues
        if (in_array($error_code, [self::ERROR_KEY_GENERATION_FAILED, self::ERROR_CONNECTION_FAILED, self::ERROR_MICROSERVICE_UNAVAILABLE])) {
            $this->add_admin_notice($user_message, 'error', $error_code);
        }
        
        return [
            'success' => false,
            'message' => $user_message,
            'code' => $error_code,
            'can_retry' => $this->can_retry($error_code)
        ];
    }
    
    /**
     * Handle key generation and connection issues
     */
    public function handle_key_generation_error($error_message, $error_code = null, $context = []) {
        $user_message = $this->get_user_friendly_message($error_code, $error_message, $context);
        
        // Log the error
        $this->log_error('Key Generation', $error_message, $error_code, $context);
        
        // Always show admin notice for key generation issues
        $this->add_admin_notice($user_message, 'error', $error_code, true);
        
        return [
            'success' => false,
            'message' => $user_message,
            'code' => $error_code,
            'requires_admin_action' => true
        ];
    }
    
    /**
     * Implement retry logic for microservice communication
     */
    public function retry_microservice_request($callback, $context = []) {
        $attempt = 0;
        $delay = $this->retry_delay;
        
        while ($attempt < $this->max_retries) {
            $attempt++;
            
            try {
                $result = call_user_func($callback);
                
                // Log successful retry if it wasn't the first attempt
                if ($attempt > 1) {
                    $this->log_activity("Microservice request succeeded on attempt {$attempt}", 'info', $context);
                }
                
                return $result;
                
            } catch (Exception $e) {
                $this->log_error('Microservice Request', $e->getMessage(), $e->getCode(), array_merge($context, [
                    'attempt' => $attempt,
                    'max_attempts' => $this->max_retries
                ]));
                
                // If this was the last attempt, handle the final failure
                if ($attempt >= $this->max_retries) {
                    return $this->handle_crypto_error('Microservice Request', $e->getMessage(), $e->getCode() ?: self::ERROR_CONNECTION_FAILED, $context);
                }
                
                // Wait before retrying with exponential backoff
                sleep($delay);
                $delay *= $this->backoff_multiplier;
            }
        }
        
        // This should never be reached, but just in case
        return $this->handle_crypto_error('Microservice Request', 'Maximum retry attempts exceeded', self::ERROR_CONNECTION_FAILED, $context);
    }
    

    
    /**
     * Get user-friendly error messages
     */
    private function get_user_friendly_message($error_code, $original_message, $context = []) {
        switch ($error_code) {
            case self::ERROR_ENCRYPTION_FAILED:
                return __('Unable to encrypt your data. Please try submitting the form again. If the problem persists, contact support.', 'pqls');
                
            case self::ERROR_DECRYPTION_FAILED:
                return __('Unable to decrypt the requested data. This may be due to a key mismatch or corrupted data.', 'pqls');
                
            case self::ERROR_KEY_GENERATION_FAILED:
                return __('Failed to generate encryption keys. Please check your microservice connection and try again.', 'pqls');
                
            case self::ERROR_CONNECTION_FAILED:
                return __('Unable to connect to the encryption service. Please check your internet connection and try again.', 'pqls');
                
            case self::ERROR_MICROSERVICE_UNAVAILABLE:
                return __('The encryption service is temporarily unavailable. Please try again in a few minutes.', 'pqls');
                
            case self::ERROR_INVALID_KEY:
                return __('Invalid encryption key detected. Please regenerate your keys in the plugin settings.', 'pqls');
                
            case self::ERROR_RATE_LIMIT_EXCEEDED:
                return __('Too many requests. Please wait a moment before trying again.', 'pqls');
                
            case self::ERROR_TIMEOUT:
                return __('The request timed out. Please try again with a smaller amount of data.', 'pqls');
                
            case self::ERROR_INVALID_DATA:
                return __('Invalid data format detected. Please check your input and try again.', 'pqls');
                
            case self::ERROR_PERMISSION_DENIED:
                return __('You do not have permission to perform this action.', 'pqls');
                
            default:
                // For unknown errors, provide a generic but helpful message
                return __('An unexpected error occurred. Please try again or contact support if the problem persists.', 'pqls');
        }
    }
    
    /**
     * Determine if an error can be retried
     */
    private function can_retry($error_code) {
        $retryable_errors = [
            self::ERROR_CONNECTION_FAILED,
            self::ERROR_MICROSERVICE_UNAVAILABLE,
            self::ERROR_TIMEOUT,
            self::ERROR_RATE_LIMIT_EXCEEDED
        ];
        
        return in_array($error_code, $retryable_errors);
    }
    
    /**
     * Check if an error is critical and requires immediate admin attention
     */
    private function is_critical_error($error_code) {
        $critical_errors = [
            self::ERROR_KEY_GENERATION_FAILED,
            self::ERROR_INVALID_KEY,
            self::ERROR_MICROSERVICE_UNAVAILABLE
        ];
        
        return in_array($error_code, $critical_errors);
    }
    
    /**
     * Add admin notice
     */
    private function add_admin_notice($message, $type = 'error', $error_code = null, $persistent = false) {
        $notices = get_option('pqls_admin_notices', []);
        
        $notice_id = md5($message . $error_code);
        
        // Don't add duplicate notices
        if (isset($notices[$notice_id])) {
            return;
        }
        
        $notices[$notice_id] = [
            'message' => $message,
            'type' => $type,
            'error_code' => $error_code,
            'timestamp' => current_time('mysql'),
            'persistent' => $persistent,
            'dismissed' => false
        ];
        
        update_option('pqls_admin_notices', $notices);
    }
    
    /**
     * Display admin notices
     */
    public function display_admin_notices() {
        if (!current_user_can('manage_pqls')) {
            return;
        }
        
        $notices = get_option('pqls_admin_notices', []);
        
        foreach ($notices as $notice_id => $notice) {
            if ($notice['dismissed']) {
                continue;
            }
            
            // Auto-dismiss non-persistent notices after 24 hours
            if (!$notice['persistent'] && strtotime($notice['timestamp']) < (time() - 86400)) {
                unset($notices[$notice_id]);
                continue;
            }
            
            $class = 'notice notice-' . $notice['type'];
            if (!$notice['persistent']) {
                $class .= ' is-dismissible';
            }
            
            echo '<div class="' . esc_attr($class) . '" data-notice-id="' . esc_attr($notice_id) . '">';
            echo '<p><strong>Post Quantum Lattice Shield:</strong> ' . esc_html($notice['message']) . '</p>';
            
            // Add action buttons for specific error types
            if ($notice['error_code'] === self::ERROR_KEY_GENERATION_FAILED) {
                echo '<p>';
                echo '<a href="' . admin_url('options-general.php?page=pqls-settings&tab=keys') . '" class="button button-primary">' . __('Go to Key Management', 'pqls') . '</a> ';
                echo '<button type="button" class="button" onclick="pqlsTestConnection()">' . __('Test Connection', 'pqls') . '</button>';
                echo '</p>';
            }
            
            echo '</div>';
        }
        
        // Update notices to remove expired ones
        update_option('pqls_admin_notices', $notices);
    }
    
    /**
     * AJAX handler to dismiss notices
     */
    public function ajax_dismiss_notice() {
        if (!wp_verify_nonce($_POST['nonce'], 'pqls_nonce') || !current_user_can('manage_pqls')) {
            wp_die('Unauthorized');
        }
        
        $notice_id = sanitize_text_field($_POST['notice_id']);
        $notices = get_option('pqls_admin_notices', []);
        
        if (isset($notices[$notice_id])) {
            $notices[$notice_id]['dismissed'] = true;
            update_option('pqls_admin_notices', $notices);
        }
        
        wp_send_json_success();
    }
    
    /**
     * Comprehensive error logging
     */
    private function log_error($operation, $message, $error_code = null, $context = []) {
        $log_entry = [
            'timestamp' => current_time('c'),
            'operation' => $operation,
            'message' => $message,
            'error_code' => $error_code,
            'context' => $context,
            'user_id' => get_current_user_id(),
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            'request_uri' => $_SERVER['REQUEST_URI'] ?? 'unknown'
        ];
        
        // Log to WordPress error log
        error_log('PQLS Error [' . $operation . ']: ' . $message . ' | Code: ' . $error_code . ' | Context: ' . json_encode($context));
        
        // Store in database for admin review
        $this->store_error_log($log_entry);
        
        // Log activity for audit trail
        $this->log_activity($operation . ' failed: ' . $message, 'error', $context);
    }
    
    /**
     * Store error log in database
     */
    private function store_error_log($log_entry) {
        $error_logs = get_option('pqls_error_logs', []);
        
        // Add new log entry
        $error_logs[] = $log_entry;
        
        // Keep only last 100 entries to prevent database bloat
        if (count($error_logs) > 100) {
            $error_logs = array_slice($error_logs, -100);
        }
        
        update_option('pqls_error_logs', $error_logs);
    }
    
    /**
     * Log activity for audit trail
     */
    private function log_activity($message, $level = 'info', $context = []) {
        $log_entries = get_option('pqls_activity_log', []);
        
        $log_entries[] = [
            'timestamp' => current_time('mysql'),
            'message' => $message,
            'level' => $level,
            'user_id' => get_current_user_id(),
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'context' => $context
        ];
        
        // Keep only last 50 entries
        if (count($log_entries) > 50) {
            $log_entries = array_slice($log_entries, -50);
        }
        
        update_option('pqls_activity_log', $log_entries);
    }
    
    /**
     * Get error statistics for admin dashboard
     */
    public function get_error_statistics() {
        $error_logs = get_option('pqls_error_logs', []);
        $stats = [
            'total_errors' => count($error_logs),
            'recent_errors' => 0,
            'error_types' => [],
            'most_common_error' => null
        ];
        
        $recent_threshold = time() - 86400; // 24 hours
        $error_counts = [];
        
        foreach ($error_logs as $log) {
            $timestamp = strtotime($log['timestamp']);
            
            if ($timestamp > $recent_threshold) {
                $stats['recent_errors']++;
            }
            
            $error_code = $log['error_code'] ?? 'unknown';
            $error_counts[$error_code] = ($error_counts[$error_code] ?? 0) + 1;
        }
        
        if (!empty($error_counts)) {
            arsort($error_counts);
            $stats['error_types'] = $error_counts;
            $stats['most_common_error'] = array_key_first($error_counts);
        }
        
        return $stats;
    }
}

/**
 * Main plugin class
 */
class PostQuantumLatticeShield {
    
    private $option_name = 'pqls_settings';
    private $encrypted_fields = [];
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
        
        // Admin hooks
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'admin_init'));
        
        // Gravity Forms hooks
        add_filter('gform_pre_submission_filter', array($this, 'pre_submission_encrypt'), 10, 1);
        
        // AJAX hooks
        add_action('wp_ajax_pqls_regenerate_keys', array($this, 'ajax_regenerate_keys'));
        add_action('wp_ajax_pqls_test_connection', array($this, 'ajax_test_connection'));
        add_action('wp_ajax_pqls_test_decrypt', array($this, 'ajax_test_decrypt'));
        add_action('wp_ajax_pqls_decrypt_field', array($this, 'ajax_decrypt_field'));
        add_action('wp_ajax_pqls_export_csv', array($this, 'ajax_export_csv'));
        add_action('wp_ajax_pqls_start_migration', array($this, 'ajax_start_migration'));
        add_action('wp_ajax_pqls_check_migration_status', array($this, 'ajax_check_migration_status'));
        add_action('wp_ajax_pqls_backup_keys', array($this, 'ajax_backup_keys'));
        add_action('wp_ajax_pqls_remove_backup', array($this, 'ajax_remove_backup'));
        add_action('wp_ajax_pqls_test_pq_encryption', array($this, 'ajax_test_pq_encryption'));
        add_action('wp_ajax_pqls_refresh_status', array($this, 'ajax_refresh_status'));
        add_action('wp_ajax_pqls_execute_migration', array($this, 'ajax_execute_migration'));
        add_action('wp_ajax_pqls_rollback_migration', array($this, 'ajax_rollback_migration'));
        add_action('wp_ajax_pqls_verify_data_integrity', array($this, 'ajax_verify_data_integrity'));
        add_action('wp_ajax_pqls_get_migration_log', array($this, 'ajax_get_migration_log'));
        
        // Enhanced visual indicators for encrypted fields
        add_filter('gform_entry_field_value', array($this, 'format_encrypted_entry_display'), 10, 4);
        add_filter('gform_entries_field_value', array($this, 'format_encrypted_entry_display'), 10, 4);
        add_action('gform_entry_info', array($this, 'add_encryption_notice'), 10, 2);
        add_action('admin_enqueue_scripts', array($this, 'enqueue_gravity_forms_scripts'));
        add_action('gform_entries_first_column_actions', array($this, 'add_csv_export_buttons'), 10, 4);
        
        // Debug logging for hook registration
        error_log('PQLS: Hooks registered - gform_entry_field_value and gform_entries_field_value filters added');
        
        // Gravity Forms field editor integration
        add_action('gform_field_advanced_settings', array($this, 'add_encryption_field_setting'), 10, 2);
        add_filter('gform_tooltips', array($this, 'add_encryption_tooltips'));
        add_action('gform_editor_js', array($this, 'add_encryption_editor_js'));
        
        // Frontend field indicators and processing
        add_filter('gform_field_content', array($this, 'add_encryption_field_indicator'), 10, 5);
        add_filter('gform_field_css_class', array($this, 'add_encryption_field_class'), 10, 3);
        add_action('wp_enqueue_scripts', array($this, 'enqueue_frontend_scripts'));
        
        // Form error handling
        add_action('gform_pre_render', array($this, 'display_form_errors'), 10, 3);
        add_filter('gform_validation', array($this, 'handle_encryption_validation'), 10, 1);
        
        // Fix plugin download filename
        add_action('load-plugin-editor.php', array($this, 'intercept_plugin_download'));
        add_action('load-plugins.php', array($this, 'intercept_plugin_download'));
        add_action('template_redirect', array($this, 'check_plugin_download'));
        add_action('admin_init', array($this, 'handle_plugin_download_admin'));
    }
    
    /**
     * Initialize plugin
     */
    public function init() {
        // Load plugin text domain
        load_plugin_textdomain('pqls', false, dirname(plugin_basename(__FILE__)) . '/languages/');
        
        // Check if Gravity Forms is active
        if (!class_exists('GFForms')) {
            add_action('admin_notices', array($this, 'gravity_forms_missing_notice'));
            return;
        }
        
        // Load encrypted fields configuration
        $settings = get_option($this->option_name, array());
        $this->encrypted_fields = isset($settings['encrypted_fields']) ? $settings['encrypted_fields'] : array();
    }
    
    /**
     * Plugin activation
     */
    public function activate() {
        // Generate unique site identifier if not exists
        $site_id = get_option('pqls_site_id');
        if (empty($site_id)) {
            $site_id = $this->generate_unique_site_id();
            update_option('pqls_site_id', $site_id);
        }
        
        // Generate initial key pair with site-specific context
        $this->generate_keypair();
        
        // Set default settings
        $default_settings = array(
            'microservice_url' => PQLS_MICROSERVICE_URL,
            'encrypted_fields' => array(),
            'rate_limit' => 100,
            'timeout' => 30
        );
        
        add_option($this->option_name, $default_settings);
        
        // Add capabilities to admin
        $role = get_role('administrator');
        if ($role) {
            $role->add_cap('manage_pqls');
            $role->add_cap('decrypt_pqls_data');
        }
    }
    
    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Remove capabilities
        $role = get_role('administrator');
        if ($role) {
            $role->remove_cap('manage_pqls');
            $role->remove_cap('decrypt_pqls_data');
        }
    }
    
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
     * Check if data is encrypted (supports both old and new formats)
     */
    private function is_encrypted_data($value) {
        if (empty($value)) {
            return false;
        }
        
        // Check for all supported encrypted data formats
        return (strpos($value, 'pqls_encrypted::') === 0 ||
                strpos($value, 'pqls_pq_encrypted::') === 0 ||
                strpos($value, 'pqls_rsa_encrypted::') === 0);
    }

    /**
     * Enhanced error handler class for comprehensive error management
     */
    private $error_handler;
    
    /**
     * Initialize error handler
     */
    private function init_error_handler() {
        if (!$this->error_handler) {
            $this->error_handler = new PQLS_ErrorHandler();
        }
        return $this->error_handler;
    }

    /**
     * Generate ML-KEM keypair with enhanced error handling
     */
    private function generate_keypair() {
        $this->init_error_handler();
        $settings = get_option($this->option_name, array());
        $microservice_url = $settings['microservice_url'] ?? PQLS_MICROSERVICE_URL;
        
        try {
            // Use retry logic for key generation
            $data = $this->error_handler->retry_microservice_request(function() use ($microservice_url) {
                $response = wp_remote_get($microservice_url . '/generate-keypair', [
                    'timeout' => 30
                ]);
                
                if (is_wp_error($response)) {
                    throw new Exception('Connection failed: ' . $response->get_error_message());
                }
                
                $status_code = wp_remote_retrieve_response_code($response);
                $body = wp_remote_retrieve_body($response);
                
                if ($status_code !== 200) {
                    throw new Exception("HTTP {$status_code}: {$body}");
                }
                
                $result = json_decode($body, true);
                
                if (json_last_error() !== JSON_ERROR_NONE) {
                    throw new Exception('Invalid JSON response: ' . json_last_error_msg());
                }
                
                if (!isset($result['publicKey']) || !isset($result['privateKey'])) {
                    throw new Exception('Response missing required keys: ' . print_r($result, true));
                }
                
                return $result;
                
            }, ['operation' => 'generate_keypair', 'url' => $microservice_url]);
            
            // If retry logic returns an error result
            if (is_array($data) && isset($data['success']) && !$data['success']) {
                $this->error_handler->handle_key_generation_error(
                    $data['message'], 
                    PQLS_ErrorHandler::ERROR_KEY_GENERATION_FAILED,
                    ['microservice_url' => $microservice_url]
                );
                return false;
            }
            
            // Get or generate site ID for key isolation
            $site_id = get_option('pqls_site_id');
            if (empty($site_id)) {
                $site_id = $this->generate_unique_site_id();
                update_option('pqls_site_id', $site_id);
            }
            
            // Store keys with site-specific prefixes for security
            update_option('pqls_public_key', $data['publicKey']);
            update_option('pqls_private_key', $data['privateKey']);
            update_option('pqls_algorithm', $data['algorithm']);
            update_option('pqls_key_generated', current_time('mysql'));
            update_option('pqls_site_key_version', '1.0'); // Track key format version
            
            // Log successful key generation
            $this->error_handler->log_activity('Key pair generated successfully', 'info', [
                'algorithm' => $data['algorithm'],
                'site_id' => $site_id
            ]);
            
            return true;
            
        } catch (Exception $e) {
            $this->error_handler->handle_key_generation_error(
                $e->getMessage(), 
                PQLS_ErrorHandler::ERROR_KEY_GENERATION_FAILED,
                ['microservice_url' => $microservice_url]
            );
            return false;
        }
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_options_page(
            __('Post Quantum Lattice Shield Settings', 'pqls'),
            __('⚛ WP PostQuantum ⚛', 'pqls'),
            'manage_pqls',
            'pqls-settings',
            array($this, 'admin_page')
        );
    }
    
    /**
     * Admin settings initialization
     */
    public function admin_init() {
        register_setting('pqls_settings', $this->option_name);
        register_setting('pqls_settings', 'pqls_api_key');

        // Enqueue admin scripts
        add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));
    }
    
    /**
     * Enqueue admin scripts
     */
    public function admin_enqueue_scripts($hook) {
        if ($hook !== 'settings_page_pqls-settings') {
            return;
        }
        
        wp_enqueue_script('pqls-admin', PQLS_PLUGIN_URL . 'assets/admin.js', array('jquery'), PQLS_VERSION, true);
        wp_localize_script('pqls-admin', 'pqls_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('pqls_nonce'),
            'strings' => array(
                'decrypting' => __('Decrypting...', 'pqls'),
                'decrypt_failed' => __('Decryption failed', 'pqls'),
                'copied' => __('Copied to clipboard', 'pqls'),
                'confirm_regenerate' => __('Are you sure? This will invalidate all previously encrypted data!', 'pqls'),
                'confirm_migration' => __('Are you sure you want to start the migration? This will generate new post-quantum keys.', 'pqls'),
                'confirm_remove_backup' => __('Are you sure you want to remove the RSA key backup? This cannot be undone.', 'pqls')
            )
        ));
        
        wp_enqueue_style('pqls-admin', PQLS_PLUGIN_URL . 'assets/admin.css', array(), PQLS_VERSION);
    }
    
    /**
     * Admin page HTML
     */
    public function admin_page() {
        $settings = get_option($this->option_name, array());
        $public_key = get_option('pqls_public_key');
        $algorithm = get_option('pqls_algorithm', 'ML-KEM-768');
        $key_generated = get_option('pqls_key_generated');
        
        // Ensure encrypted_fields is an array
        $settings['encrypted_fields'] = isset($settings['encrypted_fields']) && is_array($settings['encrypted_fields']) ? $settings['encrypted_fields'] : [];

        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            
            <?php
            settings_fields('pqls_settings');
            do_settings_sections('pqls_settings');
            ?>
            <div id="key-status" class="notice" style="display:none;"></div>

            <form method="post" action="options.php">
                <?php
                settings_fields('pqls_settings');
                ?>
                <div id="pqls-settings-tabs">
                    <ul class="nav-tab-wrapper">
                        <li><a href="#tab-general" class="nav-tab nav-tab-active"><?php _e('General', 'pqls'); ?></a></li>
                        <li><a href="#tab-fields" class="nav-tab"><?php _e('Encrypted Fields', 'pqls'); ?></a></li>
                        <li><a href="#tab-keys" class="nav-tab"><?php _e('Key Management', 'pqls'); ?></a></li>
                        <li><a href="#tab-status" class="nav-tab"><?php _e('Status', 'pqls'); ?></a></li>
                    </ul>

                    <div id="tab-general" class="tab-content active">
                        <?php $this->render_general_settings($settings); ?>
                    </div>
                    <div id="tab-fields" class="tab-content">
                        <?php $this->render_encrypted_fields_settings($settings); ?>
                    </div>
                    <div id="tab-keys" class="tab-content">
                        <?php $this->render_key_management_settings($public_key, $algorithm, $key_generated); ?>
                    </div>
                    <div id="tab-status" class="tab-content">
                        <?php $this->render_status_dashboard($settings, $public_key, $algorithm, $key_generated); ?>
                    </div>
                </div>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }
    
    private function render_general_settings($settings) {
        $microservice_url = $settings['microservice_url'] ?? PQLS_MICROSERVICE_URL;
        $api_key = get_option('pqls_api_key', '');
        ?>
        <table class="form-table">
            <tr valign="top">
                <th scope="row"><?php _e('Microservice URL', 'pqls'); ?></th>
                <td>
                    <input type="text" name="<?php echo $this->option_name; ?>[microservice_url]" value="<?php echo esc_attr($microservice_url); ?>" class="regular-text"/>
                    <p class="description"><?php _e('The URL of your Netlify decryption microservice.', 'pqls'); ?></p>
                </td>
            </tr>
            <tr valign="top">
                <th scope="row"><?php _e('API Key', 'pqls'); ?></th>
                <td>
                    <input type="password" name="pqls_api_key" value="<?php echo esc_attr($api_key); ?>" class="regular-text"/>
                    <p class="description"><?php _e('Your secret API key for the microservice.', 'pqls'); ?></p>
                </td>
            </tr>
        </table>
        <?php
    }

    private function render_key_management_settings($public_key, $algorithm, $key_generated) {
        $migration_status = get_option('pqls_migration_status', 'pending');
        $has_rsa_backup = get_option('pqls_rsa_public_key_backup', false);
        $is_rsa_key = $this->is_rsa_algorithm($algorithm);
        
        ?>
        <h2><?php _e('Key Management', 'pqls'); ?></h2>
        
        <?php if ($is_rsa_key && $migration_status === 'pending') : ?>
            <div class="notice notice-warning">
                <p><strong><?php _e('Migration Required:', 'pqls'); ?></strong> <?php _e('Your system is currently using RSA encryption. Migrate to post-quantum encryption for quantum-resistant security.', 'pqls'); ?></p>
            </div>
            
            <div class="pqls-migration-section">
                <h3><?php _e('Post-Quantum Migration', 'pqls'); ?></h3>
                <p><?php _e('Choose your security level and migrate to post-quantum encryption:', 'pqls'); ?></p>
                
                <table class="form-table">
                    <tr>
                        <th scope="row"><?php _e('Security Level', 'pqls'); ?></th>
                        <td>
                            <label>
                                <input type="radio" name="pqls_security_level" value="standard" checked>
                                <strong><?php _e('Standard (ML-KEM-768)', 'pqls'); ?></strong> - <?php _e('Recommended for most applications', 'pqls'); ?>
                            </label><br>
                            <label>
                                <input type="radio" name="pqls_security_level" value="high">
                                <strong><?php _e('High Security (ML-KEM-1024)', 'pqls'); ?></strong> - <?php _e('Maximum security for sensitive data', 'pqls'); ?>
                            </label>
                        </td>
                    </tr>
                </table>
                
                <p>
                    <button id="backup-keys" class="button"><?php _e('Backup Current Keys', 'pqls'); ?></button>
                    <button id="execute-migration" class="button-primary" disabled><?php _e('Execute Migration', 'pqls'); ?></button>
                </p>
                
                <div class="pqls-migration-options">
                    <h4><?php _e('Migration Options', 'pqls'); ?></h4>
                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php _e('Batch Size', 'pqls'); ?></th>
                            <td>
                                <input type="number" id="migration-batch-size" value="100" min="10" max="1000" />
                                <p class="description"><?php _e('Number of entries to process per batch (10-1000)', 'pqls'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php _e('Data Integrity Verification', 'pqls'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" id="verify-integrity" checked />
                                    <?php _e('Verify data integrity after migration', 'pqls'); ?>
                                </label>
                                <p class="description"><?php _e('Recommended: Ensures migrated data can be decrypted correctly', 'pqls'); ?></p>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <div id="migration-progress" style="display:none;">
                    <h4><?php _e('Migration Progress', 'pqls'); ?></h4>
                    <div class="pqls-progress-bar">
                        <div class="pqls-progress-fill" style="width: 0%;"></div>
                    </div>
                    <p class="pqls-progress-text"><?php _e('Preparing migration...', 'pqls'); ?></p>
                </div>
            </div>
        <?php elseif ($migration_status === 'in_progress') : ?>
            <div class="notice notice-info">
                <p><strong><?php _e('Migration in Progress:', 'pqls'); ?></strong> <?php _e('Please wait while the system migrates to post-quantum encryption.', 'pqls'); ?></p>
            </div>
            
            <div id="migration-progress">
                <h4><?php _e('Migration Progress', 'pqls'); ?></h4>
                <div class="pqls-progress-bar">
                    <div class="pqls-progress-fill" style="width: 50%;"></div>
                </div>
                <p class="pqls-progress-text"><?php _e('Migration in progress...', 'pqls'); ?></p>
                <button id="check-migration-status" class="button"><?php _e('Check Status', 'pqls'); ?></button>
            </div>
        <?php elseif ($migration_status === 'completed') : ?>
            <div class="notice notice-success">
                <p><strong><?php _e('Migration Complete:', 'pqls'); ?></strong> <?php _e('Your system is now using post-quantum encryption.', 'pqls'); ?></p>
            </div>
        <?php endif; ?>
        
        <p>
            <button id="regenerate-keys" class="button"><?php _e('Regenerate Keys', 'pqls'); ?></button>
            <button id="test-connection" class="button"><?php _e('Test Connection', 'pqls'); ?></button>
            <button id="test-decrypt" class="button-primary"><?php _e('Test Decryption', 'pqls'); ?></button>
        </p>
        <div id="key-status" class="notice" style="display:none;"></div>
        
        <h3><?php _e('Current Public Key', 'pqls'); ?></h3>
        <?php if ($public_key) : ?>
            <textarea readonly class="widefat" rows="5"><?php echo esc_textarea($public_key); ?></textarea>
            <p><strong><?php _e('Algorithm:', 'pqls'); ?></strong> <?php echo esc_html($algorithm); ?></p>
            <p><strong><?php _e('Security Level:', 'pqls'); ?></strong> <?php echo esc_html(get_option('pqls_security_level', 'standard')); ?></p>
            <p><strong><?php _e('Generated:', 'pqls'); ?></strong> <?php echo esc_html($key_generated); ?></p>
        <?php else : ?>
            <p><?php _e('No public key found. Please generate one.', 'pqls'); ?></p>
        <?php endif; ?>
        
        <?php if ($has_rsa_backup) : ?>
            <h3><?php _e('Backup Keys', 'pqls'); ?></h3>
            <p><?php _e('RSA key backup is available. You can safely remove it after confirming the migration is successful.', 'pqls'); ?></p>
            <button id="remove-backup" class="button button-secondary"><?php _e('Remove RSA Backup', 'pqls'); ?></button>
        <?php endif; ?>
        <?php
    }

    private function render_status_dashboard($settings, $public_key, $algorithm, $key_generated) {
        $migration_status = get_option('pqls_migration_status', 'pending');
        $oqs_status = $this->check_oqs_status();
        $is_post_quantum = !$this->is_rsa_algorithm($algorithm);
        
        ?>
        <h2><?php _e('System Status', 'pqls'); ?></h2>
        
        <div class="pqls-status-grid">
            <div class="pqls-status-card">
                <h3><?php _e('Encryption Status', 'pqls'); ?></h3>
                <table class="form-table">
                    <tr>
                        <th scope="row"><?php _e('Current Algorithm', 'pqls'); ?></th>
                        <td>
                            <span class="pqls-status-badge <?php echo $is_post_quantum ? 'pqls-status-success' : 'pqls-status-warning'; ?>">
                                <?php echo esc_html($algorithm); ?>
                            </span>
                            <?php if ($is_post_quantum) : ?>
                                <span class="pqls-quantum-resistant">✓ <?php _e('Quantum Resistant', 'pqls'); ?></span>
                            <?php else : ?>
                                <span class="pqls-quantum-vulnerable">⚠ <?php _e('Vulnerable to Quantum Attacks', 'pqls'); ?></span>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php _e('Security Level', 'pqls'); ?></th>
                        <td>
                            <?php 
                            $security_level = get_option('pqls_security_level', 'standard');
                            echo esc_html(ucfirst($security_level));
                            if ($is_post_quantum) {
                                echo ' (' . ($security_level === 'high' ? 'ML-KEM-1024' : 'ML-KEM-768') . ')';
                            }
                            ?>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php _e('Key Generated', 'pqls'); ?></th>
                        <td><?php echo $key_generated ? esc_html($key_generated) : __('Not available', 'pqls'); ?></td>
                    </tr>
                </table>
            </div>
            
            <div class="pqls-status-card">
                <h3><?php _e('OQS Library Status', 'pqls'); ?></h3>
                <table class="form-table">
                    <tr>
                        <th scope="row"><?php _e('Availability', 'pqls'); ?></th>
                        <td>
                            <span class="pqls-status-badge <?php echo $oqs_status['available'] ? 'pqls-status-success' : 'pqls-status-error'; ?>">
                                <?php echo $oqs_status['available'] ? __('Available', 'pqls') : __('Not Available', 'pqls'); ?>
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php _e('Functionality', 'pqls'); ?></th>
                        <td>
                            <span class="pqls-status-badge <?php echo $oqs_status['functional'] ? 'pqls-status-success' : 'pqls-status-error'; ?>">
                                <?php echo $oqs_status['functional'] ? __('Functional', 'pqls') : __('Not Functional', 'pqls'); ?>
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php _e('Version', 'pqls'); ?></th>
                        <td><?php echo !empty($oqs_status['version']) ? esc_html($oqs_status['version']) : __('Unknown', 'pqls'); ?></td>
                    </tr>
                    <tr>
                        <th scope="row"><?php _e('Health', 'pqls'); ?></th>
                        <td>
                            <span class="pqls-status-badge pqls-status-<?php echo esc_attr($oqs_status['health']); ?>">
                                <?php echo esc_html(ucfirst($oqs_status['health'])); ?>
                            </span>
                        </td>
                    </tr>
                </table>
            </div>
        </div>
        
        <?php if (!empty($oqs_status['algorithms'])) : ?>
        <div class="pqls-algorithms-section">
            <h3><?php _e('Supported Algorithms', 'pqls'); ?></h3>
            <table class="wp-list-table widefat striped">
                <thead>
                    <tr>
                        <th><?php _e('Algorithm', 'pqls'); ?></th>
                        <th><?php _e('Security Level', 'pqls'); ?></th>
                        <th><?php _e('Status', 'pqls'); ?></th>
                        <th><?php _e('Key Sizes', 'pqls'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($oqs_status['algorithms'] as $alg) : ?>
                    <tr>
                        <td><strong><?php echo esc_html($alg['name']); ?></strong></td>
                        <td><?php echo esc_html(ucfirst($alg['level'])); ?></td>
                        <td>
                            <span class="pqls-status-badge <?php echo $alg['functional'] ? 'pqls-status-success' : 'pqls-status-error'; ?>">
                                <?php echo $alg['functional'] ? __('Functional', 'pqls') : __('Error', 'pqls'); ?>
                            </span>
                            <?php if (!empty($alg['error'])) : ?>
                                <br><small class="pqls-error-text"><?php echo esc_html($alg['error']); ?></small>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if (!empty($alg['keySize'])) : ?>
                                <small>
                                    <?php printf(__('Public: %d bytes, Private: %d bytes', 'pqls'), 
                                        $alg['keySize']['publicKey'], $alg['keySize']['secretKey']); ?>
                                </small>
                            <?php else : ?>
                                <small><?php _e('N/A', 'pqls'); ?></small>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php endif; ?>
        
        <div class="pqls-migration-status">
            <h3><?php _e('Migration Status', 'pqls'); ?></h3>
            <p>
                <span class="pqls-status-badge pqls-status-<?php echo esc_attr($migration_status); ?>">
                    <?php echo esc_html(ucfirst($migration_status)); ?>
                </span>
                <?php
                switch ($migration_status) {
                    case 'pending':
                        if ($is_post_quantum) {
                            _e('System is already using post-quantum encryption.', 'pqls');
                        } else {
                            _e('Migration to post-quantum encryption is recommended.', 'pqls');
                        }
                        break;
                    case 'in_progress':
                        _e('Migration is currently in progress. Please wait for completion.', 'pqls');
                        break;
                    case 'completed':
                        _e('Successfully migrated to post-quantum encryption.', 'pqls');
                        break;
                }
                ?>
            </p>
        </div>
        
        <?php if (!empty($oqs_status['issues'])) : ?>
        <div class="pqls-issues-section">
            <h3><?php _e('System Issues', 'pqls'); ?></h3>
            <div class="notice notice-warning">
                <ul>
                    <?php foreach ($oqs_status['issues'] as $issue) : ?>
                        <li><?php echo esc_html($issue); ?></li>
                    <?php endforeach; ?>
                </ul>
            </div>
        </div>
        <?php endif; ?>
        
        <div class="pqls-testing-section">
            <h3><?php _e('System Testing', 'pqls'); ?></h3>
            <p><?php _e('Test the post-quantum encryption functionality:', 'pqls'); ?></p>
            <p>
                <button id="test-pq-encryption" class="button-primary"><?php _e('Test Post-Quantum Encryption', 'pqls'); ?></button>
                <button id="refresh-status" class="button"><?php _e('Refresh Status', 'pqls'); ?></button>
            </p>
            <div id="test-results" class="pqls-test-results" style="display:none;">
                <h4><?php _e('Test Results', 'pqls'); ?></h4>
                <div id="test-output"></div>
            </div>
        </div>
        
        <div class="pqls-monitoring-section">
            <h3><?php _e('Migration Monitoring', 'pqls'); ?></h3>
            <p><?php _e('Monitor and manage migration processes:', 'pqls'); ?></p>
            <p>
                <button id="verify-data-integrity" class="button"><?php _e('Verify Data Integrity', 'pqls'); ?></button>
                <button id="view-migration-log" class="button"><?php _e('View Migration Log', 'pqls'); ?></button>
                <?php if ($migration_status === 'completed' || $migration_status === 'in_progress') : ?>
                    <button id="rollback-migration" class="button button-secondary"><?php _e('Rollback Migration', 'pqls'); ?></button>
                <?php endif; ?>
            </p>
            
            <?php if ($migration_status === 'completed') : ?>
                <div class="pqls-migration-stats">
                    <h4><?php _e('Migration Statistics', 'pqls'); ?></h4>
                    <?php $this->render_migration_statistics(); ?>
                </div>
            <?php endif; ?>
        </div>
        
        <h3><?php _e('Recent Activity', 'pqls'); ?></h3>
        <div class="pqls-activity-log">
            <?php $this->render_activity_log(); ?>
        </div>
        <?php
    }
    
    /**
     * Check if algorithm is RSA-based
     */
    private function is_rsa_algorithm($algorithm) {
        $algorithm_lower = strtolower($algorithm);
        return strpos($algorithm_lower, 'rsa') !== false || 
               strpos($algorithm_lower, 'oaep') !== false ||
               (strpos($algorithm_lower, 'ml-kem') === false && strpos($algorithm_lower, 'kyber') === false);
    }
    
    /**
     * Check OQS library status
     */
    private function check_oqs_status() {
        $settings = get_option($this->option_name, array());
        $microservice_url = $settings['microservice_url'] ?? PQLS_MICROSERVICE_URL;
        
        $response = wp_remote_get($microservice_url . '/status', [
            'timeout' => 10
        ]);
        
        if (is_wp_error($response)) {
            return [
                'available' => false, 
                'functional' => false,
                'error' => $response->get_error_message(),
                'health' => 'unhealthy'
            ];
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($status_code === 200 || $status_code === 206) {
            $data = json_decode($body, true);
            if (json_last_error() === JSON_ERROR_NONE && isset($data['oqs'])) {
                return [
                    'available' => $data['oqs']['available'] ?? false,
                    'functional' => $data['oqs']['functional'] ?? false,
                    'version' => $data['oqs']['version'] ?? 'Unknown',
                    'algorithms' => $data['oqs']['supportedAlgorithms'] ?? [],
                    'health' => $data['health']['overall'] ?? 'unknown',
                    'capabilities' => $data['capabilities'] ?? [],
                    'issues' => $data['health']['issues'] ?? []
                ];
            }
        }
        
        return [
            'available' => false, 
            'functional' => false,
            'status_code' => $status_code,
            'health' => 'unhealthy'
        ];
    }
    
    /**
     * Render activity log
     */
    private function render_activity_log() {
        $log_entries = get_option('pqls_activity_log', []);
        
        if (empty($log_entries)) {
            echo '<p>' . __('No recent activity.', 'pqls') . '</p>';
            return;
        }
        
        echo '<ul class="pqls-activity-list">';
        foreach (array_slice($log_entries, -10) as $entry) {
            echo '<li>';
            echo '<span class="pqls-activity-time">' . esc_html($entry['timestamp']) . '</span> - ';
            echo '<span class="pqls-activity-message">' . esc_html($entry['message']) . '</span>';
            echo '</li>';
        }
        echo '</ul>';
    }
    

    
    private function render_encrypted_fields_settings($settings) {
        if (!class_exists('GFAPI')) {
            echo '<p>' . __('Gravity Forms is not active. Please activate it to use this feature.', 'pqls') . '</p>';
            return;
        }

        $forms = GFAPI::get_forms();
        $all_fields = [];
        
        foreach ($forms as $form) {
            if (isset($form['fields']) && is_array($form['fields'])) {
                foreach ($form['fields'] as $field) {
                    $all_fields[] = [
                        'form_id' => $form['id'],
                        'form_title' => $form['title'],
                        'field_id' => $field->id,
                        'field_label' => $field->get_field_label(true, '')
                    ];
                }
            }
        }
        
        $encrypted_fields = $settings['encrypted_fields'] ?? [];
        if (!is_array($encrypted_fields)) {
            $encrypted_fields = [];
        }
        ?>
        <div id="encrypted-fields-container">
            <p><?php _e('Select the fields you want to encrypt. Only fields from active forms are listed.', 'pqls'); ?></p>
            <table class="wp-list-table widefat striped">
                <thead>
                    <tr>
                        <th class="check-column"><input type="checkbox" id="select-all-fields"></th>
                        <th><?php _e('Form', 'pqls'); ?></th>
                        <th><?php _e('Field', 'pqls'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($all_fields)) : ?>
                        <tr>
                            <td colspan="3"><?php _e('No Gravity Forms fields found.', 'pqls'); ?></td>
                        </tr>
                    <?php else : ?>
                        <?php foreach ($all_fields as $field) :
                            $field_id_key = $field['form_id'] . '_' . $field['field_id'];
                            $is_checked = in_array($field_id_key, $encrypted_fields);
                            ?>
                            <tr class="<?php echo $is_checked ? 'selected' : ''; ?>">
                                <th class="check-column"><input type="checkbox" name="<?php echo $this->option_name; ?>[encrypted_fields][]" value="<?php echo esc_attr($field_id_key); ?>" <?php checked($is_checked); ?>></th>
                                <td><?php echo esc_html($field['form_title']); ?> (ID: <?php echo esc_html($field['form_id']); ?>)</td>
                                <td><?php echo esc_html($field['field_label']); ?> (ID: <?php echo esc_html($field['field_id']); ?>)</td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
        <?php
    }
    
    /**
     * Encrypt form data before submission with post-quantum encryption
     */
    public function pre_submission_encrypt($form) {
        // Identify fields marked for encryption using the pqls_encrypt field property
        $encrypted_fields = $this->identify_encrypted_fields($form);
        
        if (empty($encrypted_fields)) {
            return $form;
        }
        
        $public_key = get_option('pqls_public_key');
        $algorithm = get_option('pqls_algorithm', 'ML-KEM-768');
        
        if (empty($public_key)) {
            error_log('PQLS: Public key not set, cannot encrypt.');
            $this->add_form_error($form, __('Encryption error: System configuration issue. Please contact support.', 'pqls'));
            return $form;
        }
        
        // Check if post-quantum encryption is available
        $is_post_quantum = !$this->is_rsa_algorithm($algorithm);
        $encryption_start_time = microtime(true);
        
        foreach ($_POST as $key => $value) {
            if (strpos($key, 'input_') === 0) {
                $field_id = str_replace('input_', '', $key);
                if (in_array($field_id, $encrypted_fields) && !empty($value)) {
                    $encrypted_value = $this->encrypt_field_value($value, $field_id, $form['id']);
                    
                    if ($encrypted_value === false) {
                        // Prevent form submission on encryption failure
                        error_log("PQLS: Failed to encrypt field {$field_id} in form {$form['id']}");
                        $this->add_form_error($form, __('Unable to encrypt sensitive data. Please try again or contact support.', 'pqls'));
                        return $form;
                    }
                    
                    $_POST[$key] = $encrypted_value;
                }
            }
        }
        
        // Performance monitoring
        $encryption_time = microtime(true) - $encryption_start_time;
        if ($encryption_time > 1.0) {
            error_log("PQLS: Form encryption took {$encryption_time}s for form {$form['id']} - consider optimization");
        }
        
        // Log successful encryption
        $this->log_activity("Form {$form['id']} encrypted with " . ($is_post_quantum ? 'post-quantum' : 'RSA') . " encryption");
        
        return $form;
    }
    
    /**
     * Identify fields marked for encryption using the pqls_encrypt field property
     */
    private function identify_encrypted_fields($form) {
        $encrypted_fields = [];
        
        if (!isset($form['fields']) || !is_array($form['fields'])) {
            return $encrypted_fields;
        }
        
        foreach ($form['fields'] as $field) {
            // Check if field has pqls_encrypt property set to true
            if (isset($field['pqls_encrypt']) && $field['pqls_encrypt'] === true) {
                $encrypted_fields[] = $field['id'];
            }
        }
        
        return $encrypted_fields;
    }
    
    /**
     * Encrypt field value using the microservice encrypt endpoint with enhanced error handling
     */
    private function encrypt_field_value($value, $field_id, $form_id) {
        $this->init_error_handler();
        $settings = get_option($this->option_name, array());
        $microservice_url = $settings['microservice_url'] ?? PQLS_MICROSERVICE_URL;
        $public_key = get_option('pqls_public_key');
        $algorithm = get_option('pqls_algorithm', 'ML-KEM-768');
        $security_level = get_option('pqls_security_level', 'standard');
        
        // Performance optimization: skip encryption for empty values
        if (empty($value) || trim($value) === '') {
            return $value;
        }
        
        // Validate prerequisites
        if (empty($public_key)) {
            $this->error_handler->handle_crypto_error(
                'Field Encryption',
                'Public key not configured',
                PQLS_ErrorHandler::ERROR_INVALID_KEY,
                ['form_id' => $form_id, 'field_id' => $field_id]
            );
            return false;
        }
        
        $data_size = strlen($value);
        $context = [
            'form_id' => $form_id,
            'field_id' => $field_id,
            'algorithm' => $algorithm,
            'data_size' => $data_size,
            'microservice_url' => $microservice_url
        ];
        
        try {
            // Use retry logic for encryption
            $result = $this->error_handler->retry_microservice_request(function() use ($value, $public_key, $algorithm, $security_level, $microservice_url, $form_id, $field_id, $data_size) {
                
                // Prepare request body with enhanced metadata
                $request_body = [
                    'data' => $value,
                    'publicKey' => trim($public_key),
                    'algorithm' => $algorithm,
                    'metadata' => [
                        'form_id' => $form_id,
                        'field_id' => $field_id,
                        'algorithm' => $algorithm,
                        'security_level' => $security_level,
                        'timestamp' => current_time('c'),
                        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'
                    ]
                ];
                
                // Add security level parameter for post-quantum encryption
                if (!$this->is_rsa_algorithm($algorithm)) {
                    $request_body['securityLevel'] = $security_level;
                }
                
                $body = json_encode($request_body);
                
                // Enhanced timeout based on data size and algorithm
                $timeout = $this->calculate_encryption_timeout($data_size, $algorithm);
                
                $response = wp_remote_post($microservice_url . '/encrypt', [
                    'headers' => [
                        'Content-Type' => 'application/json',
                        'User-Agent' => 'PQLS-WordPress/' . PQLS_VERSION
                    ],
                    'body' => $body,
                    'timeout' => $timeout,
                    'blocking' => true
                ]);

                if (is_wp_error($response)) {
                    $error_code = $response->get_error_code();
                    if ($error_code === 'http_request_timeout') {
                        throw new Exception('Request timeout - data may be too large', PQLS_ErrorHandler::ERROR_TIMEOUT);
                    } else {
                        throw new Exception('Connection failed: ' . $response->get_error_message(), PQLS_ErrorHandler::ERROR_CONNECTION_FAILED);
                    }
                }

                $status_code = wp_remote_retrieve_response_code($response);
                $response_body = wp_remote_retrieve_body($response);

                if ($status_code === 429) {
                    throw new Exception('Rate limit exceeded', PQLS_ErrorHandler::ERROR_RATE_LIMIT_EXCEEDED);
                } elseif ($status_code === 503) {
                    throw new Exception('Service temporarily unavailable', PQLS_ErrorHandler::ERROR_MICROSERVICE_UNAVAILABLE);
                } elseif ($status_code !== 200) {
                    // Try to parse error details
                    $error_data = json_decode($response_body, true);
                    $error_message = $error_data['error'] ?? "HTTP {$status_code}";
                    
                    if ($status_code === 400) {
                        throw new Exception($error_message, PQLS_ErrorHandler::ERROR_INVALID_DATA);
                    } else {
                        throw new Exception($error_message, PQLS_ErrorHandler::ERROR_ENCRYPTION_FAILED);
                    }
                }

                $result = json_decode($response_body, true);
                
                if (json_last_error() !== JSON_ERROR_NONE) {
                    throw new Exception('Invalid JSON response: ' . json_last_error_msg(), PQLS_ErrorHandler::ERROR_INVALID_DATA);
                }
                
                // Validate response structure
                if (!isset($result['encryptedData'])) {
                    throw new Exception('Missing encryptedData in response', PQLS_ErrorHandler::ERROR_ENCRYPTION_FAILED);
                }
                
                return $result;
                
            }, $context);
            
            // Handle retry result
            if (is_array($result) && isset($result['success']) && !$result['success']) {
                $this->log_encryption_performance($form_id, $field_id, $data_size, false, $result['message']);
                return false;
            }
            
            // Log successful encryption with performance metrics
            $encrypted_size = strlen($result['encryptedData']);
            $this->log_encryption_performance($form_id, $field_id, $data_size, true, null, $encrypted_size);
            
            // Get site identifier for key isolation
            $site_id = get_option('pqls_site_id');
            if (empty($site_id)) {
                $site_id = $this->generate_unique_site_id();
                update_option('pqls_site_id', $site_id);
            }
            
            // Create enhanced encrypted data format with site isolation
            $encrypted_data_format = [
                'encrypted' => true,
                'algorithm' => $algorithm,
                'data' => $result['encryptedData'],
                'site_id' => $site_id,
                'encrypted_at' => current_time('c'),
                'version' => '2.0' // Updated format version
            ];
            
            // Add format identifier prefix for backward compatibility and easier detection
            $prefix = !$this->is_rsa_algorithm($algorithm) ? 'pqls_pq_encrypted::' : 'pqls_rsa_encrypted::';
            $encrypted_data = $prefix . base64_encode(json_encode($encrypted_data_format));
            
            // Log successful encryption operation
            $this->error_handler->log_activity("Field encrypted successfully", 'info', $context);
            
            return $encrypted_data;
            
        } catch (Exception $e) {
            // Determine error code from exception
            $error_code = $e->getCode() ?: PQLS_ErrorHandler::ERROR_ENCRYPTION_FAILED;
            
            $this->error_handler->handle_crypto_error(
                'Field Encryption',
                $e->getMessage(),
                $error_code,
                $context
            );
            
            $this->log_encryption_performance($form_id, $field_id, $data_size, false, $e->getMessage());
            return false;
        }
    }
    
    /**
     * Enhanced encryption method with post-quantum support and performance optimization
     */
    private function encrypt_data_enhanced($data, $public_key, $form_id, $field_id) {
        $settings = get_option($this->option_name, array());
        $microservice_url = $settings['microservice_url'] ?? PQLS_MICROSERVICE_URL;
        $algorithm = get_option('pqls_algorithm', 'rsa-oaep-256');
        $security_level = get_option('pqls_security_level', 'standard');
        
        // Performance optimization: skip encryption for empty values
        if (empty($data) || trim($data) === '') {
            return $data;
        }
        
        // Prepare request body with enhanced metadata
        $request_body = [
            'data' => $data,
            'publicKey' => trim($public_key),
            'algorithm' => $algorithm,  // Required parameter for the API
            'metadata' => [
                'form_id' => $form_id,
                'field_id' => $field_id,
                'algorithm' => $algorithm,
                'security_level' => $security_level,
                'timestamp' => current_time('c'),
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'
            ]
        ];
        
        // Add security level parameter for post-quantum encryption
        if (!$this->is_rsa_algorithm($algorithm)) {
            $request_body['securityLevel'] = $security_level;
        }
        
        $body = json_encode($request_body);
        
        // Enhanced timeout based on data size and algorithm
        $data_size = strlen($data);
        $timeout = $this->calculate_encryption_timeout($data_size, $algorithm);
        
        $response = wp_remote_post($microservice_url . '/encrypt', [
            'headers' => [
                'Content-Type' => 'application/json',
                'User-Agent' => 'PQLS-WordPress/' . PQLS_VERSION
            ],
            'body' => $body,
            'timeout' => $timeout,
            'blocking' => true
        ]);

        if (is_wp_error($response)) {
            $error_message = $response->get_error_message();
            error_log("PQLS: Encryption failed for form {$form_id}, field {$field_id} - {$error_message}");
            
            // Log performance metrics for debugging
            $this->log_encryption_performance($form_id, $field_id, $data_size, false, $error_message);
            
            return false;
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);

        if ($status_code !== 200) {
            error_log("PQLS: Encryption failed with status {$status_code} for form {$form_id}, field {$field_id}: {$response_body}");
            
            // Try to parse error details
            $error_data = json_decode($response_body, true);
            $error_message = $error_data['error'] ?? "HTTP {$status_code}";
            
            $this->log_encryption_performance($form_id, $field_id, $data_size, false, $error_message);
            
            return false;
        }

        $result = json_decode($response_body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("PQLS: Invalid JSON response for form {$form_id}, field {$field_id}: " . json_last_error_msg());
            return false;
        }
        
        // Validate response structure
        if (!isset($result['encryptedData'])) {
            error_log("PQLS: Missing encryptedData in response for form {$form_id}, field {$field_id}");
            return false;
        }
        
        // Log successful encryption with performance metrics
        $encrypted_size = strlen($result['encryptedData']);
        $this->log_encryption_performance($form_id, $field_id, $data_size, true, null, $encrypted_size);
        
        // Get site identifier for key isolation
        $site_id = $this->get_site_id();
        
        // Create enhanced encrypted data format with site isolation
        $encrypted_data_format = [
            'encrypted' => true,
            'algorithm' => $algorithm,
            'data' => $result['encryptedData'],
            'site_id' => $site_id,
            'encrypted_at' => current_time('c'),
            'version' => '2.0' // Updated format version
        ];
        
        // Add format identifier prefix for backward compatibility and easier detection
        $prefix = !$this->is_rsa_algorithm($algorithm) ? 'pqls_pq_encrypted::' : 'pqls_rsa_encrypted::';
        $encrypted_data = $prefix . base64_encode(json_encode($encrypted_data_format));
        
        return $encrypted_data;
    }
    
    /**
     * Legacy encryption method for backward compatibility
     */
    private function encrypt_data($data, $public_key) {
        return $this->encrypt_data_enhanced($data, $public_key, 'legacy', 'unknown');
    }
    
    /**
     * Calculate appropriate timeout based on data size and algorithm
     */
    private function calculate_encryption_timeout($data_size, $algorithm) {
        $base_timeout = 15; // Base timeout in seconds
        
        // Add extra time for larger data
        $size_factor = ceil($data_size / 1024); // 1 second per KB
        
        // Post-quantum algorithms may need more time
        $algorithm_factor = $this->is_rsa_algorithm($algorithm) ? 1 : 1.5;
        
        $calculated_timeout = $base_timeout + $size_factor * $algorithm_factor;
        
        // Cap at reasonable maximum
        return min($calculated_timeout, 60);
    }
    
    /**
     * Log encryption performance metrics
     */
    private function log_encryption_performance($form_id, $field_id, $data_size, $success, $error = null, $encrypted_size = null) {
        $log_entry = [
            'timestamp' => current_time('c'),
            'form_id' => $form_id,
            'field_id' => $field_id,
            'data_size' => $data_size,
            'encrypted_size' => $encrypted_size,
            'success' => $success,
            'algorithm' => get_option('pqls_algorithm', 'unknown'),
            'security_level' => get_option('pqls_security_level', 'standard')
        ];
        
        if (!$success && $error) {
            $log_entry['error'] = $error;
        }
        
        // Store in performance log (keep last 100 entries)
        $performance_log = get_option('pqls_performance_log', []);
        $performance_log[] = $log_entry;
        
        // Keep only last 100 entries
        if (count($performance_log) > 100) {
            $performance_log = array_slice($performance_log, -100);
        }
        
        update_option('pqls_performance_log', $performance_log);
        
        // Log critical performance issues
        if (!$success || ($data_size > 0 && $encrypted_size && ($encrypted_size / $data_size) > 10)) {
            $message = $success ? 
                "High encryption overhead: {$encrypted_size}/{$data_size} bytes" :
                "Encryption failed: {$error}";
            error_log("PQLS Performance: {$message} (Form: {$form_id}, Field: {$field_id})");
        }
    }
    
    /**
     * Log activity for audit trail
     */
    private function log_activity($message, $level = 'info') {
        $log_entries = get_option('pqls_activity_log', []);
        
        $log_entries[] = [
            'timestamp' => current_time('mysql'),
            'message' => $message,
            'level' => $level,
            'user_id' => get_current_user_id(),
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
        ];
        
        // Keep only last 50 entries
        if (count($log_entries) > 50) {
            $log_entries = array_slice($log_entries, -50);
        }
        
        update_option('pqls_activity_log', $log_entries);
    }

    private function decrypt_data($encrypted_data) {
        $this->init_error_handler();
        $api_key = get_option('pqls_api_key');
        $microservice_url = get_option('pqls_settings')['microservice_url'] ?? PQLS_MICROSERVICE_URL;
        $private_key = get_option('pqls_private_key');
        $current_site_id = get_option('pqls_site_id');

        // Validate prerequisites
        if (empty($api_key) || empty($private_key)) {
            return $this->error_handler->handle_crypto_error(
                'Data Decryption',
                'API Key or Private Key is not configured',
                PQLS_ErrorHandler::ERROR_INVALID_KEY,
                ['microservice_url' => $microservice_url]
            );
        }

        $context = [
            'microservice_url' => $microservice_url,
            'data_length' => strlen($encrypted_data),
            'site_id' => $current_site_id
        ];

        try {
            // Parse the new encrypted data format with site isolation
            $actual_encrypted_data = $encrypted_data;
            $site_id_from_data = null;
            $data_version = '1.0'; // Default to legacy format
            
            // Check if this is the new format (version 2.0) with site isolation
            if (strpos($encrypted_data, 'pqls_pq_encrypted::') === 0 || strpos($encrypted_data, 'pqls_rsa_encrypted::') === 0) {
                $prefix_length = strpos($encrypted_data, 'pqls_pq_encrypted::') === 0 ? 19 : 20;
                $encoded_data = substr($encrypted_data, $prefix_length);
                
                // Try to decode as new format
                $decoded_data = base64_decode($encoded_data);
                if ($decoded_data !== false) {
                    $data_structure = json_decode($decoded_data, true);
                    if (json_last_error() === JSON_ERROR_NONE && isset($data_structure['version']) && $data_structure['version'] === '2.0') {
                        // New format with site isolation
                        $actual_encrypted_data = $data_structure['data'];
                        $site_id_from_data = $data_structure['site_id'];
                        $data_version = $data_structure['version'];
                        $context['data_version'] = $data_version;
                        $context['data_site_id'] = $site_id_from_data;
                        
                        // Verify site isolation - only decrypt data encrypted by this site
                        if ($site_id_from_data !== $current_site_id) {
                            return $this->error_handler->handle_crypto_error(
                                'Data Decryption',
                                'Data encrypted by different site - access denied for security',
                                PQLS_ErrorHandler::ERROR_PERMISSION_DENIED,
                                $context
                            );
                        }
                    } else {
                        // Legacy format - just remove prefix
                        $actual_encrypted_data = $encoded_data;
                    }
                }
            }

            // Use retry logic for decryption
            $result = $this->error_handler->retry_microservice_request(function() use ($actual_encrypted_data, $private_key, $api_key, $microservice_url) {
                
                $body = json_encode([
                    'encryptedData' => $actual_encrypted_data,
                    'privateKey' => $private_key
                ]);

                $response = wp_remote_post($microservice_url . '/decrypt', [
                    'headers' => [
                        'Content-Type' => 'application/json',
                        'Authorization' => 'Bearer ' . $api_key
                    ],
                    'body' => $body,
                    'timeout' => 30
                ]);

                if (is_wp_error($response)) {
                    $error_code = $response->get_error_code();
                    if ($error_code === 'http_request_timeout') {
                        throw new Exception('Request timeout during decryption', PQLS_ErrorHandler::ERROR_TIMEOUT);
                    } else {
                        throw new Exception('Connection failed: ' . $response->get_error_message(), PQLS_ErrorHandler::ERROR_CONNECTION_FAILED);
                    }
                }

                $status_code = wp_remote_retrieve_response_code($response);
                $response_body = wp_remote_retrieve_body($response);
                $result = json_decode($response_body, true);

                if ($status_code === 200 && isset($result['decryptedData'])) {
                    return $result;
                } else {
                    $error_message = $result['error'] ?? 'Unknown error';
                    if(isset($result['details'])) {
                        $error_message .= ' - Details: ' . $result['details'];
                    }
                    
                    if ($status_code === 401) {
                        throw new Exception('Authentication failed: ' . $error_message, PQLS_ErrorHandler::ERROR_PERMISSION_DENIED);
                    } elseif ($status_code === 400) {
                        throw new Exception('Invalid data format: ' . $error_message, PQLS_ErrorHandler::ERROR_INVALID_DATA);
                    } elseif ($status_code === 429) {
                        throw new Exception('Rate limit exceeded', PQLS_ErrorHandler::ERROR_RATE_LIMIT_EXCEEDED);
                    } elseif ($status_code === 503) {
                        throw new Exception('Service temporarily unavailable', PQLS_ErrorHandler::ERROR_MICROSERVICE_UNAVAILABLE);
                    } else {
                        throw new Exception($error_message, PQLS_ErrorHandler::ERROR_DECRYPTION_FAILED);
                    }
                }
                
            }, $context);
            
            // Handle retry result
            if (is_array($result) && isset($result['success']) && !$result['success']) {
                return $result;
            }
            
            // Log successful decryption
            $this->error_handler->log_activity("Data decrypted successfully", 'info', $context);
            
            return ['success' => true, 'data' => $result['decryptedData']];
            
        } catch (Exception $e) {
            // Determine error code from exception
            $error_code = $e->getCode() ?: PQLS_ErrorHandler::ERROR_DECRYPTION_FAILED;
            
            return $this->error_handler->handle_crypto_error(
                'Data Decryption',
                $e->getMessage(),
                $error_code,
                $context
            );
        }
    }
    
    /**
     * AJAX handler for decrypting a field
     */
    public function ajax_decrypt_field() {
        check_ajax_referer('pqls_nonce', 'nonce');
        
        if (!current_user_can('decrypt_pqls_data')) {
            wp_send_json_error(__('Permission denied', 'pqls'));
        }
        
        $encrypted_data = sanitize_text_field($_POST['data']);
        
        // The decrypt_data method now handles both old and new formats with site isolation
        // No need to remove prefixes here as decrypt_data handles format detection
        $decryption_result = $this->decrypt_data($encrypted_data);
        
        if ($decryption_result['success']) {
            // Log the decryption event for audit purposes
            error_log(sprintf('PQLS Audit: User %d decrypted field data.', get_current_user_id()));
            wp_send_json_success($decryption_result['data']);
        } else {
            error_log(sprintf('PQLS: Decryption failed for user %d: %s', get_current_user_id(), $decryption_result['message']));
            wp_send_json_error($decryption_result['message']);
        }
    }
    
    /**
     * AJAX handler for exporting CSV
     */
    public function ajax_export_csv() {
        check_ajax_referer('pqls_nonce', 'nonce');

        if (!current_user_can('manage_pqls')) {
            wp_send_json_error('Permission denied');
        }

        $form_id = isset($_POST['form_id']) ? intval($_POST['form_id']) : 0;
        $export_type = isset($_POST['export_type']) ? sanitize_text_field($_POST['export_type']) : 'encrypted';

        if (!$form_id) {
            wp_send_json_error('Invalid form ID');
        }

        $form = GFAPI::get_form($form_id);
        $entries = GFAPI::get_entries($form_id, ['status' => 'active']);

        // Audit log
        error_log(sprintf('PQLS Audit: User %d exported CSV for form %d with type "%s"', get_current_user_id(), $form_id, $export_type));

        $csv_data = $this->generate_csv_data($form, $entries, $export_type);

        $upload_dir = wp_upload_dir();
        $filename = 'export-' . $form_id . '-' . time() . '.csv';
        $filepath = $upload_dir['basedir'] . '/' . $filename;
        $fileurl = $upload_dir['baseurl'] . '/' . $filename;

        file_put_contents($filepath, $csv_data);

        wp_send_json_success(['url' => $fileurl]);
    }

    /**
     * Generate CSV data from entries
     */
    private function generate_csv_data($form, $entries, $export_type) {
        $csv_output = '';
        $headers = [];

        // Create headers
        foreach ($form['fields'] as $field) {
            $headers[] = $field->label;
        }
        $csv_output .= '"' . implode('","', $headers) . '"' . "\n";

        // Get encrypted fields configuration
        $settings = get_option($this->option_name, []);
        $encrypted_fields_config = $settings['encrypted_fields'] ?? [];
        if (!is_array($encrypted_fields_config)) {
            $encrypted_fields_config = [];
        }

        // Add entry rows
        foreach ($entries as $entry) {
            $row_data = [];
            foreach ($form['fields'] as $field) {
                $value = rgar($entry, (string) $field->id);
                $field_id_key = $form['id'] . '_' . $field->id;

                if ($export_type === 'decrypt' && in_array($field_id_key, $encrypted_fields_config) && !empty($value)) {
                    $decryption_result = $this->decrypt_data($value);
                    if ($decryption_result['success']) {
                        $value = $decryption_result['data'];
                    } else {
                        $value = 'DECRYPTION_FAILED: ' . $decryption_result['message'];
                    }
                }
                $row_data[] = str_replace('"', '""', $value);
            }
            $csv_output .= '"' . implode('","', $row_data) . '"' . "\n";
        }

        return $csv_output;
    }
    
    /**
     * AJAX handler for regenerating keys
     */
    public function ajax_regenerate_keys() {
        check_ajax_referer('pqls_nonce', 'pqls_nonce');
        
        if ($this->generate_keypair()) {
            wp_send_json_success('Keys regenerated successfully.');
        } else {
            wp_send_json_error('Failed to regenerate keys.');
        }
    }
    
    /**
     * AJAX handler for testing connection
     */
    public function ajax_test_connection() {
        check_ajax_referer('pqls_nonce', 'nonce');
        
        $settings = get_option($this->option_name, array());
        $microservice_url = $settings['microservice_url'] ?? PQLS_MICROSERVICE_URL;
        
        $response = wp_remote_get($microservice_url . '/status');
        
        if (is_wp_error($response)) {
            wp_send_json_error('Connection failed: ' . $response->get_error_message());
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($status_code === 200) {
            wp_send_json_success('Connection successful! Response: ' . $body);
        } else {
            wp_send_json_error('Connection failed with status ' . $status_code . '. Response: ' . $body);
        }
    }

    /**
     * AJAX handler for testing decryption
     */
    public function ajax_test_decrypt() {
        check_ajax_referer('pqls_nonce', 'nonce');
    
        if (!current_user_can('decrypt_pqls_data')) {
            wp_send_json_error('Permission Denied');
        }
    
        $test_string = "This is a test string for encryption and decryption verification: " . wp_generate_password(16, false);
        $public_key = get_option('pqls_public_key');
        $algorithm = get_option('pqls_algorithm', 'unknown');
        $security_level = get_option('pqls_security_level', 'standard');
    
        if (empty($public_key)) {
            wp_send_json_error('Public key not found. Please generate keys first.');
        }
    
        // Encrypt using the current algorithm
        $encrypted = $this->encrypt_data($test_string, $public_key);
        if ($encrypted === false || $encrypted === $test_string) {
            wp_send_json_error('Encryption failed. The data was not encrypted properly.');
        }
    
        // Decrypt and get detailed result
        $decrypt_result = $this->decrypt_data($encrypted);
        
        if (is_array($decrypt_result) && isset($decrypt_result['success'])) {
            if ($decrypt_result['success'] && isset($decrypt_result['data'])) {
                $decrypted_data = $decrypt_result['data'];
                
                if ($decrypted_data === $test_string) {
                    // Get additional information from the decryption response
                    $algorithm_used = $decrypt_result['algorithm_used'] ?? $algorithm;
                    $encryption_type = $decrypt_result['encryption_type'] ?? 'unknown';
                    
                    $success_message = "✅ Test successful! Round-trip encryption/decryption completed.";
                    $details = [
                        'algorithm' => $algorithm_used,
                        'security_level' => $security_level,
                        'encryption_type' => $encryption_type,
                        'data_size' => strlen($test_string),
                        'encrypted_size' => strlen($encrypted),
                        'is_post_quantum' => !$this->is_rsa_algorithm($algorithm_used)
                    ];
                    
                    $this->log_activity('Decryption test completed successfully using ' . $algorithm_used);
                    
                    wp_send_json_success([
                        'message' => $success_message,
                        'details' => $details
                    ]);
                } else {
                    wp_send_json_error("Decryption test failed. The decrypted data does not match the original.");
                }
            } else {
                $error_message = $decrypt_result['message'] ?? 'Decryption failed';
                wp_send_json_error("Decryption failed: " . $error_message);
            }
        } else {
            // Handle legacy string response
            if ($decrypt_result === $test_string) {
                wp_send_json_success([
                    'message' => "✅ Test successful! The decrypted string matches the original.",
                    'details' => [
                        'algorithm' => $algorithm,
                        'security_level' => $security_level,
                        'data_size' => strlen($test_string),
                        'encrypted_size' => strlen($encrypted),
                        'is_post_quantum' => !$this->is_rsa_algorithm($algorithm)
                    ]
                ]);
            } else {
                wp_send_json_error("Decryption test failed. The decrypted data does not match the original.");
            }
        }
    }

    /**
     * Gravity Forms missing notice
     */
    public function gravity_forms_missing_notice() {
        echo '<div class="error"><p>';
        echo __('Post Quantum Lattice Shield requires Gravity Forms to be installed and active.', 'pqls');
        echo '</p></div>';
    }
    
    /**
     * Format encrypted entry display
     */
    public function format_encrypted_entry_display($value, $field, $entry, $form) {
        $field_id = is_object($field) ? $field->id : $field;
        
        if ($value !== null && $this->is_encrypted_data($value)) {
            if (current_user_can('decrypt_pqls_data')) {
                $html = '<div class="pqls-encrypted-data-container">';
                $html .= '<span class="pqls-encrypted-badge">🔒</span>';
                $html .= '<div class="pqls-encrypted-data" data-encrypted="' . esc_attr($value) . '">';
                $html .= '<span class="pqls-redacted-view">[Encrypted]</span>';
                $html .= '<span class="pqls-decrypted-view" style="display:none;"></span>';
                $html .= '</div>';
                $html .= '<div class="pqls-actions">';
                $html .= '<button type="button" class="button button-small pqls-decrypt-button">' . __('Decrypt', 'pqls') . '</button>';
                $html .= '<button type="button" class="button button-small pqls-hide-button" style="display:none;">' . __('Hide', 'pqls') . '</button>';
                $html .= '</div>';
                $html .= '<div class="pqls-security-warning" style="display:none;color:#d63638;font-size:12px;margin-top:5px;">';
                $html .= '<span class="dashicons dashicons-warning" style="font-size:12px;"></span> ';
                $html .= __('Warning: This data is now visible. Be cautious where you display it.', 'pqls');
                $html .= '</div>';
                $html .= '</div>';
                return $html;
            } else {
                return '<span class="pqls-encrypted-badge">🔒</span> <span class="pqls-no-permission">[Encrypted]</span>';
            }
        }
        
        return $value;
    }
    
    /**
     * Add encryption notice to entry info
     */
    public function add_encryption_notice($form, $entry) {
        $has_encrypted = false;
        foreach($entry as $key => $value) {
            if (is_numeric($key) && $this->is_encrypted_data($value)) {
                $has_encrypted = true;
                break;
            }
        }
        
        if ($has_encrypted) {
            echo '<div class="notice notice-info inline"><p><strong>' . __('Note:', 'pqls') . '</strong> ' . __('This entry contains encrypted fields.', 'pqls') . '</p></div>';
        }
    }

    /**
     * Add CSV export buttons to the entries list page
     */
    public function add_csv_export_buttons($form_id, $field_id, $value, $entry) {
        // This function is hooked to gform_entries_first_column_actions
        // which runs once per row. We only need to add our buttons once.
        static $buttons_added = false;
        if ($buttons_added) return;

        if (current_user_can('decrypt_pqls_data')) {
            ?>
            <div class="pqls-csv-export-buttons" style="margin-top: 20px;">
                <button class="button" id="pqls-export-redacted-csv" data-form-id="<?php echo esc_attr($form_id); ?>">
                    <?php _e('Export Redacted CSV', 'pqls'); ?>
                </button>
                <button class="button-primary" id="pqls-export-decrypted-csv" data-form-id="<?php echo esc_attr($form_id); ?>">
                    <?php _e('Export Decrypted CSV', 'pqls'); ?>
                </button>
            </div>
            <script type="text/javascript">
                jQuery(document).ready(function($) {
                    function getUrlParameter(name) {
                        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
                        var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
                        var results = regex.exec(location.search);
                        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
                    }

                    function exportCsv(exportType) {
                        var formId = $('#pqls-export-decrypted-csv').data('form-id');
                        var search = {
                            status: getUrlParameter('status'),
                            field_filters: [] // You might need to parse this from the URL if needed
                        };
                        var sorting = {
                            key: getUrlParameter('sort'),
                            direction: getUrlParameter('dir')
                        };

                        $.post(pqls_ajax.ajax_url, {
                            action: 'pqls_export_csv',
                            nonce: pqls_ajax.nonce,
                            form_id: formId,
                            export_type: exportType,
                            search_criteria: JSON.stringify(search),
                            sorting: JSON.stringify(sorting)
                        }, function(response) {
                            if (response.success) {
                                var a = document.createElement('a');
                                a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(response.data.csv_data);
                                a.target = '_blank';
                                a.download = 'export-' + exportType + '-' + formId + '.csv';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                            } else {
                                alert('Export failed: ' + response.data);
                            }
                        });
                    }

                    $('#pqls-export-redacted-csv').on('click', function() {
                        exportCsv('redact');
                    });
                    $('#pqls-export-decrypted-csv').on('click', function() {
                        exportCsv('decrypt');
                    });
                });
            </script>
            <?php
            $buttons_added = true;
        }
    }


    /**
     * Enqueue scripts for Gravity Forms pages
     */
    public function enqueue_gravity_forms_scripts($hook) {
        // Load on both entries and form editor pages
        if (strpos($hook, 'gf_entries') === false && strpos($hook, 'gf_edit_forms') === false) {
            return;
        }

        wp_enqueue_script('pqls-gravity-forms', PQLS_PLUGIN_URL . 'assets/gravity-forms.js', array('jquery'), PQLS_VERSION, true);
        wp_localize_script('pqls-gravity-forms', 'pqls_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('pqls_nonce'),
            'strings' => array(
                'decrypting' => __('Decrypting...', 'pqls'),
                'decrypt_failed' => __('Decryption failed', 'pqls'),
            )
        ));

        wp_enqueue_style('pqls-gravity-forms', PQLS_PLUGIN_URL . 'assets/gravity-forms.css', array(), PQLS_VERSION);

        $inline_script = "
            jQuery(document).on('click', '.pqls-decrypt-button', function(e) {
                e.preventDefault();
                var button = jQuery(this);
                var container = button.closest('.pqls-encrypted-data-container');
                var data_div = container.find('.pqls-encrypted-data');
                var encrypted_data = data_div.data('encrypted');
                var decrypted_view = container.find('.pqls-decrypted-view');
                var redacted_view = container.find('.pqls-redacted-view');
                var security_warning = container.find('.pqls-security-warning');
                var hide_button = container.find('.pqls-hide-button');
                
                // Show loading state
                button.prop('disabled', true);
                button.html('<span class=\"dashicons dashicons-update\" style=\"animation: spin 1s linear infinite;\"></span> ' + pqls_ajax.strings.decrypting);

                jQuery.post(pqls_ajax.ajax_url, {
                    action: 'pqls_decrypt_field',
                    nonce: pqls_ajax.nonce,
                    data: encrypted_data
                }, function(response) {
                    if (response.success) {
                        // Display decrypted data inline
                        decrypted_view.html('<strong>Decrypted:</strong> ' + jQuery('<div>').text(response.data).html()).show();
                        redacted_view.hide();
                        security_warning.show();
                        button.hide();
                        hide_button.show();
                    } else {
                        // Show error message
                        decrypted_view.html('<span style=\"color: #d63638;\">Error: ' + (response.data || pqls_ajax.strings.decrypt_failed) + '</span>').show();
                        button.html('Decrypt').prop('disabled', false);
                    }
                }).fail(function() {
                    // Handle AJAX failure
                    decrypted_view.html('<span style=\"color: #d63638;\">Error: ' + pqls_ajax.strings.decrypt_failed + '</span>').show();
                    button.html('Decrypt').prop('disabled', false);
                });
            });

            jQuery(document).on('click', '.pqls-hide-button', function(e) {
                e.preventDefault();
                var button = jQuery(this);
                var container = button.closest('.pqls-encrypted-data-container');
                var decrypted_view = container.find('.pqls-decrypted-view');
                var redacted_view = container.find('.pqls-redacted-view');
                var security_warning = container.find('.pqls-security-warning');
                var decrypt_button = container.find('.pqls-decrypt-button');
                
                // Hide decrypted data and show encrypted placeholder
                decrypted_view.hide();
                redacted_view.show();
                security_warning.hide();
                button.hide();
                decrypt_button.show().prop('disabled', false).html('Decrypt');
            });
        ";
        wp_add_inline_script('pqls-gravity-forms', $inline_script);
    }
    
    /**
     * Add encryption setting to Gravity Forms field editor
     */
    public function add_encryption_field_setting($position, $form_id) {
        if ($position == 50) { // Advanced settings
            ?>
            <li class="encrypt_field_setting field_setting">
                <input type="checkbox" id="field_encrypt_value" onclick="SetFieldProperty('pqls_encrypt', this.checked);" />
                <label for="field_encrypt_value" class="inline">
                    <?php _e('Encrypt this field', 'pqls'); ?>
                    <?php gform_tooltip('form_field_encrypt_value'); ?>
                </label>
            </li>
            <?php
        }
    }
    
    /**
     * Add tooltips for encryption setting
     */
    public function add_encryption_tooltips($tooltips) {
        $tooltips['form_field_encrypt_value'] = "<h6>" . __('Encrypt Field', 'pqls') . "</h6>" . __('When checked, the contents of this field will be encrypted using post-quantum cryptography before being stored.', 'pqls');
        return $tooltips;
    }

    /**
     * Add JavaScript to the Gravity Forms editor to handle our custom setting
     */
    public function add_encryption_editor_js() {
        ?>
        <script type='text/javascript'>
            // Add our custom field property to the list of supported properties
            fieldSettings.text += ', .encrypt_field_setting';
            fieldSettings.textarea += ', .encrypt_field_setting';
            fieldSettings.name += ', .encrypt_field_setting';
            fieldSettings.address += ', .encrypt_field_setting';
            fieldSettings.phone += ', .encrypt_field_setting';
            fieldSettings.email += ', .encrypt_field_setting';
            fieldSettings.website += ', .encrypt_field_setting';
            // Add to other fields as needed...

            // Set the 'pqls_encrypt' property when the form editor is loaded
            jQuery(document).bind('gform_load_field_settings', function(event, field, form) {
                jQuery('#field_encrypt_value').prop('checked', field.pqls_encrypt == true);
            });

            // Save the setting when the form is saved
            gform.add_filter('gform_pre_form_editor_save', function (form) {
                for (var i = 0; i < form.fields.length; i++) {
                    var field = form.fields[i];
                    if (typeof field.pqls_encrypt === 'undefined') {
                        field.pqls_encrypt = false;
                    }
                }
                return form;
            });
        </script>
        <?php
    }

    /**
     * Add visual indicator to frontend fields
     */
    public function add_encryption_field_indicator($content, $field, $value, $lead_id, $form_id) {
        if (is_admin()) {
            return $content;
        }

        // Check if field is marked for encryption using the pqls_encrypt property
        if (!empty($field->pqls_encrypt)) {
            $indicator = '<div class="pqls-field-indicator">' .
                '<span class="pqls-encryption-badge">' .
                '<span class="dashicons dashicons-shield-alt"></span> ' .
                __('Encrypted', 'pqls') .
                '</span>' .
                '</div>';
            
            // Insert indicator before the field
            $content = $indicator . $content;
        }

        return $content;
    }
    
    /**
     * Add a CSS class to encrypted fields for styling
     */
    public function add_encryption_field_class($classes, $field, $form) {
        // Check if field is marked for encryption using the pqls_encrypt property
        if (!empty($field->pqls_encrypt)) {
            $classes .= ' pqls-encrypted-field-input';
        }

        return $classes;
    }
    

    
    /**
     * Intercept plugin download link to add our custom query arg
     */
    public function intercept_plugin_download() {
        if (isset($_GET['plugin']) && $_GET['plugin'] === 'post-quantum-lattice-shield/post-quantum-lattice-shield.php' && isset($_GET['action']) && $_GET['action'] === 'download') {
            $download_link = wp_nonce_url(admin_url('admin-post.php?action=pqls_download_plugin'), 'pqls_download_nonce');
            wp_redirect($download_link);
            exit;
        }
    }
    
    /**
     * Check for our custom download action
     */
    public function check_plugin_download() {
        if (isset($_GET['action']) && $_GET['action'] === 'pqls_download_plugin' && current_user_can('install_plugins')) {
            // No need for nonce check here, it's handled by admin-post.php
            $this->handle_plugin_download();
        }
    }

    /**
     * Set custom headers for download
     */
    public function set_download_headers($headers) {
        $headers['Content-Disposition'] = 'attachment; filename="postquantumlatticeshield.zip"';
        return $headers;
    }

    /**
     * Handle plugin download from admin
     */
    public function handle_plugin_download_admin() {
        if (isset($_GET['action']) && $_GET['action'] === 'pqls_download_plugin' && check_admin_referer('pqls_download_nonce')) {
            $this->handle_plugin_download();
        }
    }

    /**
     * The actual download handler
     */
    private function handle_plugin_download() {
        $zip_file = PQLS_PLUGIN_DIR . '../public/plugin-download/postquantumlatticeshield.zip';

        if (file_exists($zip_file)) {
            header('Content-Type: application/zip');
            header('Content-Disposition: attachment; filename="postquantumlatticeshield.zip"');
            header('Content-Length: ' . filesize($zip_file));
            readfile($zip_file);
            exit;
        } else {
            wp_die('Plugin zip file not found.');
        }
    }
    
    /**
     * AJAX handler for backing up keys
     */
    public function ajax_backup_keys() {
        check_ajax_referer('pqls_nonce', 'nonce');
        
        if (!current_user_can('manage_pqls')) {
            wp_send_json_error('Permission denied');
        }
        
        $public_key = get_option('pqls_public_key');
        $private_key = get_option('pqls_private_key');
        $algorithm = get_option('pqls_algorithm');
        
        if (empty($public_key) || empty($private_key)) {
            wp_send_json_error('No keys found to backup');
        }
        
        // Store backup keys
        update_option('pqls_rsa_public_key_backup', $public_key);
        update_option('pqls_rsa_private_key_backup', $private_key);
        update_option('pqls_rsa_algorithm_backup', $algorithm);
        update_option('pqls_backup_timestamp', current_time('mysql'));
        
        $this->log_activity('RSA keys backed up before migration');
        
        wp_send_json_success('Keys backed up successfully');
    }
    
    /**
     * AJAX handler for starting migration
     */
    public function ajax_start_migration() {
        check_ajax_referer('pqls_nonce', 'nonce');
        
        if (!current_user_can('manage_pqls')) {
            wp_send_json_error('Permission denied');
        }
        
        $security_level = sanitize_text_field($_POST['security_level'] ?? 'standard');
        
        if (!in_array($security_level, ['standard', 'high'])) {
            wp_send_json_error('Invalid security level');
        }
        
        // Check if backup exists
        $has_backup = get_option('pqls_rsa_public_key_backup', false);
        if (!$has_backup) {
            wp_send_json_error('Please backup your keys first');
        }
        
        // Set migration status
        update_option('pqls_migration_status', 'in_progress');
        update_option('pqls_security_level', $security_level);
        
        $this->log_activity('Migration started with security level: ' . $security_level);
        
        // Generate new post-quantum keys
        $algorithm = $security_level === 'high' ? 'ML-KEM-1024' : 'ML-KEM-768';
        $success = $this->generate_post_quantum_keypair($algorithm);
        
        if ($success) {
            update_option('pqls_migration_status', 'completed');
            $this->log_activity('Migration completed successfully');
            wp_send_json_success('Migration completed successfully');
        } else {
            update_option('pqls_migration_status', 'failed');
            $this->log_activity('Migration failed');
            wp_send_json_error('Migration failed. Please check your microservice connection.');
        }
    }
    
    /**
     * AJAX handler for checking migration status
     */
    public function ajax_check_migration_status() {
        check_ajax_referer('pqls_nonce', 'nonce');
        
        if (!current_user_can('manage_pqls')) {
            wp_send_json_error('Permission denied');
        }
        
        $status = get_option('pqls_migration_status', 'pending');
        $algorithm = get_option('pqls_algorithm', 'unknown');
        $security_level = get_option('pqls_security_level', 'standard');
        
        wp_send_json_success([
            'status' => $status,
            'algorithm' => $algorithm,
            'security_level' => $security_level,
            'is_post_quantum' => !$this->is_rsa_algorithm($algorithm)
        ]);
    }
    
    /**
     * Generate post-quantum keypair with specific algorithm
     */
    private function generate_post_quantum_keypair($algorithm = 'ML-KEM-768') {
        $settings = get_option($this->option_name, array());
        $microservice_url = $settings['microservice_url'] ?? PQLS_MICROSERVICE_URL;
        
        $security_level = $algorithm === 'ML-KEM-1024' ? 'high' : 'standard';
        
        $response = wp_remote_get($microservice_url . '/generate-keypair?securityLevel=' . $security_level, [
            'timeout' => 30
        ]);
        
        if (is_wp_error($response)) {
            error_log('PQLS: Failed to generate post-quantum keypair - ' . $response->get_error_message());
            return false;
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($status_code !== 200) {
            error_log('PQLS: Generate post-quantum keypair failed with status ' . $status_code . ': ' . $body);
            return false;
        }
        
        $data = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log('PQLS: Invalid JSON response: ' . json_last_error_msg());
            return false;
        }
        
        if (isset($data['publicKey']) && isset($data['privateKey'])) {
            // Get or generate site ID for key isolation
            $site_id = get_option('pqls_site_id');
            if (empty($site_id)) {
                $site_id = $this->generate_unique_site_id();
                update_option('pqls_site_id', $site_id);
            }
            
            // Store keys with site-specific context
            update_option('pqls_public_key', $data['publicKey']);
            update_option('pqls_private_key', $data['privateKey']);
            update_option('pqls_algorithm', $data['algorithm'] ?? $algorithm);
            update_option('pqls_security_level', $data['securityLevel'] ?? $security_level);
            update_option('pqls_key_generated', current_time('mysql'));
            update_option('pqls_site_key_version', '1.0'); // Track key format version
            return true;
        }
        
        error_log('PQLS: Response missing required keys: ' . print_r($data, true));
        return false;
    }
    
    /**
     * AJAX handler for removing backup keys
     */
    public function ajax_remove_backup() {
        check_ajax_referer('pqls_nonce', 'nonce');
        
        if (!current_user_can('manage_pqls')) {
            wp_send_json_error('Permission denied');
        }
        
        // Remove backup keys
        delete_option('pqls_rsa_public_key_backup');
        delete_option('pqls_rsa_private_key_backup');
        delete_option('pqls_rsa_algorithm_backup');
        delete_option('pqls_backup_timestamp');
        
        $this->log_activity('RSA backup keys removed');
        
        wp_send_json_success('Backup keys removed successfully');
    }
    
    /**
     * AJAX handler for testing post-quantum encryption
     */
    public function ajax_test_pq_encryption() {
        check_ajax_referer('pqls_nonce', 'nonce');
        
        if (!current_user_can('manage_pqls')) {
            wp_send_json_error('Permission denied');
        }
        
        $public_key = get_option('pqls_public_key');
        $private_key = get_option('pqls_private_key');
        $algorithm = get_option('pqls_algorithm', 'ML-KEM-768');
        
        if (empty($public_key) || empty($private_key)) {
            wp_send_json_error('No keys available for testing');
        }
        
        $test_data = 'Test data for post-quantum encryption verification: ' . wp_generate_password(32, false);
        $settings = get_option($this->option_name, array());
        $microservice_url = $settings['microservice_url'] ?? PQLS_MICROSERVICE_URL;
        
        // Test encryption
        $encrypt_response = wp_remote_post($microservice_url . '/encrypt', [
            'headers' => ['Content-Type' => 'application/json'],
            'body' => json_encode([
                'data' => $test_data,
                'publicKey' => trim($public_key),
                'algorithm' => $algorithm
            ]),
            'timeout' => 30
        ]);
        
        if (is_wp_error($encrypt_response)) {
            wp_send_json_error('Encryption test failed: ' . $encrypt_response->get_error_message());
        }
        
        $encrypt_status = wp_remote_retrieve_response_code($encrypt_response);
        $encrypt_body = wp_remote_retrieve_body($encrypt_response);
        
        if ($encrypt_status !== 200) {
            wp_send_json_error('Encryption test failed with status ' . $encrypt_status . ': ' . $encrypt_body);
        }
        
        $encrypt_result = json_decode($encrypt_body, true);
        if (json_last_error() !== JSON_ERROR_NONE || !isset($encrypt_result['encryptedData'])) {
            wp_send_json_error('Invalid encryption response');
        }
        
        // Test decryption
        $api_key = get_option('pqls_api_key');
        if (empty($api_key)) {
            wp_send_json_error('API key not configured for decryption test');
        }
        
        $decrypt_response = wp_remote_post($microservice_url . '/decrypt', [
            'headers' => [
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . $api_key
            ],
            'body' => json_encode([
                'encryptedData' => $encrypt_result['encryptedData'],
                'privateKey' => $private_key
            ]),
            'timeout' => 30
        ]);
        
        if (is_wp_error($decrypt_response)) {
            wp_send_json_error('Decryption test failed: ' . $decrypt_response->get_error_message());
        }
        
        $decrypt_status = wp_remote_retrieve_response_code($decrypt_response);
        $decrypt_body = wp_remote_retrieve_body($decrypt_response);
        
        if ($decrypt_status !== 200) {
            wp_send_json_error('Decryption test failed with status ' . $decrypt_status . ': ' . $decrypt_body);
        }
        
        $decrypt_result = json_decode($decrypt_body, true);
        if (json_last_error() !== JSON_ERROR_NONE || !isset($decrypt_result['decryptedData'])) {
            wp_send_json_error('Invalid decryption response');
        }
        
        // Verify round-trip
        if ($decrypt_result['decryptedData'] !== $test_data) {
            wp_send_json_error('Round-trip test failed: decrypted data does not match original');
        }
        
        $this->log_activity('Post-quantum encryption test completed successfully');
        
        wp_send_json_success([
            'message' => 'Post-quantum encryption test completed successfully',
            'algorithm' => $encrypt_result['metadata']['algorithm'] ?? $algorithm,
            'security_level' => $encrypt_result['metadata']['securityLevel'] ?? 'unknown',
            'data_size' => strlen($test_data),
            'encrypted_size' => strlen($encrypt_result['encryptedData']['encryptedData'] ?? ''),
            'encryption_type' => $decrypt_result['encryptionType'] ?? 'post-quantum'
        ]);
    }
    
    /**
     * AJAX handler for refreshing system status
     */
    public function ajax_refresh_status() {
        check_ajax_referer('pqls_nonce', 'nonce');
        
        if (!current_user_can('manage_pqls')) {
            wp_send_json_error('Permission denied');
        }
        
        $oqs_status = $this->check_oqs_status();
        $algorithm = get_option('pqls_algorithm', 'unknown');
        $migration_status = get_option('pqls_migration_status', 'pending');
        $security_level = get_option('pqls_security_level', 'standard');
        $is_post_quantum = !$this->is_rsa_algorithm($algorithm);
        
        wp_send_json_success([
            'oqs_status' => $oqs_status,
            'algorithm' => $algorithm,
            'migration_status' => $migration_status,
            'security_level' => $security_level,
            'is_post_quantum' => $is_post_quantum,
            'timestamp' => current_time('mysql')
        ]);
    }
    
    /**
     * Display form errors from encryption failures with enhanced formatting
     */
    public function display_form_errors($form, $is_ajax, $field_values) {
        $form_errors = get_transient('pqls_form_errors_' . $form['id']);
        
        if (!empty($form_errors)) {
            foreach ($form_errors as $error) {
                // Handle both old string format and new array format
                $error_message = is_array($error) ? $error['message'] : $error;
                $error_code = is_array($error) ? $error['code'] : null;
                
                echo '<div class="pqls-form-error gform_validation_error" role="alert">';
                echo '<h2 class="gform_submission_error hide_summary">' . __('Encryption Error', 'pqls') . '</h2>';
                echo '<div class="validation_error">' . esc_html($error_message) . '</div>';
                
                // Add retry button for retryable errors
                if (is_array($error) && isset($error['code'])) {
                    $this->init_error_handler();
                    if ($this->error_handler->can_retry($error['code'])) {
                        echo '<div class="pqls-error-actions" style="margin-top: 10px;">';
                        echo '<button type="button" class="button button-small" onclick="location.reload()">' . __('Try Again', 'pqls') . '</button>';
                        echo '</div>';
                    }
                }
                
                echo '</div>';
            }
            
            // Clear errors after displaying
            delete_transient('pqls_form_errors_' . $form['id']);
        }
        
        return $form;
    }
    
    /**
     * Handle encryption validation errors
     */
    public function handle_encryption_validation($validation_result) {
        $form = $validation_result['form'];
        
        // Check for encryption errors
        $form_errors = get_transient('pqls_form_errors_' . $form['id']);
        
        if (!empty($form_errors)) {
            $validation_result['is_valid'] = false;
            
            // Add field-level validation errors for encrypted fields
            $settings = get_option($this->option_name, array());
            $all_encrypted_fields = $settings['encrypted_fields'] ?? [];
            
            // Ensure it's an array
            if (!is_array($all_encrypted_fields)) {
                $all_encrypted_fields = [];
            }
            
            // Filter encrypted fields for this specific form
            $encrypted_field_ids = [];
            foreach ($all_encrypted_fields as $field_key) {
                if (strpos($field_key, $form['id'] . '_') === 0) {
                    $field_id = str_replace($form['id'] . '_', '', $field_key);
                    $encrypted_field_ids[] = $field_id;
                }
            }
            
            foreach ($form['fields'] as &$field) {
                if (in_array($field->id, $encrypted_field_ids)) {
                    $field->failed_validation = true;
                    $field->validation_message = __('This field could not be encrypted. Please try again.', 'pqls');
                }
            }
        }
        
        return $validation_result;
    }
    
    /**
     * Enhanced frontend script enqueuing with post-quantum support
     */
    public function enqueue_frontend_scripts() {
        if (!$this->is_gravity_forms_page()) {
            return;
        }
        
        wp_enqueue_script('pqls-frontend', PQLS_PLUGIN_URL . 'assets/frontend.js', array('jquery'), PQLS_VERSION, true);
        
        // Localize script with enhanced data
        $algorithm = get_option('pqls_algorithm', 'rsa-oaep-256');
        $security_level = get_option('pqls_security_level', 'standard');
        $is_post_quantum = !$this->is_rsa_algorithm($algorithm);
        
        wp_localize_script('pqls-frontend', 'pqls_frontend', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('pqls_frontend_nonce'),
            'algorithm' => $algorithm,
            'security_level' => $security_level,
            'is_post_quantum' => $is_post_quantum,
            'encryption_text' => $is_post_quantum ? 
                __('QUANTUM-SAFE ENCRYPTED', 'pqls') : 
                __('ENCRYPTED', 'pqls'),
            'strings' => array(
                'encrypting' => __('Encrypting...', 'pqls'),
                'encrypted' => $is_post_quantum ? 
                    __('Quantum-Safe Encrypted', 'pqls') : 
                    __('Encrypted', 'pqls'),
                'encryption_info' => $is_post_quantum ?
                    __('This field is protected with post-quantum cryptography', 'pqls') :
                    __('This field is encrypted', 'pqls'),
                'algorithm_name' => $is_post_quantum ?
                    ($security_level === 'high' ? 'ML-KEM-1024' : 'ML-KEM-768') :
                    'RSA-OAEP-256'
            )
        ));
        
        wp_enqueue_style('pqls-frontend', PQLS_PLUGIN_URL . 'assets/frontend.css', array(), PQLS_VERSION);
    }
    
    /**
     * Check if current page has Gravity Forms
     */
    private function is_gravity_forms_page() {
        global $post;
        
        if (!$post) {
            return false;
        }
        
        // Check if page contains gravity forms shortcode
        if (has_shortcode($post->post_content, 'gravityform')) {
            return true;
        }
        
        // Check if any gravity forms are embedded
        if (class_exists('GFForms')) {
            $forms = \GFAPI::get_forms();
            foreach ($forms as $form) {
                if (has_shortcode($post->post_content, 'gravityform')) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Execute automated migration process with rollback capability
     */
    public function ajax_execute_migration() {
        check_ajax_referer('pqls_nonce', 'nonce');
        
        if (!current_user_can('manage_pqls')) {
            wp_die(__('Insufficient permissions', 'pqls'));
        }
        
        try {
            $security_level = sanitize_text_field($_POST['security_level'] ?? 'standard');
            $batch_size = intval($_POST['batch_size'] ?? 100);
            $verify_integrity = filter_var($_POST['verify_integrity'] ?? true, FILTER_VALIDATE_BOOLEAN);
            
            $this->log_audit_event('migration_started', [
                'security_level' => $security_level,
                'batch_size' => $batch_size,
                'verify_integrity' => $verify_integrity,
                'user_id' => get_current_user_id()
            ]);
            
            // Set migration status
            update_option('pqls_migration_status', 'in_progress');
            update_option('pqls_migration_start_time', current_time('mysql'));
            
            // Create migration checkpoint for rollback
            $checkpoint = $this->create_migration_checkpoint();
            
            if (!$checkpoint) {
                throw new Exception('Failed to create migration checkpoint');
            }
            
            // Generate new post-quantum keys
            $new_keys = $this->generate_post_quantum_keys($security_level);
            
            if (!$new_keys) {
                throw new Exception('Failed to generate post-quantum keys');
            }
            
            // Migrate encrypted data
            $migration_result = $this->migrate_encrypted_data($new_keys, $batch_size, $verify_integrity);
            
            if (!$migration_result['success']) {
                throw new Exception('Data migration failed: ' . $migration_result['error']);
            }
            
            // Update system configuration
            $this->finalize_migration($new_keys, $security_level);
            
            $this->log_audit_event('migration_completed', [
                'security_level' => $security_level,
                'migrated_entries' => $migration_result['migrated_count'],
                'duration_seconds' => time() - strtotime(get_option('pqls_migration_start_time')),
                'integrity_verified' => $verify_integrity
            ]);
            
            wp_send_json_success([
                'message' => __('Migration completed successfully', 'pqls'),
                'migrated_count' => $migration_result['migrated_count'],
                'algorithm' => $new_keys['algorithm'],
                'security_level' => $security_level
            ]);
            
        } catch (Exception $e) {
            $this->log_audit_event('migration_failed', [
                'error' => $e->getMessage(),
                'user_id' => get_current_user_id()
            ]);
            
            // Attempt rollback
            $this->rollback_migration();
            
            wp_send_json_error(__('Migration failed: ', 'pqls') . $e->getMessage());
        }
    }
    
    /**
     * Rollback migration to previous state
     */
    public function ajax_rollback_migration() {
        check_ajax_referer('pqls_nonce', 'nonce');
        
        if (!current_user_can('manage_pqls')) {
            wp_die(__('Insufficient permissions', 'pqls'));
        }
        
        try {
            $rollback_result = $this->rollback_migration();
            
            if ($rollback_result) {
                $this->log_audit_event('migration_rollback_success', [
                    'user_id' => get_current_user_id()
                ]);
                
                wp_send_json_success(__('Migration rollback completed successfully', 'pqls'));
            } else {
                throw new Exception('Rollback process failed');
            }
            
        } catch (Exception $e) {
            $this->log_audit_event('migration_rollback_failed', [
                'error' => $e->getMessage(),
                'user_id' => get_current_user_id()
            ]);
            
            wp_send_json_error(__('Rollback failed: ', 'pqls') . $e->getMessage());
        }
    }
    
    /**
     * Verify data integrity for migrated encrypted fields
     */
    public function ajax_verify_data_integrity() {
        check_ajax_referer('pqls_nonce', 'nonce');
        
        if (!current_user_can('manage_pqls')) {
            wp_die(__('Insufficient permissions', 'pqls'));
        }
        
        try {
            $verification_result = $this->verify_data_integrity();
            
            $this->log_audit_event('data_integrity_check', [
                'total_entries' => $verification_result['total_entries'],
                'verified_entries' => $verification_result['verified_entries'],
                'failed_entries' => $verification_result['failed_entries'],
                'success_rate' => $verification_result['success_rate'],
                'user_id' => get_current_user_id()
            ]);
            
            wp_send_json_success($verification_result);
            
        } catch (Exception $e) {
            $this->log_audit_event('data_integrity_check_failed', [
                'error' => $e->getMessage(),
                'user_id' => get_current_user_id()
            ]);
            
            wp_send_json_error(__('Data integrity verification failed: ', 'pqls') . $e->getMessage());
        }
    }
    
    /**
     * Get migration audit log
     */
    public function ajax_get_migration_log() {
        check_ajax_referer('pqls_nonce', 'nonce');
        
        if (!current_user_can('manage_pqls')) {
            wp_die(__('Insufficient permissions', 'pqls'));
        }
        
        $limit = intval($_POST['limit'] ?? 50);
        $offset = intval($_POST['offset'] ?? 0);
        $event_type = sanitize_text_field($_POST['event_type'] ?? '');
        
        $log_entries = $this->get_audit_log($limit, $offset, $event_type);
        
        wp_send_json_success([
            'entries' => $log_entries,
            'total_count' => $this->get_audit_log_count($event_type)
        ]);
    }
    
    /**
     * Create migration checkpoint for rollback capability
     */
    private function create_migration_checkpoint() {
        try {
            $checkpoint = [
                'timestamp' => current_time('mysql'),
                'public_key' => get_option('pqls_public_key'),
                'private_key' => get_option('pqls_private_key'),
                'algorithm' => get_option('pqls_algorithm'),
                'security_level' => get_option('pqls_security_level'),
                'migration_status' => get_option('pqls_migration_status'),
                'encrypted_entries_count' => $this->count_encrypted_entries()
            ];
            
            update_option('pqls_migration_checkpoint', $checkpoint);
            
            $this->log_audit_event('checkpoint_created', [
                'encrypted_entries_count' => $checkpoint['encrypted_entries_count']
            ]);
            
            return true;
            
        } catch (Exception $e) {
            error_log('PQLS: Failed to create migration checkpoint: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Generate new post-quantum keys
     */
    private function generate_post_quantum_keys($security_level) {
        $settings = get_option($this->option_name, array());
        $microservice_url = $settings['microservice_url'] ?? PQLS_MICROSERVICE_URL;
        
        $response = wp_remote_get($microservice_url . '/generate-keypair?securityLevel=' . urlencode($security_level), [
            'timeout' => 30
        ]);
        
        if (is_wp_error($response)) {
            throw new Exception('Failed to generate keypair: ' . $response->get_error_message());
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($status_code !== 200) {
            throw new Exception('Generate keypair failed with status ' . $status_code . ': ' . $body);
        }
        
        $data = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid JSON response: ' . json_last_error_msg());
        }
        
        if (!isset($data['publicKey']) || !isset($data['privateKey'])) {
            throw new Exception('Response missing required keys');
        }
        
        return $data;
    }
    
    /**
     * Migrate encrypted data to new post-quantum format
     */
    private function migrate_encrypted_data($new_keys, $batch_size, $verify_integrity) {
        global $wpdb;
        
        $migrated_count = 0;
        $failed_count = 0;
        $total_processed = 0;
        
        try {
            // Get all Gravity Forms entries with encrypted data
            $entries = $this->get_encrypted_entries($batch_size);
            
            foreach ($entries as $entry) {
                $total_processed++;
                
                try {
                    // Decrypt with old keys
                    $decrypted_data = $this->decrypt_entry_data($entry);
                    
                    if ($decrypted_data === false) {
                        $failed_count++;
                        continue;
                    }
                    
                    // Re-encrypt with new post-quantum keys
                    $encrypted_data = $this->encrypt_with_new_keys($decrypted_data, $new_keys);
                    
                    if ($encrypted_data === false) {
                        $failed_count++;
                        continue;
                    }
                    
                    // Update entry in database
                    $update_result = $this->update_entry_encryption($entry['id'], $encrypted_data);
                    
                    if ($update_result) {
                        $migrated_count++;
                        
                        // Verify integrity if requested
                        if ($verify_integrity) {
                            $verification_result = $this->verify_entry_integrity($entry['id'], $decrypted_data, $new_keys);
                            if (!$verification_result) {
                                $this->log_audit_event('integrity_verification_failed', [
                                    'entry_id' => $entry['id']
                                ]);
                            }
                        }
                    } else {
                        $failed_count++;
                    }
                    
                    // Log progress every 10 entries
                    if ($total_processed % 10 === 0) {
                        $this->log_audit_event('migration_progress', [
                            'processed' => $total_processed,
                            'migrated' => $migrated_count,
                            'failed' => $failed_count
                        ]);
                    }
                    
                } catch (Exception $e) {
                    $failed_count++;
                    $this->log_audit_event('entry_migration_failed', [
                        'entry_id' => $entry['id'],
                        'error' => $e->getMessage()
                    ]);
                }
            }
            
            return [
                'success' => $failed_count === 0,
                'migrated_count' => $migrated_count,
                'failed_count' => $failed_count,
                'total_processed' => $total_processed,
                'error' => $failed_count > 0 ? "Failed to migrate {$failed_count} entries" : null
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'migrated_count' => $migrated_count,
                'failed_count' => $failed_count,
                'total_processed' => $total_processed,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Finalize migration by updating system configuration
     */
    private function finalize_migration($new_keys, $security_level) {
        // Backup old keys
        update_option('pqls_rsa_public_key_backup', get_option('pqls_public_key'));
        update_option('pqls_rsa_private_key_backup', get_option('pqls_private_key'));
        update_option('pqls_rsa_algorithm_backup', get_option('pqls_algorithm'));
        
        // Update to new keys
        update_option('pqls_public_key', $new_keys['publicKey']);
        update_option('pqls_private_key', $new_keys['privateKey']);
        update_option('pqls_algorithm', $new_keys['algorithm']);
        update_option('pqls_security_level', $security_level);
        update_option('pqls_key_generated', current_time('mysql'));
        update_option('pqls_migration_status', 'completed');
        update_option('pqls_migration_completed_time', current_time('mysql'));
    }
    
    /**
     * Rollback migration to previous state
     */
    private function rollback_migration() {
        try {
            $checkpoint = get_option('pqls_migration_checkpoint');
            
            if (!$checkpoint) {
                throw new Exception('No migration checkpoint found');
            }
            
            // Restore previous keys and settings
            update_option('pqls_public_key', $checkpoint['public_key']);
            update_option('pqls_private_key', $checkpoint['private_key']);
            update_option('pqls_algorithm', $checkpoint['algorithm']);
            update_option('pqls_security_level', $checkpoint['security_level']);
            update_option('pqls_migration_status', $checkpoint['migration_status']);
            
            // Remove backup keys
            delete_option('pqls_rsa_public_key_backup');
            delete_option('pqls_rsa_private_key_backup');
            delete_option('pqls_rsa_algorithm_backup');
            
            // Clean up migration data
            delete_option('pqls_migration_start_time');
            delete_option('pqls_migration_completed_time');
            delete_option('pqls_migration_checkpoint');
            
            return true;
            
        } catch (Exception $e) {
            error_log('PQLS: Migration rollback failed: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Verify data integrity for migrated entries
     */
    private function verify_data_integrity() {
        $entries = $this->get_encrypted_entries(1000); // Check up to 1000 entries
        $total_entries = count($entries);
        $verified_entries = 0;
        $failed_entries = 0;
        
        foreach ($entries as $entry) {
            try {
                $decrypted_data = $this->decrypt_entry_data($entry);
                
                if ($decrypted_data !== false) {
                    $verified_entries++;
                } else {
                    $failed_entries++;
                }
                
            } catch (Exception $e) {
                $failed_entries++;
            }
        }
        
        $success_rate = $total_entries > 0 ? ($verified_entries / $total_entries) * 100 : 100;
        
        return [
            'total_entries' => $total_entries,
            'verified_entries' => $verified_entries,
            'failed_entries' => $failed_entries,
            'success_rate' => round($success_rate, 2),
            'status' => $success_rate >= 95 ? 'excellent' : ($success_rate >= 90 ? 'good' : 'poor')
        ];
    }
    
    /**
     * Log audit event for cryptographic operations
     */
    private function log_audit_event($event_type, $data = []) {
        $log_entry = [
            'timestamp' => current_time('mysql'),
            'event_type' => $event_type,
            'user_id' => get_current_user_id(),
            'user_login' => wp_get_current_user()->user_login ?? 'system',
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            'data' => $data
        ];
        
        // Get existing log
        $audit_log = get_option('pqls_audit_log', []);
        
        // Add new entry
        array_unshift($audit_log, $log_entry);
        
        // Keep only last 1000 entries
        $audit_log = array_slice($audit_log, 0, 1000);
        
        // Save log
        update_option('pqls_audit_log', $audit_log);
        
        // Also log to WordPress error log for critical events
        if (in_array($event_type, ['migration_failed', 'rollback_failed', 'data_integrity_check_failed'])) {
            error_log('PQLS AUDIT: ' . $event_type . ' - ' . json_encode($data));
        }
    }
    
    /**
     * Get audit log entries
     */
    private function get_audit_log($limit = 50, $offset = 0, $event_type = '') {
        $audit_log = get_option('pqls_audit_log', []);
        
        // Filter by event type if specified
        if (!empty($event_type)) {
            $audit_log = array_filter($audit_log, function($entry) use ($event_type) {
                return $entry['event_type'] === $event_type;
            });
        }
        
        // Apply pagination
        return array_slice($audit_log, $offset, $limit);
    }
    
    /**
     * Get audit log count
     */
    private function get_audit_log_count($event_type = '') {
        $audit_log = get_option('pqls_audit_log', []);
        
        if (!empty($event_type)) {
            $audit_log = array_filter($audit_log, function($entry) use ($event_type) {
                return $entry['event_type'] === $event_type;
            });
        }
        
        return count($audit_log);
    }
    
    /**
     * Get encrypted entries from database
     */
    private function get_encrypted_entries($limit = 100) {
        global $wpdb;
        
        // Get all Gravity Forms entries that contain encrypted data
        $table_name = $wpdb->prefix . 'gf_entry_meta';
        
        $query = $wpdb->prepare("
            SELECT DISTINCT entry_id, meta_value 
            FROM {$table_name} 
            WHERE meta_value LIKE %s 
            OR meta_value LIKE %s
            OR meta_value LIKE %s
            OR meta_value LIKE %s
            LIMIT %d
        ", 'pqls_encrypted::%', 'pqls_pq_encrypted::%', 'pqls_rsa_encrypted::%', '%\"version\":\"2.0\"%', $limit);
        
        $results = $wpdb->get_results($query, ARRAY_A);
        
        return array_map(function($row) {
            return [
                'id' => $row['entry_id'],
                'encrypted_data' => $row['meta_value']
            ];
        }, $results);
    }
    
    /**
     * Count total encrypted entries
     */
    private function count_encrypted_entries() {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'gf_entry_meta';
        
        $query = $wpdb->prepare("
            SELECT COUNT(DISTINCT entry_id) 
            FROM {$table_name} 
            WHERE meta_value LIKE %s 
            OR meta_value LIKE %s
            OR meta_value LIKE %s
            OR meta_value LIKE %s
        ", 'pqls_encrypted::%', 'pqls_pq_encrypted::%', 'pqls_rsa_encrypted::%', '%\"version\":\"2.0\"%');
        
        return intval($wpdb->get_var($query));
    }
    
    /**
     * Decrypt entry data using current keys
     */
    private function decrypt_entry_data($entry) {
        try {
            $encrypted_data = $entry['encrypted_data'];
            
            // The decrypt_data method now handles both old and new formats with site isolation
            // No need to remove prefixes here as decrypt_data handles format detection
            $decrypted = $this->decrypt_data($encrypted_data);
            
            return $decrypted;
            
        } catch (Exception $e) {
            error_log('PQLS: Failed to decrypt entry ' . $entry['id'] . ': ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Encrypt data with new post-quantum keys
     */
    private function encrypt_with_new_keys($data, $new_keys) {
        try {
            $settings = get_option($this->option_name, array());
            $microservice_url = $settings['microservice_url'] ?? PQLS_MICROSERVICE_URL;
            
            $response = wp_remote_post($microservice_url . '/encrypt', [
                'timeout' => 30,
                'body' => json_encode([
                    'data' => $data,
                    'publicKey' => $new_keys['publicKey'],
                    'algorithm' => $new_keys['algorithm']
                ]),
                'headers' => [
                    'Content-Type' => 'application/json'
                ]
            ]);
            
            if (is_wp_error($response)) {
                throw new Exception('Encryption request failed: ' . $response->get_error_message());
            }
            
            $status_code = wp_remote_retrieve_response_code($response);
            $body = wp_remote_retrieve_body($response);
            
            if ($status_code !== 200) {
                throw new Exception('Encryption failed with status ' . $status_code . ': ' . $body);
            }
            
            $result = json_decode($body, true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new Exception('Invalid JSON response: ' . json_last_error_msg());
            }
            
            return $result['encryptedData'] ?? false;
            
        } catch (Exception $e) {
            error_log('PQLS: Failed to encrypt with new keys: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Update entry encryption in database
     */
    private function update_entry_encryption($entry_id, $encrypted_data) {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'gf_entry_meta';
        
        $result = $wpdb->update(
            $table_name,
            ['meta_value' => 'pqls_encrypted::' . json_encode($encrypted_data)],
            ['entry_id' => $entry_id],
            ['%s'],
            ['%d']
        );
        
        return $result !== false;
    }
    
    /**
     * Verify entry integrity after migration
     */
    private function verify_entry_integrity($entry_id, $original_data, $new_keys) {
        try {
            // Get the newly encrypted data
            global $wpdb;
            $table_name = $wpdb->prefix . 'gf_entry_meta';
            
            $encrypted_data = $wpdb->get_var($wpdb->prepare("
                SELECT meta_value 
                FROM {$table_name} 
                WHERE entry_id = %d 
                AND meta_value LIKE %s
                LIMIT 1
            ", $entry_id, 'pqls_encrypted::%'));
            
            if (!$encrypted_data) {
                return false;
            }
            
            // Decrypt and compare
            $decrypted_data = $this->decrypt_data(substr($encrypted_data, 16));
            
            return $decrypted_data === $original_data;
            
        } catch (Exception $e) {
            error_log('PQLS: Integrity verification failed for entry ' . $entry_id . ': ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Render migration statistics
     */
    private function render_migration_statistics() {
        $migration_start = get_option('pqls_migration_start_time');
        $migration_completed = get_option('pqls_migration_completed_time');
        $encrypted_entries_count = $this->count_encrypted_entries();
        $audit_log = get_option('pqls_audit_log', []);
        
        // Calculate migration duration
        $duration = 'Unknown';
        if ($migration_start && $migration_completed) {
            $start_time = strtotime($migration_start);
            $end_time = strtotime($migration_completed);
            $duration_seconds = $end_time - $start_time;
            $duration = gmdate('H:i:s', $duration_seconds);
        }
        
        // Get migration-related log entries
        $migration_entries = array_filter($audit_log, function($entry) {
            return strpos($entry['event_type'], 'migration') !== false;
        });
        
        $migration_completed_entry = array_filter($migration_entries, function($entry) {
            return $entry['event_type'] === 'migration_completed';
        });
        
        $migrated_count = 0;
        if (!empty($migration_completed_entry)) {
            $completed_entry = array_values($migration_completed_entry)[0];
            $migrated_count = $completed_entry['data']['migrated_entries'] ?? 0;
        }
        
        ?>
        <table class="form-table">
            <tr>
                <th scope="row"><?php _e('Migration Started', 'pqls'); ?></th>
                <td><?php echo $migration_start ? esc_html($migration_start) : __('Unknown', 'pqls'); ?></td>
            </tr>
            <tr>
                <th scope="row"><?php _e('Migration Completed', 'pqls'); ?></th>
                <td><?php echo $migration_completed ? esc_html($migration_completed) : __('Unknown', 'pqls'); ?></td>
            </tr>
            <tr>
                <th scope="row"><?php _e('Duration', 'pqls'); ?></th>
                <td><?php echo esc_html($duration); ?></td>
            </tr>
            <tr>
                <th scope="row"><?php _e('Entries Migrated', 'pqls'); ?></th>
                <td><?php echo esc_html($migrated_count); ?></td>
            </tr>
            <tr>
                <th scope="row"><?php _e('Current Encrypted Entries', 'pqls'); ?></th>
                <td><?php echo esc_html($encrypted_entries_count); ?></td>
            </tr>
            <tr>
                <th scope="row"><?php _e('Algorithm', 'pqls'); ?></th>
                <td><?php echo esc_html(get_option('pqls_algorithm', 'Unknown')); ?></td>
            </tr>
            <tr>
                <th scope="row"><?php _e('Security Level', 'pqls'); ?></th>
                <td><?php echo esc_html(ucfirst(get_option('pqls_security_level', 'standard'))); ?></td>
            </tr>
        </table>
        <?php
    }
}

// Instantiate the plugin
new PostQuantumLatticeShield(); 