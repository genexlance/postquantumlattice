/**
 * Post Quantum Lattice Shield Admin JavaScript
 */
(function($) {
    'use strict';
    
    var PQLS_Admin = {
    
    init: function() {
        this.bindEvents();
        this.initTooltips();
    },
    
    bindEvents: function() {
        // Key management buttons
        $('#regenerate-keys').on('click', this.regenerateKeys);
        $('#test-connection').on('click', this.testConnection);
        $('#test-decrypt').on('click', this.testDecrypt);
        
        // Migration buttons
        $('#backup-keys').on('click', this.backupKeys);
        $('#start-migration').on('click', this.startMigration);
        $('#execute-migration').on('click', this.executeMigration);
        $('#check-migration-status').on('click', this.checkMigrationStatus);
        $('#remove-backup').on('click', this.removeBackup);
        $('#rollback-migration').on('click', this.rollbackMigration);
        $('#verify-data-integrity').on('click', this.verifyDataIntegrity);
        $('#view-migration-log').on('click', this.viewMigrationLog);
        
        // New post-quantum testing buttons
        $('#test-pq-encryption').on('click', this.testPostQuantumEncryption);
        $('#refresh-status').on('click', this.refreshStatus);
        
        // Security level selection
        $('input[name="pqls_security_level"]').on('change', this.updateSecurityLevel);
        
        // Form validation
        $('form').on('submit', this.validateForm);
        
        // Real-time URL validation
        $('input[name*="microservice_url"]').on('blur', this.validateUrl);
        
        // Encrypted fields selection
        $('#encrypted-fields-container input[type="checkbox"]').on('change', this.updateFieldSelection);
        
        // Tab navigation
        $('.nav-tab').on('click', this.switchTab);
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
    
    testDecrypt: function(e) {
        e.preventDefault();
        
        var $button = $(this);
        var originalText = $button.text();
        
        $button.prop('disabled', true)
               .html(originalText + ' <span class="pqls-loading"></span>');

        $.ajax({
            url: pqls_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'pqls_test_decrypt',
                nonce: pqls_ajax.nonce
            },
            success: function(response) {
                var statusClass = response.success ? 'notice-success' : 'notice-error';
                var resultHtml = '<p><strong>Decryption Test Result:</strong></p>';
                
                if (response.success) {
                    var data = response.data;
                    if (typeof data === 'object' && data.details) {
                        // Enhanced response with algorithm details
                        resultHtml += '<p>✅ ' + (data.message || 'Test successful!') + '</p>';
                        resultHtml += '<table class="form-table" style="margin-top: 10px;">';
                        resultHtml += '<tr><th style="width: 150px;">Algorithm:</th><td>' + (data.details.algorithm || 'Unknown') + '</td></tr>';
                        resultHtml += '<tr><th>Security Level:</th><td>' + (data.details.security_level || 'Unknown') + '</td></tr>';
                        resultHtml += '<tr><th>Quantum Resistant:</th><td>' + (data.details.is_post_quantum ? '✅ Yes' : '⚠️ No') + '</td></tr>';
                        resultHtml += '<tr><th>Data Size:</th><td>' + (data.details.data_size || 0) + ' bytes</td></tr>';
                        resultHtml += '<tr><th>Encrypted Size:</th><td>' + (data.details.encrypted_size || 0) + ' bytes</td></tr>';
                        resultHtml += '</table>';
                    } else {
                        // Simple response
                        resultHtml += '<p>' + (typeof data === 'string' ? data : data.message || 'Test successful!') + '</p>';
                    }
                } else {
                    resultHtml += '<p>❌ ' + (response.data || 'Test failed') + '</p>';
                }
                
                $('#key-status')
                    .removeClass('notice-error notice-success notice-warning')
                    .addClass(statusClass)
                    .html(resultHtml)
                    .show();
            },
            error: function() {
                $('#key-status')
                    .removeClass('notice-success notice-warning')
                    .addClass('notice-error')
                    .html('<p><strong>Decryption Test Result:</strong></p><p>❌ Connection test failed. Please check your browser console for errors.</p>')
                    .show();
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
                var statusClass = response.success ? 'notice-success' : 'notice-error';
                var resultHtml = '<p><strong>Connection Test Result:</strong></p>';
                
                if (response.success) {
                    var data = response.data;
                    if (typeof data === 'object' && data.status) {
                        // Enhanced response with status details
                        resultHtml += '<p>✅ ' + (data.message || 'Connection successful!') + '</p>';
                        resultHtml += '<table class="form-table" style="margin-top: 10px;">';
                        resultHtml += '<tr><th style="width: 150px;">OQS Available:</th><td>' + (data.status.oqs_available ? '✅ Yes' : '❌ No') + '</td></tr>';
                        resultHtml += '<tr><th>Functional:</th><td>' + (data.status.functional ? '✅ Yes' : '❌ No') + '</td></tr>';
                        if (data.status.version) {
                            resultHtml += '<tr><th>Version:</th><td>' + data.status.version + '</td></tr>';
                        }
                        resultHtml += '<tr><th>Health:</th><td>' + (data.status.health || 'Unknown') + '</td></tr>';
                        if (data.status.algorithms && data.status.algorithms.length > 0) {
                            resultHtml += '<tr><th>Algorithms:</th><td>' + data.status.algorithms.length + ' supported</td></tr>';
                        }
                        resultHtml += '</table>';
                    } else {
                        // Simple response
                        resultHtml += '<p>✅ ' + (typeof data === 'string' ? data : data.message || 'Connection successful!') + '</p>';
                    }
                } else {
                    resultHtml += '<p>❌ ' + (response.data || 'Connection failed') + '</p>';
                    
                    // Add retry button for connection failures
                    resultHtml += '<p><button type="button" class="button button-small" onclick="PQLS_Admin.testConnection.call($(\'#test-connection\')[0], {preventDefault: function(){}})">Retry Connection</button></p>';
                }
                
                $('#key-status')
                    .removeClass('notice-error notice-success notice-warning')
                    .addClass(statusClass)
                    .html(resultHtml)
                    .show();
            },
            error: function(xhr, status, error) {
                var errorHtml = '<p><strong>Connection Test Result:</strong></p>';
                errorHtml += '<p>❌ Connection test failed: ' + error + '</p>';
                errorHtml += '<p><em>Please check your microservice URL and network connection.</em></p>';
                errorHtml += '<p><button type="button" class="button button-small" onclick="PQLS_Admin.testConnection.call($(\'#test-connection\')[0], {preventDefault: function(){}})">Retry Connection</button></p>';
                
                $('#key-status')
                    .removeClass('notice-success notice-warning')
                    .addClass('notice-error')
                    .html(errorHtml)
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
    },
    
    backupKeys: function(e) {
        e.preventDefault();
        
        var $button = $(this);
        var originalText = $button.text();
        
        $button.prop('disabled', true)
               .html(originalText + ' <span class="pqls-loading"></span>');
        
        $.ajax({
            url: pqls_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'pqls_backup_keys',
                nonce: pqls_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    PQLS_Admin.showNotice('success', response.data);
                    $('#start-migration').prop('disabled', false);
                } else {
                    PQLS_Admin.showNotice('error', response.data);
                }
            },
            error: function() {
                PQLS_Admin.showNotice('error', 'Backup failed. Please try again.');
            },
            complete: function() {
                $button.prop('disabled', false).text(originalText);
            }
        });
    },
    
    startMigration: function(e) {
        e.preventDefault();
        
        if (!confirm(pqls_strings.confirm_migration)) {
            return;
        }
        
        var securityLevel = $('input[name="pqls_security_level"]:checked').val();
        var $button = $(this);
        var originalText = $button.text();
        
        $button.prop('disabled', true)
               .html(originalText + ' <span class="pqls-loading"></span>');
        
        $('#migration-progress').show();
        PQLS_Admin.updateProgress(25, 'Starting migration...');
        
        $.ajax({
            url: pqls_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'pqls_start_migration',
                nonce: pqls_ajax.nonce,
                security_level: securityLevel
            },
            success: function(response) {
                if (response.success) {
                    PQLS_Admin.updateProgress(100, 'Migration completed successfully!');
                    PQLS_Admin.showNotice('success', response.data);
                    setTimeout(function() {
                        location.reload();
                    }, 2000);
                } else {
                    PQLS_Admin.updateProgress(0, 'Migration failed: ' + response.data);
                    PQLS_Admin.showNotice('error', response.data);
                }
            },
            error: function() {
                PQLS_Admin.updateProgress(0, 'Migration failed due to connection error');
                PQLS_Admin.showNotice('error', 'Migration failed. Please check your connection.');
            },
            complete: function() {
                $button.prop('disabled', false).text(originalText);
            }
        });
    },
    
    checkMigrationStatus: function(e) {
        e.preventDefault();
        
        var $button = $(this);
        var originalText = $button.text();
        
        $button.prop('disabled', true)
               .html(originalText + ' <span class="pqls-loading"></span>');
        
        $.ajax({
            url: pqls_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'pqls_check_migration_status',
                nonce: pqls_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    var data = response.data;
                    var statusText = 'Status: ' + data.status + 
                                   ', Algorithm: ' + data.algorithm + 
                                   ', Security Level: ' + data.security_level;
                    
                    if (data.status === 'completed') {
                        PQLS_Admin.updateProgress(100, 'Migration completed successfully!');
                        PQLS_Admin.showNotice('success', statusText);
                        setTimeout(function() {
                            location.reload();
                        }, 1500);
                    } else if (data.status === 'in_progress') {
                        PQLS_Admin.updateProgress(50, 'Migration in progress...');
                    } else {
                        PQLS_Admin.showNotice('info', statusText);
                    }
                } else {
                    PQLS_Admin.showNotice('error', response.data);
                }
            },
            error: function() {
                PQLS_Admin.showNotice('error', 'Failed to check migration status.');
            },
            complete: function() {
                $button.prop('disabled', false).text(originalText);
            }
        });
    },
    
    removeBackup: function(e) {
        e.preventDefault();
        
        if (!confirm(pqls_strings.confirm_remove_backup)) {
            return;
        }
        
        var $button = $(this);
        var originalText = $button.text();
        
        $button.prop('disabled', true)
               .html(originalText + ' <span class="pqls-loading"></span>');
        
        // This would need a corresponding AJAX handler in PHP
        $.ajax({
            url: pqls_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'pqls_remove_backup',
                nonce: pqls_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    PQLS_Admin.showNotice('success', response.data);
                    $button.closest('h3').next('p').next('button').remove();
                    $button.closest('h3').next('p').remove();
                    $button.closest('h3').remove();
                } else {
                    PQLS_Admin.showNotice('error', response.data);
                }
            },
            error: function() {
                PQLS_Admin.showNotice('error', 'Failed to remove backup.');
            },
            complete: function() {
                $button.prop('disabled', false).text(originalText);
            }
        });
    },
    
    updateSecurityLevel: function() {
        var selectedLevel = $(this).val();
        var description = selectedLevel === 'high' ? 
            'ML-KEM-1024 provides maximum security but may have slightly higher computational overhead.' :
            'ML-KEM-768 provides excellent security with optimal performance for most applications.';
        
        var $description = $('.security-level-description');
        if ($description.length === 0) {
            $(this).closest('td').append('<p class="security-level-description description"></p>');
            $description = $('.security-level-description');
        }
        $description.text(description);
    },
    
    testPostQuantumEncryption: function(e) {
        e.preventDefault();
        
        var $button = $(this);
        var originalText = $button.text();
        
        $button.prop('disabled', true)
               .html(originalText + ' <span class="pqls-loading"></span>');
        
        $('#test-results').show();
        $('#test-output').html('<div class="pqls-loading-text">Running post-quantum encryption test...</div>');
        
        $.ajax({
            url: pqls_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'pqls_test_pq_encryption',
                nonce: pqls_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    var data = response.data;
                    var resultHtml = '<div class="notice notice-success"><p><strong>✅ Test Passed!</strong></p></div>';
                    resultHtml += '<table class="form-table">';
                    resultHtml += '<tr><th>Algorithm:</th><td>' + (data.algorithm || 'Unknown') + '</td></tr>';
                    resultHtml += '<tr><th>Security Level:</th><td>' + (data.security_level || 'Unknown') + '</td></tr>';
                    resultHtml += '<tr><th>Encryption Type:</th><td>' + (data.encryption_type || 'Unknown') + '</td></tr>';
                    resultHtml += '<tr><th>Original Data Size:</th><td>' + (data.data_size || 0) + ' bytes</td></tr>';
                    resultHtml += '<tr><th>Encrypted Data Size:</th><td>' + (data.encrypted_size || 0) + ' bytes</td></tr>';
                    resultHtml += '</table>';
                    resultHtml += '<p><em>' + (data.message || 'Test completed successfully') + '</em></p>';
                    
                    $('#test-output').html(resultHtml);
                    PQLS_Admin.showNotice('success', 'Post-quantum encryption test completed successfully!');
                } else {
                    var errorHtml = '<div class="notice notice-error"><p><strong>❌ Test Failed!</strong></p></div>';
                    errorHtml += '<p>Error: ' + (response.data || 'Unknown error occurred') + '</p>';
                    $('#test-output').html(errorHtml);
                    PQLS_Admin.showNotice('error', 'Post-quantum encryption test failed: ' + response.data);
                }
            },
            error: function(xhr, status, error) {
                var errorHtml = '<div class="notice notice-error"><p><strong>❌ Test Failed!</strong></p></div>';
                errorHtml += '<p>Connection error: ' + error + '</p>';
                $('#test-output').html(errorHtml);
                PQLS_Admin.showNotice('error', 'Test failed due to connection error');
            },
            complete: function() {
                $button.prop('disabled', false).text(originalText);
            }
        });
    },
    
    refreshStatus: function(e) {
        e.preventDefault();
        
        var $button = $(this);
        var originalText = $button.text();
        
        $button.prop('disabled', true)
               .html(originalText + ' <span class="pqls-loading"></span>');
        
        $.ajax({
            url: pqls_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'pqls_refresh_status',
                nonce: pqls_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    PQLS_Admin.showNotice('success', 'Status refreshed successfully');
                    
                    // Update status indicators on the page
                    var data = response.data;
                    PQLS_Admin.updateStatusDisplay(data);
                    
                    // Optionally reload the page to show updated status
                    setTimeout(function() {
                        location.reload();
                    }, 1000);
                } else {
                    PQLS_Admin.showNotice('error', 'Failed to refresh status: ' + response.data);
                }
            },
            error: function() {
                PQLS_Admin.showNotice('error', 'Failed to refresh status due to connection error');
            },
            complete: function() {
                $button.prop('disabled', false).text(originalText);
            }
        });
    },
    
    updateStatusDisplay: function(data) {
        // Update algorithm display
        if (data.algorithm) {
            $('.pqls-current-algorithm').text(data.algorithm);
        }
        
        // Update security level display
        if (data.security_level) {
            $('.pqls-security-level').text(data.security_level);
        }
        
        // Update migration status
        if (data.migration_status) {
            $('.pqls-migration-status').removeClass('pqls-status-pending pqls-status-in_progress pqls-status-completed')
                                       .addClass('pqls-status-' + data.migration_status)
                                       .text(data.migration_status.charAt(0).toUpperCase() + data.migration_status.slice(1));
        }
        
        // Update quantum resistance indicator
        if (data.is_post_quantum !== undefined) {
            var $indicator = $('.pqls-quantum-indicator');
            if (data.is_post_quantum) {
                $indicator.removeClass('pqls-quantum-vulnerable')
                          .addClass('pqls-quantum-resistant')
                          .html('✅ Quantum Resistant');
            } else {
                $indicator.removeClass('pqls-quantum-resistant')
                          .addClass('pqls-quantum-vulnerable')
                          .html('⚠️ Vulnerable to Quantum Attacks');
            }
        }
        
        // Update OQS status if available
        if (data.oqs_status) {
            var oqs = data.oqs_status;
            $('.pqls-oqs-available').text(oqs.available ? 'Available' : 'Not Available')
                                   .removeClass('pqls-status-success pqls-status-error')
                                   .addClass(oqs.available ? 'pqls-status-success' : 'pqls-status-error');
            
            $('.pqls-oqs-functional').text(oqs.functional ? 'Functional' : 'Not Functional')
                                    .removeClass('pqls-status-success pqls-status-error')
                                    .addClass(oqs.functional ? 'pqls-status-success' : 'pqls-status-error');
            
            if (oqs.version) {
                $('.pqls-oqs-version').text(oqs.version);
            }
            
            if (oqs.health) {
                $('.pqls-oqs-health').text(oqs.health.charAt(0).toUpperCase() + oqs.health.slice(1))
                                    .removeClass('pqls-status-healthy pqls-status-degraded pqls-status-unhealthy')
                                    .addClass('pqls-status-' + oqs.health);
            }
        }
    },
    
    updateProgress: function(percentage, text) {
        $('.pqls-progress-fill').css('width', percentage + '%');
        $('.pqls-progress-text').text(text);
    },
    
    switchTab: function(e) {
        e.preventDefault();
        
        var $tab = $(this);
        var targetTab = $tab.attr('href');
        
        // Update tab appearance
        $('.nav-tab').removeClass('nav-tab-active');
        $tab.addClass('nav-tab-active');
        
        // Show/hide content
        $('.tab-content').removeClass('active').hide();
        $(targetTab).addClass('active').show();
    },
    
    executeMigration: function(e) {
        e.preventDefault();
        
        if (!confirm('Are you sure you want to execute the migration? This process will migrate all encrypted data to post-quantum encryption and cannot be easily undone.')) {
            return;
        }
        
        var securityLevel = $('input[name="pqls_security_level"]:checked').val();
        var batchSize = parseInt($('#migration-batch-size').val()) || 100;
        var verifyIntegrity = $('#verify-integrity').prop('checked');
        
        var $button = $(this);
        var originalText = $button.text();
        
        $button.prop('disabled', true)
               .html(originalText + ' <span class="pqls-loading"></span>');
        
        $('#migration-progress').show();
        PQLS_Admin.updateProgress(10, 'Initializing migration...');
        
        // Show rollback button
        if ($('#rollback-migration').length === 0) {
            $button.after('<button id="rollback-migration" class="button button-secondary" style="margin-left: 10px;">Rollback Migration</button>');
            $('#rollback-migration').on('click', PQLS_Admin.rollbackMigration);
        }
        
        $.ajax({
            url: pqls_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'pqls_execute_migration',
                nonce: pqls_ajax.nonce,
                security_level: securityLevel,
                batch_size: batchSize,
                verify_integrity: verifyIntegrity
            },
            success: function(response) {
                if (response.success) {
                    PQLS_Admin.updateProgress(100, 'Migration completed successfully!');
                    PQLS_Admin.showNotice('success', response.data.message + ' (' + response.data.migrated_count + ' entries migrated)');
                    
                    // Show data integrity verification button
                    if ($('#verify-data-integrity').length === 0) {
                        $button.after('<button id="verify-data-integrity" class="button" style="margin-left: 10px;">Verify Data Integrity</button>');
                        $('#verify-data-integrity').on('click', PQLS_Admin.verifyDataIntegrity);
                    }
                    
                    setTimeout(function() {
                        location.reload();
                    }, 3000);
                } else {
                    PQLS_Admin.updateProgress(0, 'Migration failed: ' + response.data);
                    PQLS_Admin.showNotice('error', 'Migration failed: ' + response.data);
                }
            },
            error: function(xhr, status, error) {
                PQLS_Admin.updateProgress(0, 'Migration failed due to connection error');
                PQLS_Admin.showNotice('error', 'Migration failed due to connection error: ' + error);
            },
            complete: function() {
                $button.prop('disabled', false).text(originalText);
            }
        });
    },
    
    rollbackMigration: function(e) {
        e.preventDefault();
        
        if (!confirm('Are you sure you want to rollback the migration? This will restore the previous encryption keys and settings.')) {
            return;
        }
        
        var $button = $(this);
        var originalText = $button.text();
        
        $button.prop('disabled', true)
               .html(originalText + ' <span class="pqls-loading"></span>');
        
        PQLS_Admin.showNotice('info', 'Rolling back migration...');
        
        $.ajax({
            url: pqls_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'pqls_rollback_migration',
                nonce: pqls_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    PQLS_Admin.showNotice('success', response.data);
                    setTimeout(function() {
                        location.reload();
                    }, 2000);
                } else {
                    PQLS_Admin.showNotice('error', 'Rollback failed: ' + response.data);
                }
            },
            error: function(xhr, status, error) {
                PQLS_Admin.showNotice('error', 'Rollback failed due to connection error: ' + error);
            },
            complete: function() {
                $button.prop('disabled', false).text(originalText);
            }
        });
    },
    
    verifyDataIntegrity: function(e) {
        e.preventDefault();
        
        var $button = $(this);
        var originalText = $button.text();
        
        $button.prop('disabled', true)
               .html(originalText + ' <span class="pqls-loading"></span>');
        
        PQLS_Admin.showNotice('info', 'Verifying data integrity...');
        
        $.ajax({
            url: pqls_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'pqls_verify_data_integrity',
                nonce: pqls_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    var data = response.data;
                    var statusClass = data.success_rate >= 95 ? 'notice-success' : (data.success_rate >= 90 ? 'notice-warning' : 'notice-error');
                    
                    var resultHtml = '<div class="' + statusClass + '">';
                    resultHtml += '<p><strong>Data Integrity Verification Results</strong></p>';
                    resultHtml += '<table class="form-table">';
                    resultHtml += '<tr><th>Total Entries:</th><td>' + data.total_entries + '</td></tr>';
                    resultHtml += '<tr><th>Verified Entries:</th><td>' + data.verified_entries + '</td></tr>';
                    resultHtml += '<tr><th>Failed Entries:</th><td>' + data.failed_entries + '</td></tr>';
                    resultHtml += '<tr><th>Success Rate:</th><td>' + data.success_rate + '%</td></tr>';
                    resultHtml += '<tr><th>Status:</th><td>' + data.status.charAt(0).toUpperCase() + data.status.slice(1) + '</td></tr>';
                    resultHtml += '</table>';
                    resultHtml += '</div>';
                    
                    $('#key-status').html(resultHtml).show();
                    
                    var noticeType = data.success_rate >= 95 ? 'success' : (data.success_rate >= 90 ? 'warning' : 'error');
                    PQLS_Admin.showNotice(noticeType, 'Data integrity verification completed. Success rate: ' + data.success_rate + '%');
                } else {
                    PQLS_Admin.showNotice('error', 'Data integrity verification failed: ' + response.data);
                }
            },
            error: function(xhr, status, error) {
                PQLS_Admin.showNotice('error', 'Data integrity verification failed due to connection error: ' + error);
            },
            complete: function() {
                $button.prop('disabled', false).text(originalText);
            }
        });
    },
    
    viewMigrationLog: function(e) {
        e.preventDefault();
        
        var $button = $(this);
        var originalText = $button.text();
        
        $button.prop('disabled', true)
               .html(originalText + ' <span class="pqls-loading"></span>');
        
        $.ajax({
            url: pqls_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'pqls_get_migration_log',
                nonce: pqls_ajax.nonce,
                limit: 50,
                offset: 0
            },
            success: function(response) {
                if (response.success) {
                    var data = response.data;
                    PQLS_Admin.displayMigrationLog(data.entries, data.total_count);
                } else {
                    PQLS_Admin.showNotice('error', 'Failed to load migration log: ' + response.data);
                }
            },
            error: function(xhr, status, error) {
                PQLS_Admin.showNotice('error', 'Failed to load migration log due to connection error: ' + error);
            },
            complete: function() {
                $button.prop('disabled', false).text(originalText);
            }
        });
    },
    
    displayMigrationLog: function(entries, totalCount) {
        var logHtml = '<div class="pqls-migration-log-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999;">';
        logHtml += '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 5px; max-width: 80%; max-height: 80%; overflow-y: auto;">';
        logHtml += '<h3>Migration Audit Log (' + totalCount + ' total entries)</h3>';
        
        if (entries.length === 0) {
            logHtml += '<p>No log entries found.</p>';
        } else {
            logHtml += '<table class="wp-list-table widefat striped">';
            logHtml += '<thead><tr><th>Timestamp</th><th>Event</th><th>User</th><th>Details</th></tr></thead>';
            logHtml += '<tbody>';
            
            entries.forEach(function(entry) {
                var eventClass = '';
                if (entry.event_type.includes('failed') || entry.event_type.includes('error')) {
                    eventClass = 'style="color: #d63638;"';
                } else if (entry.event_type.includes('completed') || entry.event_type.includes('success')) {
                    eventClass = 'style="color: #00a32a;"';
                }
                
                logHtml += '<tr>';
                logHtml += '<td>' + entry.timestamp + '</td>';
                logHtml += '<td ' + eventClass + '>' + entry.event_type.replace(/_/g, ' ').toUpperCase() + '</td>';
                logHtml += '<td>' + (entry.user_login || 'System') + '</td>';
                logHtml += '<td><small>' + JSON.stringify(entry.data || {}) + '</small></td>';
                logHtml += '</tr>';
            });
            
            logHtml += '</tbody></table>';
        }
        
        logHtml += '<p style="text-align: right; margin-top: 20px;">';
        logHtml += '<button class="button button-secondary pqls-close-log">Close</button>';
        logHtml += '</p>';
        logHtml += '</div></div>';
        
        $('body').append(logHtml);
        
        // Close modal functionality
        $('.pqls-close-log, .pqls-migration-log-modal').on('click', function(e) {
            if (e.target === this) {
                $('.pqls-migration-log-modal').remove();
            }
        });
    }
    
};

// Localization strings (populated by WordPress via wp_localize_script)
var pqls_strings = pqls_ajax.strings || {
    confirm_regenerate: 'Are you sure? This will invalidate all previously encrypted data!',
    confirm_migration: 'Are you sure you want to start the migration? This will generate new post-quantum keys.',
    confirm_remove_backup: 'Are you sure you want to remove the RSA key backup? This cannot be undone.'
};

// Initialize when document is ready
$(document).ready(function() {
    PQLS_Admin.init();
});

})(jQuery); 