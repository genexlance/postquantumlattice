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
        add_action('gform_after_submission', array($this, 'encrypt_form_data'), 10, 2);
        add_filter('gform_pre_submission_filter', array($this, 'pre_submission_encrypt'), 10, 1);
        
        // AJAX hooks
        add_action('wp_ajax_pqls_regenerate_keys', array($this, 'ajax_regenerate_keys'));
        add_action('wp_ajax_pqls_test_connection', array($this, 'ajax_test_connection'));
        
        // Enhanced visual indicators for encrypted fields
        add_filter('gform_entry_field_value', array($this, 'format_encrypted_entry_display'), 10, 4);
        add_filter('gform_entries_field_value', array($this, 'format_encrypted_entry_display'), 10, 4);
        add_action('gform_entry_info', array($this, 'add_encryption_notice'), 10, 2);
        add_action('admin_enqueue_scripts', array($this, 'enqueue_gravity_forms_scripts'));
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
        
        // Add capability to admin
        $role = get_role('administrator');
        if ($role) {
            $role->add_cap('manage_pqls');
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
        }
    }
    
    /**
     * Generate ML-KEM keypair
     */
    private function generate_keypair() {
        // For WordPress, we'll generate the keypair by calling our microservice
        $settings = get_option($this->option_name, array());
        $microservice_url = $settings['microservice_url'] ?? PQLS_MICROSERVICE_URL;
        
        $response = wp_remote_get($microservice_url . '/generate-keypair', array(
            'timeout' => 30,
            'headers' => array(
                'Content-Type' => 'application/json',
            )
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
            'nonce' => wp_create_nonce('pqls_nonce')
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
                    <tr>
                        <th scope="row"><?php _e('Microservice URL', 'pqls'); ?></th>
                        <td>
                            <input type="url" name="<?php echo $this->option_name; ?>[microservice_url]" 
                                   value="<?php echo esc_attr($settings['microservice_url'] ?? PQLS_MICROSERVICE_URL); ?>" 
                                   class="regular-text" required />
                            <p class="description"><?php _e('URL of your Netlify microservice endpoint', 'pqls'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('Public Key', 'pqls'); ?></th>
                        <td>
                            <textarea readonly class="large-text" rows="10"><?php echo esc_textarea($public_key); ?></textarea>
                            <p class="description">
                                <?php _e('Algorithm:', 'pqls'); ?> <strong><?php echo esc_html($algorithm); ?></strong><br>
                                <?php if ($key_generated): ?>
                                    <?php _e('Generated:', 'pqls'); ?> <?php echo esc_html($key_generated); ?>
                                <?php endif; ?>
                            </p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('Key Management', 'pqls'); ?></th>
                        <td>
                            <button type="button" id="regenerate-keys" class="button button-secondary">
                                <?php _e('Regenerate Key Pair', 'pqls'); ?>
                            </button>
                            <button type="button" id="test-connection" class="button button-secondary">
                                <?php _e('Test Connection', 'pqls'); ?>
                            </button>
                            <div id="key-status" class="notice" style="display:none; margin-top: 10px;"></div>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row"><?php _e('Encrypted Fields', 'pqls'); ?></th>
                        <td>
                            <div id="encrypted-fields-container">
                                <?php $this->render_encrypted_fields_settings($settings); ?>
                            </div>
                            <p class="description">
                                <?php _e('Select which Gravity Forms fields should be encrypted before storage.', 'pqls'); ?>
                            </p>
                        </td>
                    </tr>
                </table>
                
                <?php submit_button(); ?>
            </form>
            
            <div class="pqls-info">
                <h3><?php _e('Security Information', 'pqls'); ?></h3>
                <ul>
                    <li><?php _e('Public keys are safe to store and can be viewed by administrators.', 'pqls'); ?></li>
                    <li><?php _e('Private keys are stored securely and used only for key generation.', 'pqls'); ?></li>
                    <li><?php _e('All encryption is performed by the remote microservice via HTTPS.', 'pqls'); ?></li>
                    <li><?php _e('ML-KEM-512 provides quantum-resistant security.', 'pqls'); ?></li>
                </ul>
            </div>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            // Regenerate keys
            $('#regenerate-keys').on('click', function() {
                if (!confirm('<?php _e('Are you sure? This will invalidate all previously encrypted data!', 'pqls'); ?>')) {
                    return;
                }
                
                $.ajax({
                    url: pqls_ajax.ajax_url,
                    type: 'POST',
                    data: {
                        action: 'pqls_regenerate_keys',
                        nonce: pqls_ajax.nonce
                    },
                    success: function(response) {
                        if (response.success) {
                            location.reload();
                        } else {
                            alert('<?php _e('Failed to regenerate keys', 'pqls'); ?>');
                        }
                    }
                });
            });
            
            // Test connection
            $('#test-connection').on('click', function() {
                $.ajax({
                    url: pqls_ajax.ajax_url,
                    type: 'POST',
                    data: {
                        action: 'pqls_test_connection',
                        nonce: pqls_ajax.nonce
                    },
                    success: function(response) {
                        $('#key-status').removeClass('notice-error notice-success')
                            .addClass(response.success ? 'notice-success' : 'notice-error')
                            .html('<p>' + response.data + '</p>')
                            .show();
                    }
                });
            });
        });
        </script>
        <?php
    }
    
    /**
     * Render encrypted fields settings
     */
    private function render_encrypted_fields_settings($settings) {
        $encrypted_fields = $settings['encrypted_fields'] ?? array();
        $forms = GFAPI::get_forms();
        
        if (empty($forms)) {
            echo '<p>' . __('No Gravity Forms found.', 'pqls') . '</p>';
            return;
        }
        
        foreach ($forms as $form) {
            echo '<h4>' . esc_html($form['title']) . ' (ID: ' . $form['id'] . ')</h4>';
            echo '<table class="wp-list-table widefat fixed striped">';
            echo '<thead><tr><th>Field</th><th>Type</th><th>Encrypt</th></tr></thead>';
            echo '<tbody>';
            
            foreach ($form['fields'] as $field) {
                $field_key = $form['id'] . '_' . $field->id;
                $is_encrypted = in_array($field_key, $encrypted_fields);
                
                echo '<tr>';
                echo '<td>' . esc_html($field->label) . '</td>';
                echo '<td>' . esc_html($field->type) . '</td>';
                echo '<td>';
                echo '<input type="checkbox" name="' . $this->option_name . '[encrypted_fields][]" ';
                echo 'value="' . esc_attr($field_key) . '" ';
                echo checked($is_encrypted, true, false) . ' />';
                echo '</td>';
                echo '</tr>';
            }
            
            echo '</tbody></table>';
        }
    }
    
    /**
     * Encrypt form data before submission
     */
    public function pre_submission_encrypt($form) {
        if (empty($this->encrypted_fields)) {
            return $form;
        }
        
        $form_id = $form['id'];
        $public_key = get_option('pqls_public_key');
        
        if (!$public_key) {
            error_log('PQLS: No public key available for encryption');
            return $form;
        }
        
        foreach ($form['fields'] as &$field) {
            $field_key = $form_id . '_' . $field->id;
            
            if (in_array($field_key, $this->encrypted_fields)) {
                $field_value = rgpost('input_' . $field->id);
                
                if (!empty($field_value)) {
                    $encrypted_value = $this->encrypt_data($field_value, $public_key);
                    
                    if ($encrypted_value) {
                        $_POST['input_' . $field->id] = $encrypted_value;
                    }
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
        
        $payload = array(
            'publicKey' => $public_key,
            'payload' => $data
        );
        
        $response = wp_remote_post($microservice_url . '/encrypt', array(
            'timeout' => 30,
            'headers' => array(
                'Content-Type' => 'application/json',
            ),
            'body' => json_encode($payload)
        ));
        
        if (is_wp_error($response)) {
            error_log('PQLS: Encryption failed - ' . $response->get_error_message());
            return false;
        }
        
        $body = wp_remote_retrieve_body($response);
        $result = json_decode($body, true);
        
        if (isset($result['encrypted'])) {
            return '[ENCRYPTED:' . $result['encrypted'] . ']';
        }
        
        return false;
    }
    
    /**
     * AJAX: Regenerate keys
     */
    public function ajax_regenerate_keys() {
        check_ajax_referer('pqls_nonce', 'nonce');
        
        if (!current_user_can('manage_pqls')) {
            wp_die(__('Insufficient permissions', 'pqls'));
        }
        
        $success = $this->generate_keypair();
        
        wp_send_json(array(
            'success' => $success,
            'data' => $success ? __('Keys regenerated successfully', 'pqls') : __('Failed to regenerate keys', 'pqls')
        ));
    }
    
    /**
     * AJAX: Test connection
     */
    public function ajax_test_connection() {
        check_ajax_referer('pqls_nonce', 'nonce');
        
        if (!current_user_can('manage_pqls')) {
            wp_die(__('Insufficient permissions', 'pqls'));
        }
        
        $settings = get_option($this->option_name, array());
        $microservice_url = $settings['microservice_url'] ?? PQLS_MICROSERVICE_URL;
        
        $response = wp_remote_get($microservice_url . '/generate-keypair', array(
            'timeout' => 10
        ));
        
        if (is_wp_error($response)) {
            wp_send_json(array(
                'success' => false,
                'data' => __('Connection failed: ', 'pqls') . $response->get_error_message()
            ));
        }
        
        $code = wp_remote_retrieve_response_code($response);
        
        wp_send_json(array(
            'success' => $code === 200,
            'data' => $code === 200 ? __('Connection successful!', 'pqls') : __('Connection failed. Status: ', 'pqls') . $code
        ));
    }
    
    /**
     * Show notice if Gravity Forms is missing
     */
    public function gravity_forms_missing_notice() {
        ?>
        <div class="notice notice-error">
            <p><?php _e('Post Quantum Lattice Shield requires Gravity Forms to be installed and activated.', 'pqls'); ?></p>
        </div>
        <?php
    }
    
    /**
     * Format encrypted field display in Gravity Forms entries
     */
    public function format_encrypted_entry_display($value, $field, $entry, $form) {
        // Check if this value is encrypted
        if (strpos($value, '[ENCRYPTED:') === 0) {
            $encrypted_data = substr($value, 11, -1); // Remove [ENCRYPTED: and ]
            $short_preview = substr($encrypted_data, 0, 20) . '...';
            
            return sprintf(
                '<div class="pqls-encrypted-field">
                    <span class="pqls-encrypted-badge">🔒 ENCRYPTED</span>
                    <div class="pqls-encrypted-content">
                        <div class="pqls-encrypted-preview">%s</div>
                        <div class="pqls-encrypted-full" style="display: none;">%s</div>
                        <button type="button" class="pqls-toggle-encrypted button-secondary" data-target-preview=".pqls-encrypted-preview" data-target-full=".pqls-encrypted-full">
                            <span class="show-text">Show Full</span>
                            <span class="hide-text" style="display: none;">Hide</span>
                        </button>
                    </div>
                </div>',
                esc_html($short_preview),
                '<textarea readonly class="pqls-encrypted-textarea">' . esc_textarea($encrypted_data) . '</textarea>'
            );
        }
        
        return $value;
    }
    
    /**
     * Add encryption notice to entry info
     */
    public function add_encryption_notice($form, $entry) {
        $has_encrypted = false;
        
        foreach ($entry as $key => $value) {
            if (strpos($value, '[ENCRYPTED:') === 0) {
                $has_encrypted = true;
                break;
            }
        }
        
        if ($has_encrypted) {
            echo '<div class="pqls-entry-notice">
                    <div class="notice notice-info inline">
                        <p><strong>🔒 Post-Quantum Encryption:</strong> This entry contains encrypted fields protected with ML-KEM-512 lattice-based cryptography.</p>
                    </div>
                  </div>';
        }
    }
    
    /**
     * Enqueue scripts for Gravity Forms pages
     */
    public function enqueue_gravity_forms_scripts($hook) {
        // Only load on Gravity Forms pages
        if (strpos($hook, 'gf_') === false && strpos($hook, 'gravityforms') === false) {
            return;
        }
        
        wp_enqueue_style('pqls-gravity-forms', PQLS_PLUGIN_URL . 'assets/gravity-forms.css', array(), PQLS_VERSION);
        wp_enqueue_script('pqls-gravity-forms', PQLS_PLUGIN_URL . 'assets/gravity-forms.js', array('jquery'), PQLS_VERSION, true);
    }
}

// Initialize the plugin
new PostQuantumLatticeShield(); 