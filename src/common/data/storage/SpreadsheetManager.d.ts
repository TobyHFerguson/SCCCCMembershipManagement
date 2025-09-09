/**
 * Common.Data.Storage.SpreadsheetManager type definitions
 */
declare namespace Common.Data.Storage {
    namespace SpreadsheetManager {
        /**
         * Gets a fiddler based on the sheet name.
         * @param {string} sheetName - The name of the sheet.
         * @returns {Fiddler} The fiddler instance for the sheet.
         */
        function getFiddler(sheetName: string): Fiddler<object>;

        /**
         * Returns the data from a fiddler with formulas merged into it.
         * @param {Fiddler} fiddler - The fiddler instance.
         * @returns {object[]} The merged data array.
         */
        function getDataWithFormulas(fiddler: Fiddler<object>): object[];

        /**
         * Converts links in a sheet to hyperlinks.
         * @param {string} sheetName - The name of the sheet.
         * @returns {void}
         */
        function convertLinks(sheetName: string): void;
    }
}
