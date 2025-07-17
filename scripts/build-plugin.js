#!/usr/bin/env node

/**
 * WordPress Plugin Build Script
 * Creates a properly structured ZIP file for WordPress plugin installation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Building WordPress plugin...');

const PLUGIN_NAME = 'post-quantum-lattice-shield';
const SOURCE_DIR = path.join(__dirname, '..', 'wordpress-plugin');
const BUILD_DIR = path.join(__dirname, '..', 'build');
const PLUGIN_BUILD_DIR = path.join(BUILD_DIR, PLUGIN_NAME);
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'plugin-download');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'postquantumlatticeshield.zip');

/**
 * Clean and create build directories
 */
function setupBuildDirectories() {
    console.log('📁 Setting up build directories...');
    
    // Remove existing build directory
    if (fs.existsSync(BUILD_DIR)) {
        execSync(`rm -rf "${BUILD_DIR}"`);
    }
    
    // Create build directories
    fs.mkdirSync(BUILD_DIR, { recursive: true });
    fs.mkdirSync(PLUGIN_BUILD_DIR, { recursive: true });
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    console.log('✅ Build directories created');
}

/**
 * Copy plugin files to build directory
 */
function copyPluginFiles() {
    console.log('📋 Copying plugin files...');
    
    try {
        // Copy all files from wordpress-plugin to build directory
        execSync(`cp -r "${SOURCE_DIR}"/* "${PLUGIN_BUILD_DIR}"/`);
        
        // Remove any hidden files or system files
        const filesToRemove = [
            path.join(PLUGIN_BUILD_DIR, '.DS_Store'),
            path.join(PLUGIN_BUILD_DIR, '__MACOSX'),
            path.join(PLUGIN_BUILD_DIR, '.git*')
        ];
        
        filesToRemove.forEach(file => {
            if (fs.existsSync(file)) {
                execSync(`rm -rf "${file}"`);
            }
        });
        
        console.log('✅ Plugin files copied successfully');
        
    } catch (error) {
        console.error('❌ Failed to copy plugin files:', error.message);
        process.exit(1);
    }
}

/**
 * Validate plugin header
 */
function validatePluginHeader() {
    console.log('🔍 Validating plugin header...');
    
    const mainPluginFile = path.join(PLUGIN_BUILD_DIR, 'post-quantum-lattice-shield.php');
    
    if (!fs.existsSync(mainPluginFile)) {
        console.error('❌ Main plugin file not found');
        process.exit(1);
    }
    
    const content = fs.readFileSync(mainPluginFile, 'utf8');
    
    // Check for required WordPress plugin headers
    const requiredHeaders = [
        'Plugin Name:',
        'Description:',
        'Version:',
        'Author:'
    ];
    
    const missingHeaders = requiredHeaders.filter(header => !content.includes(header));
    
    if (missingHeaders.length > 0) {
        console.error('❌ Missing required plugin headers:', missingHeaders);
        process.exit(1);
    }
    
    // Check for PHP opening tag
    if (!content.startsWith('<?php')) {
        console.error('❌ Plugin file must start with <?php');
        process.exit(1);
    }
    
    console.log('✅ Plugin header validation passed');
}

/**
 * Create ZIP file
 */
function createZipFile() {
    console.log('📦 Creating ZIP file...');
    
    try {
        // Remove existing ZIP file
        if (fs.existsSync(OUTPUT_FILE)) {
            fs.unlinkSync(OUTPUT_FILE);
        }
        
        // Create ZIP file with proper directory structure
        // The ZIP should contain a directory named after the plugin
        execSync(`cd "${BUILD_DIR}" && zip -r "${OUTPUT_FILE}" "${PLUGIN_NAME}" -x "*.DS_Store" "*/__MACOSX/*" "*/.*"`);
        
        console.log('✅ ZIP file created successfully');
        
    } catch (error) {
        console.error('❌ Failed to create ZIP file:', error.message);
        process.exit(1);
    }
}

/**
 * Verify ZIP file structure
 */
function verifyZipStructure() {
    console.log('🔍 Verifying ZIP file structure...');
    
    try {
        // List ZIP contents
        const zipContents = execSync(`unzip -l "${OUTPUT_FILE}"`, { encoding: 'utf8' });
        
        // Check that files are in the correct directory structure
        const expectedFiles = [
            `${PLUGIN_NAME}/post-quantum-lattice-shield.php`,
            `${PLUGIN_NAME}/README.md`,
            `${PLUGIN_NAME}/assets/`
        ];
        
        const missingFiles = expectedFiles.filter(file => !zipContents.includes(file));
        
        if (missingFiles.length > 0) {
            console.error('❌ ZIP file missing expected structure:', missingFiles);
            process.exit(1);
        }
        
        console.log('✅ ZIP file structure verified');
        
        // Show ZIP file info
        const stats = fs.statSync(OUTPUT_FILE);
        console.log(`📊 ZIP file size: ${Math.round(stats.size / 1024)}KB`);
        console.log(`📁 ZIP file location: ${OUTPUT_FILE}`);
        
    } catch (error) {
        console.error('❌ Failed to verify ZIP structure:', error.message);
        process.exit(1);
    }
}

/**
 * Clean up build directory
 */
function cleanup() {
    console.log('🧹 Cleaning up...');
    
    if (fs.existsSync(BUILD_DIR)) {
        execSync(`rm -rf "${BUILD_DIR}"`);
    }
    
    console.log('✅ Cleanup completed');
}

/**
 * Main build function
 */
function main() {
    try {
        console.log('🚀 WordPress Plugin Build Process\n');
        
        setupBuildDirectories();
        copyPluginFiles();
        validatePluginHeader();
        createZipFile();
        verifyZipStructure();
        cleanup();
        
        console.log('\n🎉 WordPress plugin built successfully!');
        console.log(`📦 Plugin file: ${OUTPUT_FILE}`);
        console.log('🔗 Ready for WordPress installation');
        
    } catch (error) {
        console.error('\n❌ Plugin build failed:', error.message);
        
        // Cleanup on error
        if (fs.existsSync(BUILD_DIR)) {
            execSync(`rm -rf "${BUILD_DIR}"`);
        }
        
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    main,
    setupBuildDirectories,
    copyPluginFiles,
    validatePluginHeader,
    createZipFile,
    verifyZipStructure,
    cleanup
};