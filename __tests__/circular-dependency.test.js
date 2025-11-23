/**
 * Tests to prevent circular dependencies in foundational modules
 * 
 * These tests validate that low-level infrastructure modules (Layer 0) do not use
 * high-level logging that depends on them, which would create infinite loops.
 */

const fs = require('fs');
const path = require('path');

describe('Circular Dependency Guards', () => {
  describe('Properties module', () => {
    it('should not call Common.Logger methods (except in comments)', () => {
      const propertiesPath = path.join(__dirname, '../src/common/config/Properties.js');
      const propertiesSource = fs.readFileSync(propertiesPath, 'utf8');
      
      // Remove comments to avoid false positives
      const sourceWithoutComments = propertiesSource
        .replace(/\/\/.*$/gm, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
      
      // Check for Common.Logger usage (should only be in comments, which we removed)
      const loggerCallPattern = /Common\.Logger\.(debug|info|warn|error)\s*\(/g;
      const matches = sourceWithoutComments.match(loggerCallPattern);
      
      if (matches) {
        fail(`Found ${matches.length} Common.Logger call(s) in Properties.js: ${matches.join(', ')}\n` +
             'Properties module must use Logger.log() only to avoid circular dependencies.');
      }
      
      expect(matches).toBeNull();
    });
    
    it('should have circular dependency guard flag', () => {
      const propertiesPath = path.join(__dirname, '../src/common/config/Properties.js');
      const propertiesSource = fs.readFileSync(propertiesPath, 'utf8');
      
      expect(propertiesSource).toContain('_isLoadingProperties');
      expect(propertiesSource).toContain('CIRCULAR DEPENDENCY DETECTED');
    });
  });
  
  describe('SpreadsheetManager module', () => {
    it('should not call Common.Logger methods (except in comments)', () => {
      const smPath = path.join(__dirname, '../src/common/data/storage/SpreadsheetManager.js');
      const smSource = fs.readFileSync(smPath, 'utf8');
      
      // Remove comments to avoid false positives
      const sourceWithoutComments = smSource
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      
      // Check for Common.Logger usage
      const loggerCallPattern = /Common\.Logger\.(debug|info|warn|error)\s*\(/g;
      const matches = sourceWithoutComments.match(loggerCallPattern);
      
      if (matches) {
        fail(`Found ${matches.length} Common.Logger call(s) in SpreadsheetManager.js: ${matches.join(', ')}\n` +
             'SpreadsheetManager module must use Logger.log() only to avoid circular dependencies.');
      }
      
      expect(matches).toBeNull();
    });
    
    it('should have documentation warning about Common.Logger', () => {
      const smPath = path.join(__dirname, '../src/common/data/storage/SpreadsheetManager.js');
      const smSource = fs.readFileSync(smPath, 'utf8');
      
      expect(smSource).toContain('CRITICAL');
      expect(smSource).toContain('MUST NOT use Common.Logger');
    });
  });
  
  describe('Logger module', () => {
    it('should use static configuration instead of dynamic lookups', () => {
      const loggerPath = path.join(__dirname, '../src/common/utils/Logger.js');
      const loggerSource = fs.readFileSync(loggerPath, 'utf8');
      
      // Should have static CONFIG object
      expect(loggerSource).toContain('let CONFIG =');
      expect(loggerSource).toContain('let currentLogLevel =');
      
      // Should have configure function
      expect(loggerSource).toContain('Common.Logger.configure');
      expect(loggerSource).toContain('loadConfiguration');
    });
    
    it('should support namespace filtering', () => {
      const loggerPath = path.join(__dirname, '../src/common/utils/Logger.js');
      const loggerSource = fs.readFileSync(loggerPath, 'utf8');
      
      expect(loggerSource).toContain('isNamespaceEnabled');
      expect(loggerSource).toContain('NAMESPACES');
    });
    
    it('should use SpreadsheetManager.getFiddler for SystemLogs', () => {
      const loggerPath = path.join(__dirname, '../src/common/utils/Logger.js');
      const loggerSource = fs.readFileSync(loggerPath, 'utf8');
      
      // Should have getLogFiddler function that uses SpreadsheetManager
      expect(loggerSource).toContain('getLogFiddler');
      expect(loggerSource).toContain("getFiddler('SystemLogs')");
    });
    
    it('should have fallback for when SpreadsheetManager is not available', () => {
      const loggerPath = path.join(__dirname, '../src/common/utils/Logger.js');
      const loggerSource = fs.readFileSync(loggerPath, 'utf8');
      
      // Should have legacy fallback function
      expect(loggerSource).toContain('getLogSheetFallback');
    });
    
    it('should document that it is a foundational file', () => {
      const loggerPath = path.join(__dirname, '../src/common/utils/Logger.js');
      const loggerSource = fs.readFileSync(loggerPath, 'utf8');
      
      expect(loggerSource).toContain('FOUNDATIONAL FILE');
      expect(loggerSource).toContain('Bootstrap');
    });
    
    it('should not call Common.Logger methods in internal functions (except in comments)', () => {
      const loggerPath = path.join(__dirname, '../src/common/utils/Logger.js');
      const loggerSource = fs.readFileSync(loggerPath, 'utf8');
      
      // Remove comments to avoid false positives
      const sourceWithoutComments = loggerSource
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      
      // Look for Common.Logger usage in internal functions (before the public API definitions)
      // We expect Common.Logger to be defined/assigned, but not called in internal functions
      const beforePublicApi = sourceWithoutComments.split('Common.Logger.debug =')[0];
      
      // Check for Common.Logger method calls (not assignments)
      const loggerCallPattern = /Common\.Logger\.(debug|info|warn|error|configure|setLevel|getLogs|clearLogs)\s*\([^=]/g;
      const matches = beforePublicApi.match(loggerCallPattern);
      
      if (matches) {
        fail(`Found ${matches.length} Common.Logger call(s) in Logger.js internal functions: ${matches.join(', ')}\n` +
             'Logger internal functions must use Logger.log() only to avoid circular dependencies.');
      }
      
      expect(matches).toBeNull();
    });
  });
});
