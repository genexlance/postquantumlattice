<?php
/**
 * Plugin Name: Post Quantum Lattice Shield
 * Plugin URI: https://github.com/your-username/post-quantum-lattice-shield
 * Description: Secure form data encryption using post-quantum ML-KEM-512 cryptography. Integrates with Gravity Forms to encrypt sensitive field data.
 * Version: 1.0.0
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
        // Generate initial key pair
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
     * Generate ML-KEM keypair
     */
    private function generate_keypair() {
        // For WordPress, we'll generate the keypair by calling our microservice
        $settings = get_option($this->option_name, array());
        $microservice_url = $settings['microservice_url'] ?? PQLS_MICROSERVICE_URL;
        
        $headers = array(
            'Content-Type' => 'application/json',
        );
        
        $response = wp_remote_get($microservice_url . '/generate-keypair', array(
            'timeout' => 30,
            'headers' => $headers
        ));
        
        if (is_wp_error($response)) {
            error_log('PQLS: Failed to generate keypair - ' . $response->get_error_message());
            return false;
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($status_code !== 200) {
            error_log('PQLS: Generate keypair failed with status ' . $status_code . ': ' . $body);
            return false;
        }
        
        $data = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log('PQLS: Invalid JSON response: ' . json_last_error_msg());
            return false;
        }
        
        if (isset($data['publicKey']) && isset($data['privateKey'])) {
            update_option('pqls_public_key', $data['publicKey']);
            update_option('pqls_private_key', $data['privateKey']);
            update_option('pqls_algorithm', $data['algorithm']);
            update_option('pqls_key_generated', current_time('mysql'));
            return true;
        }
        
        error_log('PQLS: Response missing required keys: ' . print_r($data, true));
        return false;
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_options_page(
            __('Post Quantum Lattice Shield Settings', 'pqls'),
            __('PQ Lattice Shield', 'pqls'),
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
                'copied' => __('Copied to clipboard', 'pqls')
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
        $algorithm = get_option('pqls_algorithm', 'ml-kem-512');
        $key_generated = get_option('pqls_key_generated');
        
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            
            <form method="post" action="options.php">
                <?php
                settings_fields('pqls_settings');
                do_settings_sections('pqls_settings');
                ?>

                <table class="form-table">
                    <tr valign="top">
                        <th scope="row"><?php _e('Microservice URL', 'pqls'); ?></th>
                        <td>
                            <input type="text" name="<?php echo $this->option_name; ?>[microservice_url]" value="<?php echo esc_attr($settings['microservice_url'] ?? PQLS_MICROSERVICE_URL); ?>" class="regular-text" />
                            <p class="description"><?php _e('The URL of your post-quantum encryption microservice.', 'pqls'); ?></p>
                        </td>
                    </tr>
                    <tr valign="top">
                        <th scope="row"><?php _e('API Key', 'pqls'); ?></th>
                        <td>
                            <input type="password" name="pqls_api_key" value="<?php echo esc_attr(get_option('pqls_api_key')); ?>" class="regular-text" />
                            <p class="description"><?php _e('Your API key for the microservice.', 'pqls'); ?></p>
                        </td>
                    </tr>
                </table>
                
                <h2><?php _e('Keypair Information', 'pqls'); ?></h2>
                <table class="form-table">
                    <tr valign="top">
                        <th scope="row"><?php _e('Algorithm', 'pqls'); ?></th>
                        <td><code><?php echo esc_html($algorithm); ?></code></td>
                    </tr>
                    <tr valign="top">
                        <th scope="row"><?php _e('Public Key', 'pqls'); ?></th>
                        <td>
                            <textarea readonly class="widefat" rows="5"><?php echo esc_textarea($public_key); ?></textarea>
                        </td>
                    </tr>
                    <tr valign="top">
                        <th scope="row"><?php _e('Key Generated', 'pqls'); ?></th>
                        <td><?php echo esc_html($key_generated ? date_i18n(get_option('date_format') . ' @ ' . get_option('time_format'), strtotime($key_generated)) : __('Never', 'pqls')); ?></td>
                    </tr>
                </table>

                <p>
                    <button type="button" id="pqls-regenerate-keys" class="button"><?php _e('Regenerate Keys', 'pqls'); ?></button>
                    <button type="button" id="pqls-test-connection" class="button"><?php _e('Test Connection', 'pqls'); ?></button>
                    <button type="button" id="pqls-test-decrypt" class="button-primary"><?php _e('Test Decrypt', 'pqls'); ?></button>
                </p>

                <div id="pqls-test-results" style="display:none; border: 1px solid #ccc; padding: 10px; margin-top: 20px;"></div>

                <h2><?php _e('Encrypted Fields', 'pqls'); ?></h2>
                <p><?php _e('Configure which Gravity Form fields should be encrypted. Go to your form settings to enable encryption for specific fields.', 'pqls'); ?></p>
                <?php $this->render_encrypted_fields_settings($settings); ?>

                <?php submit_button(); ?>
            </form>
            
            <div class="pqls-debug-info">
                <h2><?php _e('Debug Information', 'pqls'); ?></h2>
                <ul>
                    <li><strong>API Key Set:</strong> <?php echo !empty(get_option('pqls_api_key')) ? 'Yes' : 'No'; ?></li>
                    <li><strong>Private Key Set:</strong> <?php echo !empty(get_option('pqls_private_key')) ? 'Yes' : 'No'; ?></li>
                    <li><strong>Microservice URL:</strong> <?php echo esc_url($settings['microservice_url'] ?? PQLS_MICROSERVICE_URL); ?></li>
                    <li><strong>User can decrypt:</strong> <?php echo current_user_can('decrypt_pqls_data') ? 'Yes' : 'No'; ?></li>
                </ul>
            </div>
        </div>
        <?php
    }
    
    /**
     * Render encrypted fields settings
     */
    private function render_encrypted_fields_settings($settings) {
        $forms = class_exists('GFAPI') ? GFAPI::get_forms() : [];
        
        if (empty($forms)) {
            echo '<p>' . __('No forms found.', 'pqls') . '</p>';
            return;
        }
        
        echo '<table class="wp-list-table widefat fixed striped">';
        echo '<thead><tr><th>' . __('Form', 'pqls') . '</th><th>' . __('Encrypted Fields', 'pqls') . '</th></tr></thead>';
        echo '<tbody>';
        
        foreach ($forms as $form) {
            $encrypted_form_fields = isset($settings['encrypted_fields'][$form['id']]) ? $settings['encrypted_fields'][$form['id']] : [];
            echo '<tr>';
            echo '<td>' . esc_html($form['title']) . '</td>';
            echo '<td>';
            if (empty($encrypted_form_fields)) {
                echo '<em>' . __('None', 'pqls') . '</em>';
            } else {
                echo '<ul>';
                foreach ($encrypted_form_fields as $field_id) {
                    echo '<li>' . esc_html('Field ID: ' . $field_id) . '</li>';
                }
                echo '</ul>';
            }
            echo '</td>';
            echo '</tr>';
        }
        
        echo '</tbody></table>';
    }
    
    /**
     * Encrypt form data before submission
     */
    public function pre_submission_encrypt($form) {
        $settings = get_option($this->option_name, array());
        $encrypted_fields = $settings['encrypted_fields'][$form['id']] ?? [];
        
        if (empty($encrypted_fields)) {
            return $form;
        }
        
        $public_key = get_option('pqls_public_key');
        
        if (empty($public_key)) {
            error_log('PQLS: Public key not set, cannot encrypt.');
            return $form;
        }
        
        foreach ($_POST as $key => $value) {
            if (strpos($key, 'input_') === 0) {
                $field_id = str_replace('input_', '', $key);
                if (in_array($field_id, $encrypted_fields)) {
                    $_POST[$key] = $this->encrypt_data($value, $public_key);
                }
            }
        }
        
        return $form;
    }
    
    /**
     * Encrypt data using microservice
     */
    private function encrypt_data($data, $public_key) {
        $settings = get_option($this->option_name, array());
        $microservice_url = $settings['microservice_url'] ?? PQLS_MICROSERVICE_URL;
        
        $headers = array('Content-Type' => 'application/json');
        $body = array(
            'data' => $data,
            'publicKey' => $public_key
        );
        
        $response = wp_remote_post($microservice_url . '/encrypt', array(
            'headers' => $headers,
            'body' => json_encode($body),
            'timeout' => 30
        ));
        
        if (is_wp_error($response)) {
            error_log('PQLS: Encryption failed - ' . $response->get_error_message());
            return $data; // Return original data on failure
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);
        
        if ($status_code !== 200) {
            error_log('PQLS: Encryption failed with status ' . $status_code . ': ' . $response_body);
            return $data;
        }
        
        $response_data = json_decode($response_body, true);
        
        return $response_data['encryptedData'] ?? $data;
    }
    
    /**
     * Decrypt data using microservice
     */
    private function decrypt_data($encrypted_data) {
        $settings = get_option($this->option_name, array());
        $microservice_url = $settings['microservice_url'] ?? PQLS_MICROSERVICE_URL;
        $api_key = get_option('pqls_api_key', '');

        // Extensive logging for debugging
        error_log('PQLS Decrypt: Preparing to send request to ' . $microservice_url . '/decrypt');
        error_log('PQLS Decrypt: API Key length: ' . strlen($api_key));
        error_log('PQLS Decrypt: API Key (first 8 chars): ' . substr($api_key, 0, 8));

        $headers = array(
            'Content-Type'  => 'application/json',
            'Authorization' => 'Bearer ' . $api_key,
        );
        
        // Log the headers (excluding the full key for security)
        $loggable_headers = $headers;
        if (!empty($api_key)) {
            $loggable_headers['Authorization'] = 'Bearer ' . substr($api_key, 0, 8) . '...';
        }
        error_log('PQLS Decrypt: Request headers: ' . print_r($loggable_headers, true));

        $body = array(
            'encryptedData' => $encrypted_data,
            'privateKey'    => get_option('pqls_private_key'),
            'algorithm'     => get_option('pqls_algorithm', 'ml-kem-512')
        );
        
        $response = wp_remote_post($microservice_url . '/decrypt', array(
            'headers' => $headers,
            'body'    => json_encode($body),
            'timeout' => 30
        ));
        
        if (is_wp_error($response)) {
            error_log('PQLS Decrypt: WP_Error - ' . $response->get_error_message());
            return false;
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);
        
        if ($status_code !== 200) {
            error_log('PQLS Decrypt: Failed with status ' . $status_code . ': ' . $response_body);
            return false;
        }
        
        $data = json_decode($response_body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log('PQLS Decrypt: Invalid JSON response: ' . json_last_error_msg());
            return false;
        }
        
        return $data['decryptedData'] ?? false;
    }
    
    /**
     * AJAX handler for decrypting a field
     */
    public function ajax_decrypt_field() {
        check_ajax_referer('pqls_nonce', 'nonce');
        
        if (!current_user_can('decrypt_pqls_data')) {
            wp_send_json_error('Permission denied');
        }
        
        $encrypted_data = sanitize_text_field($_POST['data']);
        $decrypted_data = $this->decrypt_data($encrypted_data);
        
        if ($decrypted_data === false) {
            wp_send_json_error('Decryption failed');
        } else {
            // Log the decryption event for audit purposes
            error_log(sprintf('PQLS Audit: User %d decrypted data.', get_current_user_id()));
            wp_send_json_success($decrypted_data);
        }
    }
    
    /**
     * AJAX handler for exporting CSV
     */
    public function ajax_export_csv() {
        check_ajax_referer('pqls_nonce', 'nonce');

        if (!current_user_can('decrypt_pqls_data')) {
            wp_send_json_error('Permission denied');
        }

        $form_id = absint($_POST['form_id']);
        $export_type = sanitize_text_field($_POST['export_type']); // 'decrypt' or 'redact'
        $search_criteria = isset($_POST['search_criteria']) ? json_decode(stripslashes($_POST['search_criteria']), true) : [];
        $sorting = isset($_POST['sorting']) ? json_decode(stripslashes($_POST['sorting']), true) : [];

        $form = GFAPI::get_form($form_id);
        $entries = GFAPI::get_entries($form_id, $search_criteria, $sorting);

        $csv_data = $this->generate_csv_data($form, $entries, $export_type);

        if ($csv_data === false) {
            wp_send_json_error('Failed to generate CSV data.');
        } else {
            // Log the export event
            error_log(sprintf('PQLS Audit: User %d exported CSV for form %d with type "%s"', get_current_user_id(), $form_id, $export_type));
            wp_send_json_success(['csv_data' => $csv_data]);
        }
    }

    /**
     * Generate CSV data from entries
     */
    private function generate_csv_data($form, $entries, $export_type) {
        if (empty($entries)) return '';

        $csv = '';
        $headers = [];
        foreach ($form['fields'] as $field) {
            if ($field->type !== 'section') {
                $headers[] = $field->label;
            }
        }
        $csv .= '"' . implode('","', $headers) . '"' . "\n";

        foreach ($entries as $entry) {
            $row = [];
            foreach ($form['fields'] as $field) {
                if ($field->type !== 'section') {
                    $value = rgar($entry, (string) $field->id);
                    $field_id = is_object($field) ? $field->id : $field;

                    if ($value !== null && strpos($value, 'pqls_encrypted::') === 0) {
                        if ($export_type === 'decrypt') {
                            $decrypted_value = $this->decrypt_data($value);
                            $row[] = $decrypted_value !== false ? $decrypted_value : '[DECRYPTION FAILED]';
                        } else {
                            $row[] = '[REDACTED]';
                        }
                    } else {
                        $row[] = $value;
                    }
                }
            }
            $csv .= '"' . implode('","', $row) . '"' . "\n";
        }

        return $csv;
    }
    
    /**
     * AJAX handler for regenerating keys
     */
    public function ajax_regenerate_keys() {
        check_ajax_referer('pqls_nonce', 'nonce');
        
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
    
        $test_string = "This is a test string for encryption and decryption.";
        $public_key = get_option('pqls_public_key');
    
        if (empty($public_key)) {
            wp_send_json_error('Public key not found.');
        }
    
        // Encrypt
        $encrypted = $this->encrypt_data($test_string, $public_key);
        if ($encrypted === $test_string) {
            wp_send_json_error('Encryption failed. The data was not changed.');
        }
    
        // Decrypt
        $decrypted = $this->decrypt_data($encrypted);
    
        if ($decrypted === $test_string) {
            wp_send_json_success("Test successful! The decrypted string matches the original.");
        } else {
            wp_send_json_error("Decryption test failed. The decrypted data does not match the original. Decrypted data: " . print_r($decrypted, true));
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
        
        if ($value !== null && strpos($value, 'pqls_encrypted::') === 0) {
            if (current_user_can('decrypt_pqls_data')) {
                $html = '<span class="pqls-encrypted-badge">💫🔒💫</span>';
                $html .= '<div class="pqls-encrypted-data" data-encrypted="' . esc_attr($value) . '">';
                $html .= '<span class="pqls-redacted-view">[REDACTED]</span>';
                $html .= '<span class="pqls-decrypted-view" style="display:none;"></span>';
                $html .= '</div>';
                $html .= '<div class="pqls-actions">';
                $html .= '<a href="#" class="button button-small pqls-decrypt-button">' . __('Decrypt', 'pqls') . '</a>';
                $html .= '<a href="#" class="button button-small pqls-hide-button" style="display:none;">' . __('Hide', 'pqls') . '</a>';
                $html .= '</div>';
                $html .= '<div class="pqls-security-warning" style="display:none;color:red;font-size:12px;margin-top:5px;">' . __('Warning: This data is now visible. Be cautious where you display it.', 'pqls') . '</div>';
                return $html;
            } else {
                return '<span class="pqls-encrypted-badge">💫🔒💫</span> [REDACTED]';
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
            if (is_numeric($key) && strpos($value, 'pqls_encrypted::') === 0) {
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
        if (strpos($hook, 'gf_entries') === false) {
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
                var security_warning = container.find('.pqls-security-warning');
                var hide_button = container.find('.pqls-hide-button');
                
                button.text(pqls_ajax.strings.decrypting);

                jQuery.post(pqls_ajax.ajax_url, {
                    action: 'pqls_decrypt_field',
                    nonce: pqls_ajax.nonce,
                    data: encrypted_data
                }, function(response) {
                    if (response.success) {
                        decrypted_view.text(response.data).show();
                        data_div.find('.pqls-redacted-view').hide();
                        security_warning.show();
                        button.hide();
                        hide_button.show();
                    } else {
                        decrypted_view.text(pqls_ajax.strings.decrypt_failed).show();
                        button.text('Decrypt');
                    }
                });
            });

            jQuery(document).on('click', '.pqls-hide-button', function(e) {
                e.preventDefault();
                var button = jQuery(this);
                var container = button.closest('.pqls-encrypted-data-container');
                container.find('.pqls-decrypted-view').hide();
                container.find('.pqls-redacted-view').show();
                container.find('.pqls-security-warning').hide();
                button.hide();
                container.find('.pqls-decrypt-button').show().text('Decrypt');
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
                <input type="checkbox" id="field_encrypt_value" onclick="SetFieldProperty('encryptField', this.checked);" />
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

            // Set the 'encryptField' property when the form editor is loaded
            jQuery(document).bind('gform_load_field_settings', function(event, field, form) {
                jQuery('#field_encrypt_value').prop('checked', field.encryptField == true);
            });

            // This function is now part of Gravity Forms and can be called directly
            // function SetFieldProperty(name, value) {
            //     // This is a placeholder for the actual GF function
            //     // In a real scenario, this would update the field object
            // }

            // Save the setting when the form is saved
            gform.add_filter('gform_pre_form_editor_save', function (form) {
                for (var i = 0; i < form.fields.length; i++) {
                    var field = form.fields[i];
                    if (typeof field.encryptField === 'undefined') {
                        field.encryptField = false;
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
        if (is_admin()) return $content; // Don't show on admin pages

        $settings = get_option($this->option_name, array());
        $encrypted_fields = $settings['encrypted_fields'][$form_id] ?? [];
        
        if (in_array($field->id, $encrypted_fields)) {
            $content = str_replace('</label>', ' <span class="pqls-encrypted-indicator">💫</span></label>', $content);
        }

        return $content;
    }
    
    /**
     * Add CSS class to encrypted fields on the frontend
     */
    public function add_encryption_field_class($classes, $field, $form) {
        if (is_admin()) return $classes;

        $settings = get_option($this->option_name, array());
        $encrypted_fields = $settings['encrypted_fields'][$form->id] ?? [];

        if (in_array($field->id, $encrypted_fields)) {
            $classes .= ' pqls-encrypted-field';
        }

        return $classes;
    }
    
    /**
     * Enqueue frontend scripts and styles
     */
    public function enqueue_frontend_scripts() {
        wp_enqueue_style('pqls-frontend', PQLS_PLUGIN_URL . 'assets/frontend.css', array(), PQLS_VERSION);
        wp_enqueue_script('pqls-frontend', PQLS_PLUGIN_URL . 'assets/frontend.js', array('jquery'), PQLS_VERSION, true);
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
}

// Instantiate the plugin
new PostQuantumLatticeShield(); 