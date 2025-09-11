/**
 * Represents a data management utility for a spreadsheet.
 * @template T The type of data objects managed by the Fiddler.
 */
interface Fiddler<T> {
  getData(): T[];
  setData(data: T[]): Fiddler<T>;
  dumpValues(): void;
  getSheet(): GoogleAppsScript.Spreadsheet.Sheet;
}

interface BootstrapData {
    Reference: string;
    id: string;
    sheetName: string;
    createIfMissing: boolean;
}
// Interfaces for specific data types for better type-checking
interface FormResponse {
    timestamp: Date;
    'VOTING TOKEN': string;
    // ... other properties from your form
}


interface Result {
    'Voter Email': string;
}


// -----------------------------------------------------------------------------
// FiddlerOptions and Overload Types
// -----------------------------------------------------------------------------

/**
 * A generic type for the options object passed to getFiddler().
 */
interface FiddlerOptions {
  id?: string;
  sheetName?: string;
  createIfMissing?: boolean;
}

/**
 * Specific options for getting a Fiddler for 'Form Responses'.
 * The 'sheetName' is a string literal, providing a precise type.
 */
interface FormResponsesOptions {
  id: string;
  sheetName: 'Form Responses 1';
  createIfMissing?: boolean;
}

/**
 * Options for getting a Fiddler for 'Bootstrap'.
 */
interface BootStrapOptions {
  id: '1EF3swXKvLv6jPz0cxC7J1al8m0vk9cWOx5t9W0LEy2g'
  sheetName: 'Bootstrap';
  createIfMissing?: boolean;
}
/**
 * Options for getting a Fiddler for 'Validated Results'.
 */
interface ValidResultsOptions {
  id: string;
  sheetName: 'Validated Results';
  createIfMissing?: boolean;
}


interface InvalidResultsOptions {
  id: string;
  sheetName: 'Invalid Results';
  createIfMissing?: boolean;
}
// -----------------------------------------------------------------------------
// Core bmPreFiddler API Declarations
// -----------------------------------------------------------------------------

declare namespace bmPreFiddler {

  /**
   * Represents the object returned by bmPreFiddler.PreFiddler().
   * This class holds the core data fetching logic.
   */
  class PreFiddlerService {
    // Function overloads for a specific, type-safe return
    // The most specific signatures come first.
    getFiddler(options: FormResponsesOptions): Fiddler<FormResponse>;
    getFiddler(options: BootStrapOptions): Fiddler<BootstrapData>;
    getFiddler(options: ValidResultsOptions): Fiddler<Result>;
    getFiddler(options: InvalidResultsOptions): Fiddler<Result>;
    // Add more overloads as needed for other specific sheet names

    /**
     * The general function signature that acts as the implementation.
     * This is the fallback for any sheet name that doesn't have a specific overload.
     */
    getFiddler(options: FiddlerOptions): Fiddler<object>;
  }

  /**
   * The entry point for the library.
   * Returns a new instance of the PreFiddlerService.
   * @returns {PreFiddlerService}
   */
  function PreFiddler(): PreFiddlerService;
}
