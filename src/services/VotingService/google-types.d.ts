declare namespace GoogleAppsScript {
  namespace Events {
    interface SheetsOnFormSubmit {
      source: GoogleAppsScript.Spreadsheet.Spreadsheet;
    }
  }
  namespace Forms {
    interface Form {
      setPublished(enabled: boolean): Form;
      isPublished(): boolean;
    }
  }
}