declare namespace GoogleAppsScript {
  namespace Forms {
    interface Form {
      setPublished(enabled: boolean): Form;
      isPublished(): boolean;
    }
  }
}