function handleUserInput(form) {
    var docURL = form.docURL;
    var htmlContent = DocsService.convertDocToHtml(docURL);
    DocsService.showHtmlContent(htmlContent);
  }