/**
 * Post Quantum Lattice Shield - Frontend JavaScript
 * Handles encrypted field indicators and user interactions
 */
(function($) {
    'use strict';
    
    var PQLS_Frontend = {
        
        init: function() {
            this.initializeEncryptedFields();
            this.bindEvents();
        },
        
        initializeEncryptedFields: function() {
            // Add tooltips and enhanced indicators to encrypted fields
            $('.pqls-encrypted-field-input').each(function() {
                var $field = $(this);
                var $indicator = $field.closest('.gfield').find('.pqls-field-indicator');
                
                if ($indicator.length) {
                    // Add tooltip functionality
                    PQLS_Frontend.addTooltip($indicator);
                    
                    // Add security level information
                    PQLS_Frontend.addSecurityInfo($indicator);
                }
            });
            
            // Initialize form submission handling
            this.initializeFormSubmission();
        },
        
        bindEvents: function() {
            // Handle tooltip interactions
            $(document).on('mouseenter', '.pqls-encryption-badge', this.showTooltip);
            $(document).on('mouseleave', '.pqls-encryption-badge', this.hideTooltip);
            
            // Handle keyboard accessibility
            $(document).on('keydown', '.pqls-encryption-badge', this.handleKeyboard);
            
            // Handle form submission feedback
            $(document).on('submit', 'form[id^="gform_"]', this.handleFormSubmission);
        },
        
        addTooltip: function($indicator) {
            var $badge = $indicator.find('.pqls-encryption-badge');
            
            if (!$badge.attr('title')) {
                var tooltipText = pqls_frontend.encryption_notice + ' ' + 
                    'Security Level: ' + pqls_frontend.security_level;
                
                $badge.attr('title', tooltipText);
                $badge.attr('aria-label', tooltipText);
            }
        },
        
        addSecurityInfo: function($indicator) {
            var $badge = $indicator.find('.pqls-encryption-badge');
            
            // Add security level indicator if not present
            if (!$badge.find('.pqls-security-level').length) {
                var $securityLevel = $('<span class="pqls-security-level">' + 
                    pqls_frontend.security_level + '</span>');
                $badge.append($securityLevel);
            }
        },
        
        showTooltip: function(e) {
            var $badge = $(this);
            var tooltipText = $badge.attr('title');
            
            if (tooltipText) {
                var $tooltip = $('<div class="pqls-tooltip">' + tooltipText + '</div>');
                $('body').append($tooltip);
                
                // Position tooltip
                var badgeOffset = $badge.offset();
                var badgeWidth = $badge.outerWidth();
                var tooltipWidth = $tooltip.outerWidth();
                
                $tooltip.css({
                    top: badgeOffset.top - $tooltip.outerHeight() - 8,
                    left: badgeOffset.left + (badgeWidth / 2) - (tooltipWidth / 2)
                });
                
                $tooltip.fadeIn(200);
                
                // Store reference for cleanup
                $badge.data('tooltip', $tooltip);
            }
        },
        
        hideTooltip: function(e) {
            var $badge = $(this);
            var $tooltip = $badge.data('tooltip');
            
            if ($tooltip) {
                $tooltip.fadeOut(200, function() {
                    $tooltip.remove();
                });
                $badge.removeData('tooltip');
            }
        },
        
        handleKeyboard: function(e) {
            // Handle Enter and Space for accessibility
            if (e.which === 13 || e.which === 32) {
                e.preventDefault();
                var $badge = $(this);
                
                if ($badge.data('tooltip')) {
                    PQLS_Frontend.hideTooltip.call(this, e);
                } else {
                    PQLS_Frontend.showTooltip.call(this, e);
                }
            }
        },
        
        initializeFormSubmission: function() {
            // Add visual feedback for encrypted fields during submission
            $('form[id^="gform_"]').each(function() {
                var $form = $(this);
                var hasEncryptedFields = $form.find('.pqls-encrypted-field-input').length > 0;
                
                if (hasEncryptedFields) {
                    // Add encryption notice to form
                    PQLS_Frontend.addFormEncryptionNotice($form);
                }
            });
        },
        
        addFormEncryptionNotice: function($form) {
            if ($form.find('.pqls-form-encryption-notice').length === 0) {
                var encryptedFieldCount = $form.find('.pqls-encrypted-field-input').length;
                var noticeText = encryptedFieldCount === 1 ? 
                    'This form contains 1 encrypted field.' : 
                    'This form contains ' + encryptedFieldCount + ' encrypted fields.';
                
                var $notice = $('<div class="pqls-form-encryption-notice">' +
                    '<span class="dashicons dashicons-shield-alt"></span> ' +
                    noticeText + ' Your data will be secured with post-quantum encryption.' +
                    '</div>');
                
                // Insert notice at the top of the form
                $form.prepend($notice);
            }
        },
        
        handleFormSubmission: function(e) {
            var $form = $(this);
            var $encryptedFields = $form.find('.pqls-encrypted-field-input');
            
            if ($encryptedFields.length > 0) {
                // Add loading state to encrypted fields
                $encryptedFields.each(function() {
                    var $field = $(this);
                    var $indicator = $field.closest('.gfield').find('.pqls-field-indicator');
                    
                    if ($indicator.length) {
                        $indicator.addClass('pqls-encrypting');
                        $indicator.find('.pqls-encryption-badge').html(
                            '<span class="dashicons dashicons-update pqls-spin"></span> Encrypting...'
                        );
                    }
                });
                
                // Show form-level encryption status
                var $notice = $form.find('.pqls-form-encryption-notice');
                if ($notice.length) {
                    $notice.addClass('pqls-processing');
                    $notice.html(
                        '<span class="dashicons dashicons-update pqls-spin"></span> ' +
                        'Encrypting sensitive data...'
                    );
                }
            }
        },
        
        // Utility functions
        
        showEncryptionError: function(message) {
            var $errorNotice = $('<div class="pqls-encryption-error">' +
                '<span class="dashicons dashicons-warning"></span> ' +
                'Encryption Error: ' + message +
                '</div>');
            
            $('body').prepend($errorNotice);
            
            setTimeout(function() {
                $errorNotice.fadeOut(function() {
                    $errorNotice.remove();
                });
            }, 5000);
        },
        
        resetFormEncryptionState: function($form) {
            // Reset encryption indicators
            $form.find('.pqls-field-indicator').removeClass('pqls-encrypting');
            $form.find('.pqls-encryption-badge').html(
                '<span class="dashicons dashicons-shield-alt"></span> Encrypted'
            );
            
            // Reset form notice
            var $notice = $form.find('.pqls-form-encryption-notice');
            if ($notice.length) {
                $notice.removeClass('pqls-processing');
                var encryptedFieldCount = $form.find('.pqls-encrypted-field-input').length;
                var noticeText = encryptedFieldCount === 1 ? 
                    'This form contains 1 encrypted field.' : 
                    'This form contains ' + encryptedFieldCount + ' encrypted fields.';
                
                $notice.html(
                    '<span class="dashicons dashicons-shield-alt"></span> ' +
                    noticeText + ' Your data will be secured with post-quantum encryption.'
                );
            }
        }
    };
    
    // Initialize when document is ready
    $(document).ready(function() {
        PQLS_Frontend.init();
    });
    
    // Re-initialize on AJAX form updates
    $(document).on('gform_post_render', function(event, form_id, current_page) {
        setTimeout(function() {
            PQLS_Frontend.initializeEncryptedFields();
        }, 100);
    });
    
    // Handle form submission errors
    $(document).on('gform_post_conditional_logic', function(event, form_id, fields, is_init) {
        if (!is_init) {
            PQLS_Frontend.initializeEncryptedFields();
        }
    });
    
    // Export for external use
    window.PQLS_Frontend = PQLS_Frontend;
    
})(jQuery);