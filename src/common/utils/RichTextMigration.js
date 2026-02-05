/**
 * RichTextMigration - Utility to convert HYPERLINK formulas to native RichText
 * 
 * Purpose: One-time migration to replace formula-based links with native RichText
 * Run this ONCE per sheet before removing Fiddler dependency
 * 
 * Layer: Utility (can use AppLogger)
 * 
 * Pattern: IIFE-wrapped class with static methods (per gas-best-practices.md)
 */

var RichTextMigration = (function() {
  
  /**
   * Migrate HYPERLINK formulas to native RichText for specified columns
   * 
   * @param {string} sheetName - Bootstrap sheet name
   * @param {string[]} columnNames - Column names containing HYPERLINK formulas
   * @returns {{success: boolean, migratedCount: number, errors: string[]}} Migration result
   */
  function migrateFormulasToRichText(sheetName, columnNames) {
    const errors = [];
    let migratedCount = 0;
    
    try {
      AppLogger.info('RichTextMigration', `Starting migration for ${sheetName}, columns: ${columnNames.join(', ')}`);
      
      const sheet = SheetAccess.getSheet(sheetName);
      const dataRange = sheet.getDataRange();
      const headers = dataRange.getValues()[0];
      const formulas = dataRange.getFormulas();
      
      // Find column indices
      const columnIndices = columnNames.map(colName => {
        const index = headers.indexOf(colName);
        if (index === -1) {
          errors.push(`Column ${colName} not found in ${sheetName}`);
        }
        return { name: colName, index };
      }).filter(col => col.index !== -1);
      
      if (columnIndices.length === 0) {
        AppLogger.warn('RichTextMigration', `No valid columns found for migration in ${sheetName}`);
        return { success: false, migratedCount: 0, errors };
      }
      
      // Process each column
      for (const { name, index } of columnIndices) {
        AppLogger.info('RichTextMigration', `Processing column ${name} at index ${index}`);
        
        // Process each row (skip header row at index 0)
        for (let row = 1; row < formulas.length; row++) {
          const formula = formulas[row][index];
          
          // Skip if not a formula or not a hyperlink formula
          if (!formula || typeof formula !== 'string' || !formula.toLowerCase().startsWith('=hyperlink(')) {
            continue;
          }
          
          // Parse: =hyperlink("URL", "TEXT") or =HYPERLINK("URL", "TEXT")
          const match = formula.match(/=hyperlink\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/i);
          if (!match) {
            errors.push(`Row ${row + 1}, column ${name}: Failed to parse formula: ${formula}`);
            continue;
          }
          
          const [, url, text] = match;
          
          try {
            // Create RichText with link
            const richText = SpreadsheetApp.newRichTextValue()
              .setText(text)
              .setLinkUrl(url)
              .build();
            
            // Update the cell (row + 1 for 1-based indexing)
            sheet.getRange(row + 1, index + 1).setRichTextValue(richText);
            migratedCount++;
          } catch (err) {
            errors.push(`Row ${row + 1}, column ${name}: Failed to create RichText: ${err.message}`);
          }
        }
      }
      
      SpreadsheetApp.flush();
      AppLogger.info('RichTextMigration', `Completed migration for ${sheetName}: ${migratedCount} cells converted`);
      
      return { success: errors.length === 0, migratedCount, errors };
      
    } catch (error) {
      AppLogger.error('RichTextMigration', `Migration failed for ${sheetName}: ${error.message}`);
      errors.push(`Fatal error: ${error.message}`);
      return { success: false, migratedCount, errors };
    }
  }
  
  class RichTextMigration {
    /**
     * Run migration for known sheets with formula links
     * 
     * @returns {{[sheetName: string]: {success: boolean, migratedCount: number, errors: string[]}}} Results per sheet
     */
    static runFullMigration() {
      AppLogger.info('RichTextMigration', 'Starting full migration of all known sheets');
      
      const results = {};
      
      // Transactions: Payable Order ID column
      try {
        results['Transactions'] = migrateFormulasToRichText('Transactions', ['Payable Order ID']);
      } catch (error) {
        results['Transactions'] = { 
          success: false, 
          migratedCount: 0, 
          errors: [`Failed to migrate: ${error.message}`]
        };
      }
      
      // ActionSpecs: Body column
      try {
        results['ActionSpecs'] = migrateFormulasToRichText('ActionSpecs', ['Body']);
      } catch (error) {
        results['ActionSpecs'] = { 
          success: false, 
          migratedCount: 0, 
          errors: [`Failed to migrate: ${error.message}`]
        };
      }
      
      // MigratingMembers: Check if sheet exists and has link columns
      try {
        // Try to access the sheet - if it doesn't exist, skip it
        const migMembers = SheetAccess.getSheet('MigratingMembers');
        if (migMembers) {
          // If you know specific columns with links, list them here
          // For now, skip migration for this sheet
          results['MigratingMembers'] = { 
            success: true, 
            migratedCount: 0, 
            errors: ['Skipped - no known link columns']
          };
        }
      } catch (error) {
        // Sheet doesn't exist or not configured - skip it
        results['MigratingMembers'] = { 
          success: true, 
          migratedCount: 0, 
          errors: ['Sheet not found - skipped']
        };
      }
      
      AppLogger.info('RichTextMigration', `Full migration completed. Results: ${JSON.stringify(results)}`);
      // @ts-ignore - results object has specific keys, not a generic index signature
      return results;
    }
    
    /**
     * Migrate a specific sheet with specified columns
     * 
     * @param {string} sheetName - Bootstrap sheet name
     * @param {string[]} columnNames - Column names containing HYPERLINK formulas
     * @returns {{success: boolean, migratedCount: number, errors: string[]}} Migration result
     */
    static migrate(sheetName, columnNames) {
      return migrateFormulasToRichText(sheetName, columnNames);
    }
  }
  
  return RichTextMigration;
})();

// Node.js module export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RichTextMigration };
}
