/**
 * Type definitions for ValidatedActionSpec class
 */

/**
 * ValidatedActionSpec - Type-safe action specification with validation
 */
declare class ValidatedActionSpec {
  /**
   * Action type (e.g., 'Join', 'Renew', 'Expiry1', etc.)
   */
  Type: string;
  
  /**
   * Email subject line template
   */
  Subject: string;
  
  /**
   * Email body template (may be string or RichText object with {text, url})
   */
  Body: string | { text: string; url: string };
  
  /**
   * Days offset for expiry actions (optional)
   */
  Offset: number | null;
  
  /**
   * Comma-separated group names to add (optional)
   */
  GroupsToAdd: string | null;
  
  /**
   * Comma-separated group names to remove (optional)
   */
  GroupsToRemove: string | null;
  
  /**
   * Constructor
   * @param type - Action type (required, must be one of known ActionTypes)
   * @param subject - Email subject line (required)
   * @param body - Email body (required, may be string or RichText object)
   * @param offset - Days offset for expiry actions (optional)
   * @param groupsToAdd - Comma-separated group names to add (optional)
   * @param groupsToRemove - Comma-separated group names to remove (optional)
   */
  constructor(
    type: string,
    subject: string,
    body: string | { text: string; url: string },
    offset?: number | null,
    groupsToAdd?: string | null,
    groupsToRemove?: string | null
  );
  
  /**
   * Convert to array format for spreadsheet persistence
   * @returns Array matching HEADERS column order
   */
  toArray(): Array<string | number | null | { text: string; url: string }>;
  
  /**
   * Static factory method - creates ValidatedActionSpec from row data
   * Never throws - returns null on validation failure
   * 
   * @param rowArray - Row data as array
   * @param headers - Column headers
   * @param rowNumber - Row number for error reporting (1-based)
   * @param errorCollector - Optional error collector
   * @returns ValidatedActionSpec instance or null on failure
   */
  static fromRow(
    rowArray: Array<any>,
    headers: Array<string>,
    rowNumber: number,
    errorCollector?: { errors: string[]; rowNumbers: number[] }
  ): ValidatedActionSpec | null;
  
  /**
   * Batch validation with consolidated error reporting
   * 
   * @param rows - Array of row data (without headers)
   * @param headers - Column headers
   * @param context - Context string for error reporting
   * @returns Array of valid ValidatedActionSpec instances
   */
  static validateRows(
    rows: Array<Array<any>>,
    headers: Array<string>,
    context: string
  ): Array<ValidatedActionSpec>;
  
  /**
   * Column headers constant
   */
  static readonly HEADERS: Array<string>;
}
