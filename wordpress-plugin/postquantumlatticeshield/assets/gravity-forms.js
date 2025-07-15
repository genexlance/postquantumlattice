/**
 * Post Quantum Lattice Shield - Gravity Forms JavaScript
 * Enhanced functionality for encrypted field display
 */
(function($) {
    'use strict';
    
    var PQLS_GravityForms = {
        
        init: function() {
            this.bindEvents();
            this.initializeFields();
        },
        
        bindEvents: function() {
            // Toggle encrypted content visibility
            $(document).on('click', '.pqls-toggle-encrypted', this.toggleEncryptedContent);
            
            // Copy encrypted data to clipboard
            $(document).on('click', '.pqls-copy-encrypted', this.copyEncryptedData);
            
            // Keyboard accessibility
            $(document).on('keydown', '.pqls-toggle-encrypted', this.handleKeyboard);
        },
        
        initializeFields: function() {
            // Add copy buttons to encrypted fields
            $('.pqls-encrypted-field').each(function() {
                var $field = $(this);
                var $content = $field.find('.pqls-encrypted-content');
                
                // Add copy button if not already present
                if (!$content.find('.pqls-copy-encrypted').length) {
                    var $copyBtn = $('<button type="button" class="pqls-copy-encrypted button-secondary" title="Copy encrypted data to clipboard">')
                        .html('<span class="dashicons dashicons-clipboard"></span> Copy');
                    
                    $content.append($copyBtn);
                }
                
                // Add security level indicator
                PQLS_GravityForms.addSecurityIndicator($field);
            });
            
            // Initialize tooltips
            this.initializeTooltips();
        },
        
        toggleEncryptedContent: function(e) {
            e.preventDefault();
            
            var $button = $(this);
            var $field = $button.closest('.pqls-encrypted-field');
            var $preview = $field.find('.pqls-encrypted-preview');
            var $full = $field.find('.pqls-encrypted-full');
            var $showText = $button.find('.show-text');
            var $hideText = $button.find('.hide-text');
            
            // Add loading state
            $field.addClass('loading');
            
            // Simulate slight delay for better UX
            setTimeout(function() {
                if ($full.is(':visible')) {
                    // Hide full content, show preview
                    $full.slideUp(300, function() {
                        $preview.fadeIn(200);
                        $showText.show();
                        $hideText.hide();
                        $button.attr('aria-expanded', 'false');
                        $field.removeClass('loading');
                    });
                } else {
                    // Hide preview, show full content
                    $preview.fadeOut(200, function() {
                        $full.slideDown(300, function() {
                            $showText.hide();
                            $hideText.show();
                            $button.attr('aria-expanded', 'true');
                            $field.removeClass('loading');
                        });
                    });
                }
            }, 150);
        },
        
        copyEncryptedData: function(e) {
            e.preventDefault();
            
            var $button = $(this);
            var $field = $button.closest('.pqls-encrypted-field');
            var $textarea = $field.find('.pqls-encrypted-textarea');
            var encryptedData = $textarea.val();
            
            // Copy to clipboard
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(encryptedData).then(function() {
                    PQLS_GravityForms.showCopyFeedback($button, true);
                }).catch(function() {
                    PQLS_GravityForms.fallbackCopyToClipboard(encryptedData, $button);
                });
            } else {
                PQLS_GravityForms.fallbackCopyToClipboard(encryptedData, $button);
            }
        },
        
        fallbackCopyToClipboard: function(text, $button) {
            var $temp = $('<textarea>').val(text).appendTo('body').select();
            
            try {
                var successful = document.execCommand('copy');
                PQLS_GravityForms.showCopyFeedback($button, successful);
            } catch (err) {
                PQLS_GravityForms.showCopyFeedback($button, false);
            }
            
            $temp.remove();
        },
        
        showCopyFeedback: function($button, success) {
            var originalText = $button.html();
            var feedbackText = success ? 
                '<span class="dashicons dashicons-yes"></span> Copied!' : 
                '<span class="dashicons dashicons-no"></span> Failed';
            
            $button.html(feedbackText);
            
            if (success) {
                $button.addClass('copied');
            } else {
                $button.addClass('copy-failed');
            }
            
            setTimeout(function() {
                $button.html(originalText);
                $button.removeClass('copied copy-failed');
            }, 2000);
        },
        
        handleKeyboard: function(e) {
            // Handle Enter and Space key for accessibility
            if (e.which === 13 || e.which === 32) {
                e.preventDefault();
                $(this).click();
            }
        },
        
        addSecurityIndicator: function($field) {
            var $content = $field.find('.pqls-encrypted-content');
            
            if (!$content.find('.pqls-security-level').length) {
                var $indicator = $('<div class="pqls-security-level">ML-KEM-512 Post-Quantum Encryption</div>');
                $content.append($indicator);
            }
        },
        
        initializeTooltips: function() {
            // Add tooltips to encrypted badges
            $('.pqls-encrypted-badge').each(function() {
                var $badge = $(this);
                
                if (!$badge.attr('title')) {
                    $badge.attr('title', 'This field is protected with post-quantum encryption using ML-KEM-512 algorithm');
                }
            });
            
            // Initialize WordPress-style tooltips if available
            if (typeof jQuery.fn.tooltip !== 'undefined') {
                $('.pqls-encrypted-badge').tooltip({
                    position: { my: 'center bottom-20', at: 'center top' }
                });
            }
        },
        
        // Analytics and monitoring
        
        decryptField: function(button) {
            var $button = $(button);
            var $field = $button.closest(".pqls-encrypted-field");
            var $preview = $field.find(".pqls-encrypted-preview");
            var $decrypted = $field.find(".pqls-decrypted-content");
            var $decryptedValue = $field.find(".pqls-decrypted-value");
            var encryptedData = $button.data("encrypted");
            
            // Show loading state
            $button.html('<span class="dashicons dashicons-update spin"></span> ' + pqls_ajax.strings.decrypting);
            $button.prop("disabled", true);
            
            $.ajax({
                url: pqls_ajax.ajax_url,
                type: "POST",
                data: {
                    action: "pqls_decrypt_field",
                    nonce: pqls_ajax.nonce,
                    encrypted_data: encryptedData
                },
                success: function(response) {
                    if (response.success) {
                        $decryptedValue.html('<pre>' + response.data + '</pre>');
                        $preview.fadeOut(200, function() {
                            $decrypted.fadeIn(200);
                        });
                        $button.html('<span class="dashicons dashicons-hidden"></span> Hide');
                        $button.removeClass('pqls-decrypt-btn').addClass('pqls-hide-btn');
                        
                        // Log decryption for audit
                        PQLS_GravityForms.trackDecryption($button.data('field-id'));
                    } else {
                        alert(response.data || pqls_ajax.strings.decrypt_failed);
                        $button.html('<span class="dashicons dashicons-visibility"></span> Decrypt');
                    }
                },
                error: function() {
                    alert(pqls_ajax.strings.decrypt_failed);
                    $button.html('<span class="dashicons dashicons-visibility"></span> Decrypt');
                },
                complete: function() {
                    $button.prop("disabled", false);
                }
            });
        },
        
        hideDecrypted: function(button) {
            var $button = $(button);
            var $field = $button.closest(".pqls-encrypted-field");
            var $preview = $field.find(".pqls-encrypted-preview");
            var $decrypted = $field.find(".pqls-decrypted-content");
            
            $decrypted.fadeOut(200, function() {
                $preview.fadeIn(200);
            });
            $button.html("<span class="dashicons dashicons-visibility"></span> Decrypt");
            $button.removeClass("pqls-hide-btn").addClass("pqls-decrypt-btn");
        },
        
        trackDecryption: function(fieldId) {
            // Optional: Track decryption for analytics/audit
            if (typeof gtag !== "undefined") {
                gtag("event", "field_decrypted", {
                    "field_id": fieldId,
                    "user_id": "admin"
                });
            }
        },
                trackEncryptedFieldInteraction: function(action, fieldId) {
            // Track user interactions for analytics (optional)
            if (typeof gtag !== 'undefined') {
                gtag('event', 'encrypted_field_interaction', {
                    'action': action,
                    'field_id': fieldId
                });
            }
        }
    };
    
    // Initialize when document is ready
    $(document).ready(function() {
        PQLS_GravityForms.init();
    });
    
    // Re-initialize on AJAX updates (for pagination, etc.)
    $(document).ajaxComplete(function() {
        setTimeout(function() {
            PQLS_GravityForms.initializeFields();
        }, 500);
    });
    
    // Export for potential external use
    window.PQLS_GravityForms = PQLS_GravityForms;
    
})(jQuery);

// CSS for copy feedback states
(function() {
    var style = document.createElement('style');
    style.textContent = `
        .pqls-copy-encrypted {
            margin-left: 8px;
            font-size: 11px;
            padding: 2px 6px;
            height: auto;
            min-height: 24px;
            border: 1px solid #28a745;
            background: white;
            color: #28a745;
            border-radius: 3px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .pqls-copy-encrypted:hover {
            background: #28a745;
            color: white;
        }
        
        .pqls-copy-encrypted.copied {
            background: #28a745;
            color: white;
            border-color: #28a745;
        }
        
        .pqls-copy-encrypted.copy-failed {
            background: #dc3545;
            color: white;
            border-color: #dc3545;
        }
        
        .pqls-copy-encrypted .dashicons {
            font-size: 12px;
            line-height: 1;
            vertical-align: middle;
        }
        
        .pqls-security-level {
            font-size: 10px;
            color: #666;
            margin-top: 6px;
            padding-top: 6px;
            border-top: 1px solid #eee;
        }
    `;
    document.head.appendChild(style);
})(); 