/**
 * SpreadsheetManager type definitions
 * 
 * IIFE-wrapped class pattern following RideManager-style (no namespace nesting)
 */

/**
 * SpreadsheetManager class - Low-level spreadsheet access via bmPreFiddler
 */
declare class SpreadsheetManager {
    /**
     * Gets a fiddler based on the sheet name.
     * @param sheetName - the name of the sheet from Bootstrap
     * @returns The fiddler instance
     */
    static getFiddler(sheetName: string): Fiddler<any>;

    /**
     * Clear cached fiddler(s). Call when external code may have modified the sheet.
     * @param sheetName - Specific sheet to clear, or omit to clear all
     */
    static clearFiddlerCache(sheetName?: string): void;

    /**
     * Returns the data from a fiddler with formulas merged into it.
     * @param fiddler - The fiddler to get data from
     * @returns The merged data
     */
    static getDataWithFormulas<T>(fiddler: Fiddler<T>): T[];

    /**
     * Converts links in a sheet to hyperlinks.
     * @param sheetName - The name of the sheet
     */
    static convertLinks(sheetName: string): void;

    /**
     * Get a sheet directly by name (replaces fiddler for simpler access)
     * @param sheetName - Name of the sheet from Bootstrap
     * @returns The sheet instance
     */
    static getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet;
}

export = SpreadsheetManager;
