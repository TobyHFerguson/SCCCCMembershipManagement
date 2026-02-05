/**
 * SpreadsheetManager type definitions
 * 
 * IIFE-wrapped class pattern following RideManager-style (no namespace nesting)
 */

/**
 * SpreadsheetManager class - Low-level spreadsheet access
 */
declare class SpreadsheetManager {
    /**
     * Converts links in a sheet to hyperlinks.
     * @param sheetName - The name of the sheet
     */
    static convertLinks(sheetName: string): void;

    /**
     * Get a sheet directly by name
     * @param sheetName - Name of the sheet from Bootstrap
     * @returns The sheet instance
     */
    static getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet;
}

export = SpreadsheetManager;
