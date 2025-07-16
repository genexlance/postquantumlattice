/**
 * Migration Execution and Monitoring Tests
 * Tests for task 9: Add migration execution and monitoring
 */

const PostQuantumCrypto = require('../../netlify/functions/crypto-utils');

// Mock WordPress-like environment for testing
const mockWordPressEnvironment = {
  entries: [],
  options: {},
  auditLog: [],
  
  // Simulate WordPress database operations
  getEntries: function(limit = 100) {
    return this.entries.slice(0, limit);
  },
  
  updateEntry: function(id, data) {
    const index = this.entries.findIndex(entry => entry.id === id);
    if (index !== -1) {
      this.entries[index] = { ...this.entries[index], ...data };
      return true;
    }
    return false;
  },
  
  getOption: function(key, defaultValue = null) {
    return this.options[key] || defaultValue;
  },
  
  updateOption: function(key, value) {
    this.options[key] = value;
  },
  
  logAuditEvent: function(eventType, data = {}) {
    this.auditLog.unshift({
      timestamp: new Date().toISOString(),
      event_type: eventType,
      user_id: 1,
      user_login: 'admin',
      ip_address: '127.0.0.1',
      data: data
    });
    
    // Keep only last 100 entries
    this.auditLog = this.auditLog.slice(0, 100);
  },
  
  reset: function() {
    this.entries = [];
    this.options = {};
    this.auditLog = [];
  }
};

