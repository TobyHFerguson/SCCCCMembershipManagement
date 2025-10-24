/// <reference path="../../../types/global.d.ts" />

// All SpreadsheetManager types are now defined in global.d.ts
// This file exists for backward compatibility and explicit referencing

declare namespace Common.Data.Storage {
    namespace SpreadsheetManager {
        // Most specific overloads first
        function getFiddler(sheetName: 'Tokens'): Fiddler<TokenDataType>;
        function getFiddler(sheetName: 'Elections'): Fiddler<VotingService.Election>;
        function getFiddler(sheetName: 'Form Responses 1'): Fiddler<FormResponse>;
        function getFiddler(sheetName: 'Validated Results'): Fiddler<Result>;
        function getFiddler(sheetName: 'Invalid Results'): Fiddler<Result>;
        function getFiddler(sheetName: 'Bootstrap'): Fiddler<BootstrapData>;
        
        /**
         * Gets a fiddler based on the sheet name.
         * @param {string} sheetName - The name of the sheet.
         * @returns {Fiddler} The fiddler instance for the sheet.
         */
        function getFiddler(sheetName: string): Fiddler<object>;

        /**
         * Returns the data from a fiddler with formulas merged into it.
         * @template T
         * @param {Fiddler<T>} fiddler - The fiddler instance.
         * @returns {T[]} The merged data array.
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
