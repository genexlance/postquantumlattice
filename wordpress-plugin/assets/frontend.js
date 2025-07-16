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
                
                // Show encryption progress with post-quantum awareness
                $encryptedFields.each(function() {
                    var $field = $(this);
                    var $indicator = $field.find('.pqls-field-encryption-indicator');
                    var $text = $indicator.find('.pqls-field-encryption-text');
                    
                    // Show appropriate encryption text based on algorithm
                    var encryptingText = pqls_frontend && pqls_frontend.strings ? 
                        pqls_frontend.strings.encrypting : 'ENCRYPTING...';
                    
                    $text.text(encryptingText);
                    $indicator.addClass('pqls-processing');
                    
                    // Add post-quantum visual indicator
                    if (pqls_frontend && pqls_frontend.is_post_quantum) {
                        $indicator.addClass('pqls-post-quantum-processing');
                    }
                });
                
                // Calculate encryption timeout based on algorithm and data size
                var encryptionTimeout = PQLS_Frontend.calculateEncryptionTimeout($encryptedFields);
                
                // Show completion after appropriate delay
                setTimeout(function() {
                    $encryptedFields.removeClass('pqls-encrypting');
                    
                    $encryptedFields.each(function() {
                        var $field = $(this);
                        var $indicator = $field.find('.pqls-field-encryption-indicator');
                        var $text = $indicator.find('.pqls-field-encryption-text');
                        
                        // Show appropriate encrypted text
                        var encryptedText = pqls_frontend && pqls_frontend.encryption_text ? 
                            pqls_frontend.encryption_text : 'ENCRYPTED';
                        
                        $text.text(encryptedText);
                        $indicator.removeClass('pqls-processing pqls-post-quantum-processing');
                        $indicator.addClass('pqls-encrypted-complete');
                        
                        // Add success animation
                        $indicator.addClass('pqls-encryption-success');
                        setTimeout(function() {
                            $indicator.removeClass('pqls-encryption-success');
                        }, 2000);
                    });
                }, encryptionTimeout);
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
            // Get encryption details from localized data
            var isPostQuantum = pqls_frontend && pqls_frontend.is_post_quantum;
            var algorithmName = pqls_frontend && pqls_frontend.strings ? 
                pqls_frontend.strings.algorithm_name : 'Unknown';
            var securityLevel = pqls_frontend && pqls_frontend.security_level ? 
                pqls_frontend.security_level : 'standard';
            
            // Create dynamic content based on encryption type
            var title = isPostQuantum ? '🔐 Post-Quantum Encryption' : '🔒 Encryption';
            var description = isPostQuantum ? 
                'This field is protected with <strong>' + algorithmName + '</strong> lattice-based cryptography.' :
                'This field is protected with <strong>' + algorithmName + '</strong> encryption.';
            
            var features = [];
            if (isPostQuantum) {
                features.push('✅ Quantum-resistant security');
                features.push('🛡️ Future-proof protection');
                features.push('🔐 NIST-approved algorithm');
                if (securityLevel === 'high') {
                    features.push('⚡ Maximum security level');
                } else {
                    features.push('⚡ Optimized performance');
                }
            } else {
                features.push('🔒 Strong encryption');
                features.push('🛡️ Data protection');
                features.push('⚠️ Consider upgrading to post-quantum');
            }
            features.push('💾 Encrypted before database storage');
            
            var featuresList = features.map(function(feature) {
                return '<li>' + feature + '</li>';
            }).join('');
            
            // Create or show encryption info popup
            var infoId = 'pqls-encryption-info-' + Date.now();
            var $info = $('<div id="' + infoId + '" class="pqls-encryption-info-popup" role="dialog" aria-modal="true">' +
                '<div class="pqls-info-content">' +
                    '<h3>' + title + '</h3>' +
                    '<p>' + description + '</p>' +
                    '<ul>' + featuresList + '</ul>' +
                    '<div class="pqls-info-details">' +
                        '<small><strong>Algorithm:</strong> ' + algorithmName + '</small><br>' +
                        '<small><strong>Security Level:</strong> ' + securityLevel.charAt(0).toUpperCase() + securityLevel.slice(1) + '</small>' +
                    '</div>' +
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
        calculateEncryptionTimeout: function($encryptedFields) {
            var baseTimeout = 800; // Base timeout in milliseconds
            var fieldCount = $encryptedFields.length;
            var totalDataSize = 0;
            
            // Estimate data size from field values
            $encryptedFields.each(function() {
                var $field = $(this);
                var $input = $field.find('input, textarea, select').first();
                var value = $input.val() || '';
                totalDataSize += value.length;
            });
            
            // Calculate timeout based on algorithm and data size
            var algorithmMultiplier = 1;
            if (pqls_frontend && pqls_frontend.is_post_quantum) {
                // Post-quantum encryption may take slightly longer
                algorithmMultiplier = pqls_frontend.security_level === 'high' ? 1.3 : 1.1;
            }
            
            // Add time based on data size (1ms per character)
            var sizeTimeout = Math.min(totalDataSize, 2000); // Cap at 2 seconds
            
            // Add time based on field count
            var fieldTimeout = fieldCount * 100;
            
            var calculatedTimeout = (baseTimeout + sizeTimeout + fieldTimeout) * algorithmMultiplier;
            
            // Ensure minimum and maximum bounds
            return Math.max(500, Math.min(calculatedTimeout, 3000));
        },
        
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
        
        .pqls-post-quantum-processing {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            border: 2px solid #4dabf7;
        }
        
        .pqls-encrypted-complete {
            background: linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%) !important;
        }
        
        .pqls-encryption-success {
            animation: pqls-success-pulse 1s ease-in-out;
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
        
        @keyframes pqls-success-pulse {
            0% { 
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(86, 171, 47, 0.7);
            }
            50% { 
                transform: scale(1.05);
                box-shadow: 0 0 0 10px rgba(86, 171, 47, 0);
            }
            100% { 
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(86, 171, 47, 0);
            }
        }
    `;
    document.head.appendChild(style);
})(); 