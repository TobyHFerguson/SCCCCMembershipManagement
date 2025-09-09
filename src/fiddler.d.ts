/**
 * @description Represents a data management utility for a spreadsheet.
 * @template T The type of data objects managed by the Fiddler.
 */
interface Fiddler<T> {
    /**
     * Retrieves data from the spreadsheet.
     * @returns {T[]} An array of objects with type T.
     */
    getData(): T[];

    /**
     * Sets data in the spreadsheet.
     * @param {T[]} data The data to set.
     * @returns {Fiddler<T>} The Fiddler instance for method chaining.
     */
    setData(data: T[]): Fiddler<T>;

    /**
     * Dumps the data to the spreadsheet.
     * @returns {void}
     */
    dumpValues(): void;
}