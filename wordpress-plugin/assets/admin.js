/**
 * Post Quantum Lattice Shield Admin JavaScript
 */
jQuery(document).ready(function($) {
    
    // Initialize admin interface
    PQLS_Admin.init();
    
});

var PQLS_Admin = {
    
    init: function() {
        this.bindEvents();
        this.initTooltips();
    },
    
    bindEvents: function() {
        // Key management buttons
        $('#regenerate-keys').on('click', this.regenerateKeys);
        $('#test-connection').on('click', this.testConnection);
        
        // Form validation
        $('form').on('submit', this.validateForm);
        
        // Real-time URL validation
        $('input[name*="microservice_url"]').on('blur', this.validateUrl);
        
        // Encrypted fields selection
        $('#encrypted-fields-container input[type="checkbox"]').on('change', this.updateFieldSelection);
    },
    
    initTooltips: function() {
        // Add tooltips to help users understand the interface
        $('[data-tooltip]').each(function() {
            $(this).attr('title', $(this).data('tooltip'));
        });
    },
    
    regenerateKeys: function(e) {
        e.preventDefault();
        
        if (!confirm(pqls_strings.confirm_regenerate)) {
            return;
        }
        
        var $button = $(this);
        var originalText = $button.text();
        
        $button.prop('disabled', true)
               .html(originalText + ' <span class="pqls-loading"></span>');
        
        $.ajax({
            url: pqls_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'pqls_regenerate_keys',
                nonce: pqls_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    PQLS_Admin.showNotice('success', response.data);
                    setTimeout(function() {
                        location.reload();
                    }, 1500);
                } else {
                    PQLS_Admin.showNotice('error', response.data);
                }
            },
            error: function() {
                PQLS_Admin.showNotice('error', 'Connection failed. Please try again.');
            },
            complete: function() {
                $button.prop('disabled', false).text(originalText);
            }
        });
    },
    
    testConnection: function(e) {
        e.preventDefault();
        
        var $button = $(this);
        var originalText = $button.text();
        
        $button.prop('disabled', true)
               .html(originalText + ' <span class="pqls-loading"></span>');
        
        $.ajax({
            url: pqls_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'pqls_test_connection',
                nonce: pqls_ajax.nonce
            },
            success: function(response) {
                $('#key-status')
                    .removeClass('notice-error notice-success')
                    .addClass(response.success ? 'notice-success' : 'notice-error')
                    .html('<p>' + response.data + '</p>')
                    .show();
            },
            error: function() {
                $('#key-status')
                    .removeClass('notice-success')
                    .addClass('notice-error')
                    .html('<p>Connection test failed. Please check your network connection.</p>')
                    .show();
            },
            complete: function() {
                $button.prop('disabled', false).text(originalText);
            }
        });
    },
    
    validateForm: function(e) {
        var isValid = true;
        var $form = $(this);
        
        // Clear previous errors
        $('.pqls-error').remove();
        
        // Validate microservice URL
        var $urlField = $form.find('input[name*="microservice_url"]');
        var url = $urlField.val();
        
        if (!url || !PQLS_Admin.isValidUrl(url)) {
            PQLS_Admin.showFieldError($urlField, 'Please enter a valid microservice URL');
            isValid = false;
        }
        
        // Validate at least one encrypted field is selected
        var $encryptedFields = $form.find('input[name*="encrypted_fields"]');
        if ($encryptedFields.length > 0 && $encryptedFields.filter(':checked').length === 0) {
            PQLS_Admin.showNotice('warning', 'No fields selected for encryption. The plugin will not encrypt any data.');
        }
        
        return isValid;
    },
    
    validateUrl: function() {
        var $field = $(this);
        var url = $field.val();
        
        if (url && !PQLS_Admin.isValidUrl(url)) {
            PQLS_Admin.showFieldError($field, 'Please enter a valid URL');
        } else {
            PQLS_Admin.clearFieldError($field);
        }
    },
    
    updateFieldSelection: function() {
        var $checkbox = $(this);
        var $row = $checkbox.closest('tr');
        
        if ($checkbox.prop('checked')) {
            $row.addClass('selected');
        } else {
            $row.removeClass('selected');
        }
        
        // Update count
        var selectedCount = $('#encrypted-fields-container input[type="checkbox"]:checked').length;
        var $countDisplay = $('#selected-fields-count');
        
        if ($countDisplay.length === 0) {
            $('#encrypted-fields-container').after('<p id="selected-fields-count"></p>');
            $countDisplay = $('#selected-fields-count');
        }
        
        $countDisplay.text(selectedCount + ' field(s) selected for encryption');
    },
    
    isValidUrl: function(url) {
        try {
            new URL(url);
            return url.startsWith('https://');
        } catch (e) {
            return false;
        }
    },
    
    showNotice: function(type, message) {
        var $notice = $('<div class="notice notice-' + type + ' is-dismissible"><p>' + message + '</p></div>');
        
        $('.wrap h1').after($notice);
        
        // Auto-dismiss after 5 seconds
        setTimeout(function() {
            $notice.fadeOut();
        }, 5000);
        
        // Make dismissible
        $notice.on('click', '.notice-dismiss', function() {
            $notice.fadeOut();
        });
    },
    
    showFieldError: function($field, message) {
        PQLS_Admin.clearFieldError($field);
        
        var $error = $('<div class="pqls-error" style="color: #d63638; font-size: 13px; margin-top: 5px;">' + message + '</div>');
        $field.after($error);
        $field.css('border-color', '#d63638');
    },
    
    clearFieldError: function($field) {
        $field.siblings('.pqls-error').remove();
        $field.css('border-color', '');
    }
    
};

// Localization strings (to be populated by WordPress)
var pqls_strings = {
    confirm_regenerate: 'Are you sure? This will invalidate all previously encrypted data!'
}; 