// Type augmentation for Google Apps Script to include missing methods
declare namespace GoogleAppsScript {
  namespace Events {
    interface SheetsOnFormSubmit {
      source: GoogleAppsScript.Spreadsheet.Spreadsheet;
    }
  }
  namespace Forms {
    interface Form {
      /**
       * Sets whether the form is published and accepting responses.
       * @param enabled Whether to accept responses
       * @returns The form for chaining
       */
      setPublished(enabled: boolean): Form;
      
      /**
       * Returns whether the form is currently published and accepting responses.
       * @returns True if the form is published
       */
      isPublished(): boolean;
    }
  }
}