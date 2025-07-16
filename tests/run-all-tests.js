#!/usr/bin/env node

/**
 * Comprehensive test runner for Post-Quantum Lattice Shield
 * Runs all test suites and generates a summary report
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class TestRunner {
  constructor() {
    this.results = {
      unit: null,
      integration: null,
      security: null,
      performance: null,
      coverage: null
    };
    this.startTime = Date.now();
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async runTestSuite(suiteName, command, description) {
    this.log(`\n${'='.repeat(60)}`, 'cyan');
    this.log(`Running ${suiteName.toUpperCase()} Tests`, 'bright');
    this.log(`${description}`, 'blue');
    this.log(`${'='.repeat(60)}`, 'cyan');

    const startTime = Date.now();
    
    try {
      const output = execSync(command, { 
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      
      const duration = Date.now() - startTime;
      
      this.results[suiteName] = {
        status: 'PASSED',
        duration: duration,
        output: output
      };
      
      this.log(`✅ ${suiteName.toUpperCase()} tests completed successfully in ${duration}ms`, 'green');
      
      // Extract test statistics from Jest output
      const stats = this.extractTestStats(output);
      if (stats) {
        this.log(`   Tests: ${stats.tests}, Passed: ${stats.passed}, Failed: ${stats.failed}`, 'blue');
      }
      
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results[suiteName] = {
        status: 'FAILED',
        duration: duration,
        error: error.message,
        output: error.stdout || error.stderr || ''
      };
      
      this.log(`❌ ${suiteName.toUpperCase()} tests failed after ${duration}ms`, 'red');
      this.log(`Error: ${error.message}`, 'red');
      
      return false;
    }
  }

  extractTestStats(output) {
    // Extract Jest test statistics from output
    const testMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (testMatch) {
      return {
        failed: parseInt(testMatch[1]),
        passed: parseInt(testMatch[2]),
        tests: parseInt(testMatch[3])
      };
    }
    
    const passMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (passMatch) {
      return {
        failed: 0,
        passed: parseInt(passMatch[1]),
        tests: parseInt(passMatch[2])
      };
    }
    
    return null;
  }

  async runAllTests() {
    this.log('🚀 Starting Post-Quantum Lattice Shield Test Suite', 'bright');
    this.log(`Started at: ${new Date().toISOString()}`, 'blue');

    // Check if OQS library is available
    await this.checkOQSAvailability();

    // Run test suites in order
    const testSuites = [
      {
        name: 'unit',
        command: 'npm run test:unit',
        description: 'Unit tests for crypto utilities and individual functions'
      },
      {
        name: 'integration',
        command: 'npm run test:integration',
        description: 'Integration tests for WordPress-Netlify communication'
      },
      {
        name: 'security',
        command: 'npm run test:security',
        description: 'Security tests for cryptographic strength and randomness'
      },
      {
        name: 'performance',
        command: 'npm run test:performance',
        description: 'Performance benchmarks for form submission latency'
      }
    ];

    let allPassed = true;
    
    for (const suite of testSuites) {
      const passed = await this.runTestSuite(suite.name, suite.command, suite.description);
      if (!passed) {
        allPassed = false;
      }
      
      // Small delay between test suites
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Run coverage analysis
    await this.runCoverageAnalysis();

    // Generate final report
    this.generateFinalReport(allPassed);
    
    return allPassed;
  }

  async checkOQSAvailability() {
    this.log('\n🔍 Checking OQS Library Availability', 'yellow');
    
    try {
      const testScript = `
        const PostQuantumCrypto = require('./netlify/functions/crypto-utils');
        const pqCrypto = new PostQuantumCrypto();
        pqCrypto.initialize().then(() => {
          console.log('OQS library is available and functional');
          process.exit(0);
        }).catch((error) => {
          console.log('OQS library not available:', error.message);
          process.exit(1);
        });
      `;
      
      fs.writeFileSync('/tmp/oqs-check.js', testScript);
      execSync('node /tmp/oqs-check.js', { stdio: 'pipe' });
      
      this.log('✅ OQS library is available - all tests will run normally', 'green');
    } catch (error) {
      this.log('⚠️  OQS library not available - some tests will be skipped', 'yellow');
      this.log('   This is expected in environments without the OQS library installed', 'blue');
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync('/tmp/oqs-check.js');
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  async runCoverageAnalysis() {
    this.log('\n📊 Running Code Coverage Analysis', 'magenta');
    
    try {
      const output = execSync('npm run test:coverage', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      this.results.coverage = {
        status: 'COMPLETED',
        output: output
      };
      
      // Extract coverage percentages
      const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);
      if (coverageMatch) {
        const coverage = {
          statements: parseFloat(coverageMatch[1]),
          branches: parseFloat(coverageMatch[2]),
          functions: parseFloat(coverageMatch[3]),
          lines: parseFloat(coverageMatch[4])
        };
        
        this.results.coverage.metrics = coverage;
        
        this.log('✅ Coverage analysis completed', 'green');
        this.log(`   Statements: ${coverage.statements}%, Branches: ${coverage.branches}%`, 'blue');
        this.log(`   Functions: ${coverage.functions}%, Lines: ${coverage.lines}%`, 'blue');
      }
    } catch (error) {
      this.results.coverage = {
        status: 'FAILED',
        error: error.message
      };
      this.log('❌ Coverage analysis failed', 'red');
    }
  }

  generateFinalReport(allPassed) {
    const totalDuration = Date.now() - this.startTime;
    
    this.log('\n' + '='.repeat(80), 'cyan');
    this.log('📋 FINAL TEST REPORT', 'bright');
    this.log('='.repeat(80), 'cyan');
    
    this.log(`\nOverall Status: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`, allPassed ? 'green' : 'red');
    this.log(`Total Duration: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`, 'blue');
    this.log(`Completed at: ${new Date().toISOString()}`, 'blue');
    
    this.log('\n📊 Test Suite Results:', 'bright');
    
    for (const [suiteName, result] of Object.entries(this.results)) {
      if (!result || suiteName === 'coverage') continue;
      
      const status = result.status === 'PASSED' ? '✅' : '❌';
      const color = result.status === 'PASSED' ? 'green' : 'red';
      
      this.log(`  ${status} ${suiteName.toUpperCase()}: ${result.status} (${result.duration}ms)`, color);
    }
    
    if (this.results.coverage && this.results.coverage.metrics) {
      this.log('\n📈 Code Coverage:', 'bright');
      const metrics = this.results.coverage.metrics;
      
      Object.entries(metrics).forEach(([metric, value]) => {
        const color = value >= 80 ? 'green' : value >= 60 ? 'yellow' : 'red';
        const status = value >= 80 ? '✅' : value >= 60 ? '⚠️' : '❌';
        this.log(`  ${status} ${metric}: ${value}%`, color);
      });
    }
    
    // Generate recommendations
    this.generateRecommendations();
    
    // Save detailed report to file
    this.saveDetailedReport();
  }

  generateRecommendations() {
    this.log('\n💡 Recommendations:', 'bright');
    
    const failedSuites = Object.entries(this.results)
      .filter(([name, result]) => result && result.status === 'FAILED')
      .map(([name]) => name);
    
    if (failedSuites.length === 0) {
      this.log('  🎉 All tests passed! Your post-quantum implementation is working correctly.', 'green');
    } else {
      this.log('  🔧 The following areas need attention:', 'yellow');
      failedSuites.forEach(suite => {
        this.log(`     - Review ${suite} test failures and fix underlying issues`, 'yellow');
      });
    }
    
    if (this.results.coverage && this.results.coverage.metrics) {
      const lowCoverage = Object.entries(this.results.coverage.metrics)
        .filter(([metric, value]) => value < 80)
        .map(([metric]) => metric);
      
      if (lowCoverage.length > 0) {
        this.log('  📊 Consider improving test coverage for:', 'yellow');
        lowCoverage.forEach(metric => {
          this.log(`     - ${metric} (currently ${this.results.coverage.metrics[metric]}%)`, 'yellow');
        });
      }
    }
    
    this.log('\n  📚 For more information:', 'blue');
    this.log('     - Check individual test outputs for detailed error messages', 'blue');
    this.log('     - Review the generated coverage report in ./coverage/', 'blue');
    this.log('     - Ensure OQS library is properly installed for full functionality', 'blue');
  }

  saveDetailedReport() {
    const reportData = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      results: this.results,
      summary: {
        totalSuites: Object.keys(this.results).length - 1, // Exclude coverage
        passedSuites: Object.values(this.results).filter(r => r && r.status === 'PASSED').length,
        failedSuites: Object.values(this.results).filter(r => r && r.status === 'FAILED').length
      }
    };
    
    try {
      const reportPath = path.join(__dirname, 'test-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
      this.log(`\n💾 Detailed report saved to: ${reportPath}`, 'blue');
    } catch (error) {
      this.log(`\n❌ Failed to save detailed report: ${error.message}`, 'red');
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = TestRunner;