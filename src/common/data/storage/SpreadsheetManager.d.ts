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
     * Get a sheet directly by name from Bootstrap
     * @param sheetName - Name of the sheet from Bootstrap
     * @returns The sheet instance
     */
    static getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet;

    /**
     * Get a sheet by spreadsheet ID and sheet name (for dynamic/external spreadsheets not in Bootstrap)
     * @param spreadsheetId - The spreadsheet ID to open
     * @param sheetName - The name of the sheet tab within the spreadsheet
     * @param createIfMissing - Whether to create the sheet if it doesn't exist (default: false)
     * @returns The sheet instance
     */
    static getSheetById(spreadsheetId: string, sheetName: string, createIfMissing?: boolean): GoogleAppsScript.Spreadsheet.Sheet;
}

export = SpreadsheetManager;
