/**
 * Post Quantum Lattice Shield - Frontend JavaScript
 * Enhanced functionality for encrypted fields on form frontend
 */
(function($) {
    'use strict';
    
    var PQLS_Frontend = {
        
        init: function() {
            this.bindEvents();
            this.initializeFields();
            this.setupAccessibility();
        },
        
        bindEvents: function() {
            // Form submission handling
            $(document).on('submit', '.gform_wrapper form', this.handleFormSubmission);
            
            // Field interaction tracking
            $(document).on('focus', '.pqls-encrypted-field-frontend input, .pqls-encrypted-field-frontend textarea, .pqls-encrypted-field-frontend select', this.handleFieldFocus);
            $(document).on('blur', '.pqls-encrypted-field-frontend input, .pqls-encrypted-field-frontend textarea, .pqls-encrypted-field-frontend select', this.handleFieldBlur);
            
            // Encryption indicator clicks
            $(document).on('click', '.pqls-field-encryption-indicator', this.handleIndicatorClick);
            
            // Keyboard navigation
            $(document).on('keydown', '.pqls-field-encryption-indicator', this.handleKeyboardNavigation);
        },
        
        initializeFields: function() {
            // Add ARIA labels to encrypted fields
            $('.pqls-encrypted-field-frontend').each(function() {
                var $field = $(this);
                var $input = $field.find('input, textarea, select').first();
                var $indicator = $field.find('.pqls-field-encryption-indicator');
                
                // Add ARIA attributes
                $input.attr('aria-describedby', $input.attr('id') + '_encryption_info');
                $indicator.attr('id', $input.attr('id') + '_encryption_info');
                $indicator.attr('role', 'status');
                $indicator.attr('aria-live', 'polite');
                
                // Add tabindex for keyboard navigation
                $indicator.attr('tabindex', '0');
                
                // Add tooltip
                $indicator.attr('title', 'This field is encrypted with ML-KEM-512 post-quantum cryptography');
            });
            
            // Initialize field animations
            this.initializeAnimations();
        },
        
        initializeAnimations: function() {
            // Animate encryption indicators on load
            $('.pqls-field-encryption-indicator').each(function(index) {
                var $indicator = $(this);
                setTimeout(function() {
                    $indicator.addClass('pqls-animated');
                }, index * 100);
            });
        },
        
        setupAccessibility: function() {
            // Add screen reader announcements
            this.announceEncryptedFields();
            
            // Add high contrast mode detection
            this.detectHighContrast();
            
            // Add reduced motion support
            this.handleReducedMotion();
        },
        
        announceEncryptedFields: function() {
            var encryptedCount = $('.pqls-encrypted-field-frontend').length;
            if (encryptedCount > 0) {
                var announcement = encryptedCount === 1 ? 
                    'This form contains 1 encrypted field that will be secured with post-quantum cryptography.' :
                    'This form contains ' + encryptedCount + ' encrypted fields that will be secured with post-quantum cryptography.';
                
                // Add screen reader announcement
                $('<div class="sr-only" aria-live="polite" role="status">' + announcement + '</div>')
                    .appendTo('body')
                    .delay(3000)
                    .fadeOut(function() {
                        $(this).remove();
                    });
            }
        },
        
        detectHighContrast: function() {
            // Detect high contrast mode
            if (window.matchMedia && window.matchMedia('(prefers-contrast: high)').matches) {
                $('body').addClass('pqls-high-contrast');
            }
        },
        
        handleReducedMotion: function() {
            // Detect reduced motion preference
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                $('body').addClass('pqls-reduced-motion');
            }
        },
        
        handleFormSubmission: function(e) {
            var $form = $(this);
            var $encryptedFields = $form.find('.pqls-encrypted-field-frontend');
            
            if ($encryptedFields.length > 0) {
                // Add loading state to encrypted fields
                $encryptedFields.addClass('pqls-encrypting');
                
                // Show encryption progress
                $encryptedFields.each(function() {
                    var $field = $(this);
                    var $indicator = $field.find('.pqls-field-encryption-indicator');
                    var $text = $indicator.find('.pqls-field-encryption-text');
                    
                    $text.text('ENCRYPTING...');
                    $indicator.addClass('pqls-processing');
                });
                
                // Simulate encryption delay (for UX)
                setTimeout(function() {
                    $encryptedFields.removeClass('pqls-encrypting');
                    $encryptedFields.find('.pqls-field-encryption-text').text('ENCRYPTED');
                    $encryptedFields.find('.pqls-field-encryption-indicator').removeClass('pqls-processing');
                }, 1000);
            }
        },
        
        handleFieldFocus: function(e) {
            var $field = $(this).closest('.pqls-encrypted-field-frontend');
            var $indicator = $field.find('.pqls-field-encryption-indicator');
            
            // Add focus class for enhanced styling
            $field.addClass('pqls-field-focused');
            $indicator.addClass('pqls-indicator-focused');
            
            // Announce encryption status to screen readers
            var announcement = 'Encrypted field focused. This field is protected with post-quantum cryptography.';
            PQLS_Frontend.announceToScreenReader(announcement);
        },
        
        handleFieldBlur: function(e) {
            var $field = $(this).closest('.pqls-encrypted-field-frontend');
            var $indicator = $field.find('.pqls-field-encryption-indicator');
            
            // Remove focus classes
            $field.removeClass('pqls-field-focused');
            $indicator.removeClass('pqls-indicator-focused');
        },
        
        handleIndicatorClick: function(e) {
            e.preventDefault();
            
            var $indicator = $(this);
            var $field = $indicator.closest('.pqls-encrypted-field-frontend');
            var $input = $field.find('input, textarea, select').first();
            
            // Show encryption info modal or tooltip
            PQLS_Frontend.showEncryptionInfo($indicator, $input);
        },
        
        handleKeyboardNavigation: function(e) {
            // Handle Enter and Space key
            if (e.which === 13 || e.which === 32) {
                e.preventDefault();
                $(this).click();
            }
        },
        
        showEncryptionInfo: function($indicator, $input) {
            // Create or show encryption info popup
            var infoId = 'pqls-encryption-info-' + Date.now();
            var $info = $('<div id="' + infoId + '" class="pqls-encryption-info-popup" role="dialog" aria-modal="true">' +
                '<div class="pqls-info-content">' +
                    '<h3>🔒 Post-Quantum Encryption</h3>' +
                    '<p>This field is protected with <strong>ML-KEM-512</strong> lattice-based cryptography.</p>' +
                    '<ul>' +
                        '<li>✅ Quantum-resistant security</li>' +
                        '<li>🛡️ Data encrypted before database storage</li>' +
                        '<li>🔐 Future-proof protection</li>' +
                    '</ul>' +
                    '<button type="button" class="pqls-close-info">Close</button>' +
                '</div>' +
                '</div>');
            
            // Position near the indicator
            var offset = $indicator.offset();
            $info.css({
                position: 'absolute',
                top: offset.top + $indicator.outerHeight() + 10,
                left: offset.left,
                zIndex: 9999
            });
            
            // Add to body and show
            $('body').append($info);
            $info.fadeIn(200);
            
            // Focus the close button
            $info.find('.pqls-close-info').focus();
            
            // Close button handler
            $info.find('.pqls-close-info').on('click', function() {
                $info.fadeOut(200, function() {
                    $info.remove();
                });
                $indicator.focus();
            });
            
            // Close on escape key
            $(document).on('keydown.pqls-info', function(e) {
                if (e.which === 27) {
                    $info.find('.pqls-close-info').click();
                    $(document).off('keydown.pqls-info');
                }
            });
            
            // Close on outside click
            $(document).on('click.pqls-info', function(e) {
                if (!$info.is(e.target) && $info.has(e.target).length === 0) {
                    $info.find('.pqls-close-info').click();
                    $(document).off('click.pqls-info');
                }
            });
        },
        
        announceToScreenReader: function(message) {
            var $announcement = $('<div class="sr-only" aria-live="assertive" role="alert">' + message + '</div>');
            $('body').append($announcement);
            setTimeout(function() {
                $announcement.remove();
            }, 1000);
        },
        
        // Utility functions
        debounce: function(func, wait) {
            var timeout;
            return function executedFunction() {
                var context = this;
                var args = arguments;
                var later = function() {
                    timeout = null;
                    func.apply(context, args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
    };
    
    // Initialize when document is ready
    $(document).ready(function() {
        PQLS_Frontend.init();
    });
    
    // Re-initialize on AJAX form updates
    $(document).on('gform_post_render', function() {
        PQLS_Frontend.initializeFields();
    });
    
    // Export for external access
    window.PQLS_Frontend = PQLS_Frontend;
    
})(jQuery);

// Additional CSS for JavaScript-added elements
(function() {
    var style = document.createElement('style');
    style.textContent = `
        .pqls-encrypting .pqls-field-encryption-indicator {
            animation: pqls-pulse 0.5s ease-in-out infinite;
        }
        
        .pqls-processing {
            background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%) !important;
        }
        
        .pqls-field-focused .pqls-field-encryption-indicator {
            transform: scale(1.02);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        
        .pqls-indicator-focused {
            outline: 2px solid #fff;
            outline-offset: 2px;
        }
        
        .pqls-encryption-info-popup {
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            max-width: 300px;
            font-size: 14px;
            line-height: 1.4;
        }
        
        .pqls-info-content h3 {
            margin: 0 0 10px 0;
            color: #4dabf7;
        }
        
        .pqls-info-content ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        
        .pqls-info-content li {
            margin: 5px 0;
        }
        
        .pqls-close-info {
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 10px;
        }
        
        .pqls-close-info:hover {
            background: #5a67d8;
        }
        
        .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0,0,0,0);
            white-space: nowrap;
            border: 0;
        }
        
        @keyframes pqls-pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
})(); 