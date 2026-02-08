/**
 * ValidatedElection class type declarations
 * 
 * Provides type-safe election data handling with constructor validation.
 */

/**
 * ValidatedElection class
 * Ensures all election records have proper structure and enforces validation at the class level.
 */
declare class ValidatedElection {
  /**
   * Election title (required)
   */
  Title: string;

  /**
   * Start date (optional)
   */
  Start: Date | null;

  /**
   * End date (optional, must be >= Start if both present)
   */
  End: Date | null;

  /**
   * Form edit URL (optional)
   */
  'Form Edit URL': string;

  /**
   * Election officers comma-separated emails (optional)
   */
  'Election Officers': string;

  /**
   * Trigger ID (optional)
   */
  TriggerId: string;

  /**
   * Constructor
   * @param title - Election title (required, non-empty)
   * @param start - Start date (optional, must be valid Date or parseable string if provided)
   * @param end - End date (optional, must be valid Date or parseable string if provided, must be >= start if both present)
   * @param formEditUrl - Form edit URL (optional)
   * @param electionOfficers - Election officers comma-separated emails (optional)
   * @param triggerId - Trigger ID (optional)
   * @throws {Error} If validation fails
   */
  constructor(
    title: string,
    start: Date | string | null,
    end: Date | string | null,
    formEditUrl: string,
    electionOfficers: string,
    triggerId: string
  );

  /**
   * Convert ValidatedElection to array format for serialization/testing
   * 
   * NOTE: This is for serialization/testing ONLY. For sheet persistence,
   * use sheetHeaders.map(h => election[h]) to ensure column-order independence.
   * 
   * @returns Array with 6 elements matching HEADERS order
   */
  toArray(): Array<string | Date | null>;

  /**
   * Column headers constant
   */
  static readonly HEADERS: readonly string[];

  /**
   * Static factory method - never throws, returns null on failure
   * 
   * CRITICAL: Column-order independent. Uses header-based lookup, not positional indexing.
   * 
   * @param rowArray - Row data as array
   * @param headers - Column headers (can be in any order)
   * @param rowNumber - Row number for error reporting (1-based, includes header)
   * @param errorCollector - Optional object to collect errors
   * @returns ValidatedElection instance or null on failure
   */
  static fromRow(
    rowArray: Array<any>,
    headers: Array<string>,
    rowNumber: number,
    errorCollector?: { errors: string[]; rowNumbers: number[] }
  ): ValidatedElection | null;

  /**
   * Batch validation with consolidated email alert
   * 
   * @param rows - Array of row data (without headers)
   * @param headers - Column headers
   * @param context - Context string for error reporting
   * @returns Array of valid ValidatedElection instances
   */
  static validateRows(
    rows: Array<Array<any>>,
    headers: Array<string>,
    context: string
  ): Array<ValidatedElection>;
}