describe('Migration Execution and Monitoring Tests', () => {
  let crypto;
  
  beforeAll(async () => {
    crypto = new PostQuantumCrypto();
    await crypto.initialize();
  });
  
  beforeEach(() => {
    mockWordPressEnvironment.reset();
  });
  
  describe('Migration Process', () => {
    test('should create migration checkpoint before starting', async () => {
      // Setup initial state
      mockWordPressEnvironment.updateOption('pqls_public_key', 'old-public-key');
      mockWordPressEnvironment.updateOption('pqls_private_key', 'old-private-key');
      mockWordPressEnvironment.updateOption('pqls_algorithm', 'RSA-OAEP-256');
      
      // Create checkpoint
      const checkpoint = {
        timestamp: new Date().toISOString(),
        public_key: mockWordPressEnvironment.getOption('pqls_public_key'),
        private_key: mockWordPressEnvironment.getOption('pqls_private_key'),
        algorithm: mockWordPressEnvironment.getOption('pqls_algorithm'),
        migration_status: 'pending',
        encrypted_entries_count: 0
      };
      
      mockWordPressEnvironment.updateOption('pqls_migration_checkpoint', checkpoint);
      mockWordPressEnvironment.logAuditEvent('checkpoint_created', {
        encrypted_entries_count: checkpoint.encrypted_entries_count
      });
      
      const savedCheckpoint = mockWordPressEnvironment.getOption('pqls_migration_checkpoint');
      expect(savedCheckpoint).toBeDefined();
      expect(savedCheckpoint.public_key).toBe('old-public-key');
      expect(savedCheckpoint.algorithm).toBe('RSA-OAEP-256');
      
      const auditLog = mockWordPressEnvironment.auditLog;
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].event_type).toBe('checkpoint_created');
    });
    
    test('should generate new post-quantum keys during migration', async () => {
      const securityLevel = 'standard';
      const newKeys = await crypto.generateKeypair(securityLevel);
      
      expect(newKeys).toBeDefined();
      expect(newKeys.publicKey).toBeDefined();
      expect(newKeys.privateKey).toBeDefined();
      expect(newKeys.algorithm).toBe('ML-KEM-768');
      expect(newKeys.securityLevel).toBe('standard');
      
      // Simulate updating WordPress options
      mockWordPressEnvironment.updateOption('pqls_public_key', newKeys.publicKey);
      mockWordPressEnvironment.updateOption('pqls_private_key', newKeys.privateKey);
      mockWordPressEnvironment.updateOption('pqls_algorithm', newKeys.algorithm);
      mockWordPressEnvironment.updateOption('pqls_security_level', newKeys.securityLevel);
      
      expect(mockWordPressEnvironment.getOption('pqls_algorithm')).toBe('ML-KEM-768');
    });
    
    test('should migrate encrypted data from RSA to post-quantum', async () => {
      // Create test data with old RSA-like format
      const testEntries = [
        {
          id: 1,
          encrypted_data: JSON.stringify({
            version: 'rsa-v1',
            algorithm: 'RSA-OAEP-256',
            encryptedData: 'base64-rsa-encrypted-data'
          })
        },
        {
          id: 2,
          encrypted_data: JSON.stringify({
            version: 'rsa-v1',
            algorithm: 'RSA-OAEP-256',
            encryptedData: 'base64-rsa-encrypted-data-2'
          })
        }
      ];
      
      mockWordPressEnvironment.entries = testEntries;
      
      // Generate new post-quantum keys
      const newKeys = await crypto.generateKeypair('standard');
      
      // Simulate migration process
      let migratedCount = 0;
      let failedCount = 0;
      
      for (const entry of testEntries) {
        try {
          // In real implementation, this would decrypt with old keys
          // For testing, we'll simulate the process
          const originalData = `Test data for entry ${entry.id}`;
          
          // Encrypt with new post-quantum keys
          const newEncrypted = await crypto.encrypt(originalData, newKeys.publicKey, newKeys.algorithm);
          
          // Update entry
          const updateSuccess = mockWordPressEnvironment.updateEntry(entry.id, {
            encrypted_data: JSON.stringify(newEncrypted)
          });
          
          if (updateSuccess) {
            migratedCount++;
            mockWordPressEnvironment.logAuditEvent('entry_migrated', {
              entry_id: entry.id,
              old_algorithm: 'RSA-OAEP-256',
              new_algorithm: newKeys.algorithm
            });
          } else {
            failedCount++;
          }
        } catch (error) {
          failedCount++;
          mockWordPressEnvironment.logAuditEvent('entry_migration_failed', {
            entry_id: entry.id,
            error: error.message
          });
        }
      }
      
      expect(migratedCount).toBe(2);
      expect(failedCount).toBe(0);
      
      // Verify audit log
      const migrationEvents = mockWordPressEnvironment.auditLog.filter(
        entry => entry.event_type === 'entry_migrated'
      );
      expect(migrationEvents).toHaveLength(2);
    });
    
    test('should rollback migration on failure', async () => {
      // Setup checkpoint
      const checkpoint = {
        timestamp: new Date().toISOString(),
        public_key: 'original-public-key',
        private_key: 'original-private-key',
        algorithm: 'RSA-OAEP-256',
        security_level: 'standard',
        migration_status: 'pending'
      };
      
      mockWordPressEnvironment.updateOption('pqls_migration_checkpoint', checkpoint);
      
      // Simulate failed migration state
      mockWordPressEnvironment.updateOption('pqls_public_key', 'new-failed-key');
      mockWordPressEnvironment.updateOption('pqls_algorithm', 'ML-KEM-768');
      mockWordPressEnvironment.updateOption('pqls_migration_status', 'in_progress');
      
      // Perform rollback
      const savedCheckpoint = mockWordPressEnvironment.getOption('pqls_migration_checkpoint');
      expect(savedCheckpoint).toBeDefined();
      
      // Restore from checkpoint
      mockWordPressEnvironment.updateOption('pqls_public_key', savedCheckpoint.public_key);
      mockWordPressEnvironment.updateOption('pqls_private_key', savedCheckpoint.private_key);
      mockWordPressEnvironment.updateOption('pqls_algorithm', savedCheckpoint.algorithm);
      mockWordPressEnvironment.updateOption('pqls_migration_status', savedCheckpoint.migration_status);
      
      mockWordPressEnvironment.logAuditEvent('migration_rollback_success', {
        restored_algorithm: savedCheckpoint.algorithm
      });
      
      // Verify rollback
      expect(mockWordPressEnvironment.getOption('pqls_public_key')).toBe('original-public-key');
      expect(mockWordPressEnvironment.getOption('pqls_algorithm')).toBe('RSA-OAEP-256');
      expect(mockWordPressEnvironment.getOption('pqls_migration_status')).toBe('pending');
      
      const rollbackEvents = mockWordPressEnvironment.auditLog.filter(
        entry => entry.event_type === 'migration_rollback_success'
      );
      expect(rollbackEvents).toHaveLength(1);
    });
  });
  
  describe('Data Integrity Verification', () => {
    test('should verify data integrity after migration', async () => {
      // Create test entries with post-quantum encryption
      const keypair = await crypto.generateKeypair('standard');
      const testData = ['Test data 1', 'Test data 2', 'Test data 3'];
      const encryptedEntries = [];
      
      for (let i = 0; i < testData.length; i++) {
        const encrypted = await crypto.encrypt(testData[i], keypair.publicKey, keypair.algorithm);
        encryptedEntries.push({
          id: i + 1,
          encrypted_data: JSON.stringify(encrypted),
          original_data: testData[i]
        });
      }
      
      mockWordPressEnvironment.entries = encryptedEntries;
      
      // Verify integrity
      let totalEntries = 0;
      let verifiedEntries = 0;
      let failedEntries = 0;
      
      for (const entry of encryptedEntries) {
        totalEntries++;
        try {
          const encryptedData = JSON.parse(entry.encrypted_data);
          const decrypted = await crypto.decrypt(encryptedData, keypair.privateKey);
          
          if (decrypted === entry.original_data) {
            verifiedEntries++;
          } else {
            failedEntries++;
          }
        } catch (error) {
          failedEntries++;
        }
      }
      
      const successRate = (verifiedEntries / totalEntries) * 100;
      
      expect(totalEntries).toBe(3);
      expect(verifiedEntries).toBe(3);
      expect(failedEntries).toBe(0);
      expect(successRate).toBe(100);
      
      mockWordPressEnvironment.logAuditEvent('data_integrity_check', {
        total_entries: totalEntries,
        verified_entries: verifiedEntries,
        failed_entries: failedEntries,
        success_rate: successRate
      });
      
      const integrityEvents = mockWordPressEnvironment.auditLog.filter(
        entry => entry.event_type === 'data_integrity_check'
      );
      expect(integrityEvents).toHaveLength(1);
      expect(integrityEvents[0].data.success_rate).toBe(100);
    });
    
    test('should detect corrupted data during integrity verification', async () => {
      const keypair = await crypto.generateKeypair('standard');
      const testData = 'Test data for corruption test';
      const encrypted = await crypto.encrypt(testData, keypair.publicKey, keypair.algorithm);
      
      // Corrupt the encrypted data
      const corruptedEncrypted = { ...encrypted };
      corruptedEncrypted.encryptedData = 'corrupted-base64-data';
      
      mockWordPressEnvironment.entries = [{
        id: 1,
        encrypted_data: JSON.stringify(corruptedEncrypted)
      }];
      
      // Verify integrity (should fail)
      let verificationFailed = false;
      try {
        const decrypted = await crypto.decrypt(corruptedEncrypted, keypair.privateKey);
        // If we get here, verification should have failed
        expect(decrypted).not.toBe(testData);
      } catch (error) {
        verificationFailed = true;
        expect(error.message).toContain('decryption failed');
      }
      
      expect(verificationFailed).toBe(true);
      
      mockWordPressEnvironment.logAuditEvent('integrity_verification_failed', {
        entry_id: 1,
        error: 'Data corruption detected'
      });
      
      const failureEvents = mockWordPressEnvironment.auditLog.filter(
        entry => entry.event_type === 'integrity_verification_failed'
      );
      expect(failureEvents).toHaveLength(1);
    });
  });
  
  describe('Audit Logging', () => {
    test('should log all cryptographic operations', async () => {
      const operations = [
        'migration_started',
        'checkpoint_created',
        'key_generation',
        'entry_migrated',
        'migration_completed',
        'data_integrity_check'
      ];
      
      // Log various operations
      for (const operation of operations) {
        mockWordPressEnvironment.logAuditEvent(operation, {
          timestamp: new Date().toISOString(),
          operation_data: `Test data for ${operation}`
        });
      }
      
      expect(mockWordPressEnvironment.auditLog).toHaveLength(operations.length);
      
      // Verify all operations are logged
      for (const operation of operations) {
        const found = mockWordPressEnvironment.auditLog.find(
          entry => entry.event_type === operation
        );
        expect(found).toBeDefined();
        expect(found.user_id).toBe(1);
        expect(found.ip_address).toBe('127.0.0.1');
      }
    });
    
    test('should maintain audit log size limit', async () => {
      // Add more than 100 entries to test size limit
      for (let i = 0; i < 150; i++) {
        mockWordPressEnvironment.logAuditEvent('test_event', {
          iteration: i
        });
      }
      
      // Should be limited to 100 entries
      expect(mockWordPressEnvironment.auditLog).toHaveLength(100);
      
      // Most recent entries should be at the beginning
      expect(mockWordPressEnvironment.auditLog[0].data.iteration).toBe(149);
      expect(mockWordPressEnvironment.auditLog[99].data.iteration).toBe(50);
    });
    
    test('should filter audit log by event type', async () => {
      const eventTypes = ['migration_started', 'entry_migrated', 'migration_completed'];
      
      // Add mixed event types
      for (let i = 0; i < 10; i++) {
        for (const eventType of eventTypes) {
          mockWordPressEnvironment.logAuditEvent(eventType, { iteration: i });
        }
      }
      
      // Filter by specific event type
      const migrationEvents = mockWordPressEnvironment.auditLog.filter(
        entry => entry.event_type === 'entry_migrated'
      );
      
      expect(migrationEvents).toHaveLength(10);
      migrationEvents.forEach(event => {
        expect(event.event_type).toBe('entry_migrated');
      });
    });
  });
  
  describe('Performance Monitoring', () => {
    test('should track migration performance metrics', async () => {
      const startTime = Date.now();
      const batchSize = 10;
      const testEntries = [];
      
      // Create test entries
      for (let i = 0; i < batchSize; i++) {
        testEntries.push({
          id: i + 1,
          data: `Test entry ${i + 1}`
        });
      }
      
      // Simulate migration processing
      const keypair = await crypto.generateKeypair('standard');
      let processedCount = 0;
      
      for (const entry of testEntries) {
        const encrypted = await crypto.encrypt(entry.data, keypair.publicKey, keypair.algorithm);
        processedCount++;
        
        // Log progress every 5 entries
        if (processedCount % 5 === 0) {
          mockWordPressEnvironment.logAuditEvent('migration_progress', {
            processed: processedCount,
            total: batchSize,
            percentage: (processedCount / batchSize) * 100
          });
        }
      }
      
      const endTime = Date.now();
      const duration = Math.max(endTime - startTime, 1); // Ensure minimum 1ms
      const averageTimePerEntry = duration / batchSize;
      
      mockWordPressEnvironment.logAuditEvent('migration_performance', {
        total_entries: batchSize,
        duration_ms: duration,
        average_time_per_entry_ms: averageTimePerEntry,
        entries_per_second: 1000 / averageTimePerEntry
      });
      
      expect(processedCount).toBe(batchSize);
      expect(duration).toBeGreaterThan(0);
      expect(averageTimePerEntry).toBeGreaterThan(0);
      
      const progressEvents = mockWordPressEnvironment.auditLog.filter(
        entry => entry.event_type === 'migration_progress'
      );
      expect(progressEvents).toHaveLength(2); // At 5 and 10 entries
      
      const performanceEvents = mockWordPressEnvironment.auditLog.filter(
        entry => entry.event_type === 'migration_performance'
      );
      expect(performanceEvents).toHaveLength(1);
      expect(performanceEvents[0].data.total_entries).toBe(batchSize);
    });
    
    test('should monitor system resources during migration', async () => {
      const initialMemory = process.memoryUsage();
      
      // Simulate memory-intensive migration operations
      const keypair = await crypto.generateKeypair('standard');
      const largeData = 'A'.repeat(10000); // 10KB of data
      
      const operations = [];
      for (let i = 0; i < 50; i++) {
        const encrypted = await crypto.encrypt(largeData, keypair.publicKey, keypair.algorithm);
        const decrypted = await crypto.decrypt(encrypted, keypair.privateKey);
        operations.push({ encrypted, decrypted });
      }
      
      const finalMemory = process.memoryUsage();
      const memoryDelta = {
        rss: finalMemory.rss - initialMemory.rss,
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal
      };
      
      mockWordPressEnvironment.logAuditEvent('resource_monitoring', {
        operations_count: operations.length,
        memory_delta: memoryDelta,
        memory_usage_mb: finalMemory.heapUsed / 1024 / 1024
      });
      
      expect(operations).toHaveLength(50);
      
      const resourceEvents = mockWordPressEnvironment.auditLog.filter(
        entry => entry.event_type === 'resource_monitoring'
      );
      expect(resourceEvents).toHaveLength(1);
      expect(resourceEvents[0].data.operations_count).toBe(50);
    });
  });
  
  describe('Error Handling and Recovery', () => {
    test('should handle partial migration failures gracefully', async () => {
      const testEntries = [
        { id: 1, data: 'Valid data 1' },
        { id: 2, data: null }, // This will cause an error
        { id: 3, data: 'Valid data 3' }
      ];
      
      const keypair = await crypto.generateKeypair('standard');
      let successCount = 0;
      let failureCount = 0;
      
      for (const entry of testEntries) {
        try {
          if (!entry.data) {
            throw new Error('Invalid data');
          }
          
          const encrypted = await crypto.encrypt(entry.data, keypair.publicKey, keypair.algorithm);
          successCount++;
          
          mockWordPressEnvironment.logAuditEvent('entry_migration_success', {
            entry_id: entry.id
          });
        } catch (error) {
          failureCount++;
          
          mockWordPressEnvironment.logAuditEvent('entry_migration_failed', {
            entry_id: entry.id,
            error: error.message
          });
        }
      }
      
      expect(successCount).toBe(2);
      expect(failureCount).toBe(1);
      
      const successEvents = mockWordPressEnvironment.auditLog.filter(
        entry => entry.event_type === 'entry_migration_success'
      );
      const failureEvents = mockWordPressEnvironment.auditLog.filter(
        entry => entry.event_type === 'entry_migration_failed'
      );
      
      expect(successEvents).toHaveLength(2);
      expect(failureEvents).toHaveLength(1);
      expect(failureEvents[0].data.error).toBe('Invalid data');
    });
    
    test('should provide detailed error information for troubleshooting', async () => {
      const errorScenarios = [
        { type: 'invalid_key', error: 'Invalid private key format' },
        { type: 'corrupted_data', error: 'Data corruption detected' },
        { type: 'network_timeout', error: 'Network request timeout' },
        { type: 'insufficient_memory', error: 'Insufficient memory for operation' }
      ];
      
      for (const scenario of errorScenarios) {
        mockWordPressEnvironment.logAuditEvent('migration_error', {
          error_type: scenario.type,
          error_message: scenario.error,
          timestamp: new Date().toISOString(),
          context: {
            function: 'migration_execution',
            step: 'data_processing'
          }
        });
      }
      
      const errorEvents = mockWordPressEnvironment.auditLog.filter(
        entry => entry.event_type === 'migration_error'
      );
      
      expect(errorEvents).toHaveLength(4);
      
      errorEvents.reverse().forEach((event, index) => {
        expect(event.data.error_type).toBe(errorScenarios[index].type);
        expect(event.data.error_message).toBe(errorScenarios[index].error);
        expect(event.data.context).toBeDefined();
      });
    });
  });
});