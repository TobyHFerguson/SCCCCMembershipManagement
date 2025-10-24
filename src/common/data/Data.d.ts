declare namespace Common.Data {
    namespace Storage {
        namespace SpreadsheetManager {
            /**
             * Retrieves a Fiddler instance for the specified sheet.
             * @param {string} sheetName - The name of the sheet.
             * @returns {Fiddler} The Fiddler instance for the sheet.
             */
            function getFiddler(sheetName: string): Fiddler<Object>;
        }
    }
}
