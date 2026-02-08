/**
 * ValidatedFIFOItem type declarations
 */

/**
 * ValidatedFIFOItem class for type-safe FIFO queue items
 */
declare class ValidatedFIFOItem {
  id: string;
  email: string;
  subject: string;
  htmlBody: string;
  groups: string;
  attempts: number;
  lastAttemptAt: string;
  lastError: string;
  nextAttemptAt: string;
  maxAttempts: number | null;
  dead: boolean;

  /**
   * Constructor for ValidatedFIFOItem
   * @param id - Unique identifier (required)
   * @param email - Member email (required, validated format)
   * @param subject - Email subject (required, non-empty)
   * @param htmlBody - Email HTML body (required, non-empty)
   * @param groups - Comma-separated group emails (optional, may be empty)
   * @param attempts - Number of attempts (required, >= 0)
   * @param lastAttemptAt - Last attempt timestamp ISO string (optional, may be empty)
   * @param lastError - Last error message (optional, may be empty)
   * @param nextAttemptAt - Next attempt timestamp ISO string (optional, may be empty)
   * @param maxAttempts - Max attempts override (optional)
   * @param dead - Dead letter flag (optional, defaults to false)
   */
  constructor(
    id: string,
    email: string,
    subject: string,
    htmlBody: string,
    groups: string,
    attempts: number,
    lastAttemptAt: string,
    lastError: string,
    nextAttemptAt: string,
    maxAttempts?: number | null,
    dead?: boolean
  );

  /**
   * Convert to array for serialization/testing
   * NOTE: For serialization/testing ONLY - never for sheet persistence
   */
  toArray(): Array<string | number | boolean | null>;

  /**
   * Static factory method - returns null on validation failure
   * Uses header-based lookup for column-order independence
   */
  static fromRow(
    rowArray: Array<unknown>,
    headers: string[],
    rowNumber: number,
    errorCollector?: { errors: string[]; rowNumbers: number[] }
  ): ValidatedFIFOItem | null;

  /**
   * Batch validation with consolidated error reporting
   */
  static validateRows(
    rows: Array<Array<unknown>>,
    headers: string[],
    context: string
  ): ValidatedFIFOItem[];

  /**
   * Column headers constant
   */
  static readonly HEADERS: string[];
}
