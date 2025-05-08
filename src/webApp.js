function doGet(e) {
    const service = e.parameter.service;
    switch (service) {
        case 'DirectoryService':
            return DirectoryService.WebApp.doGet(e);
        default:
            return ContentService.createTextOutput('Invalid service parameter.').setMimeType(ContentService.MimeType.TEXT);
    }
}
function doPost(e) {
    return ContentService.createTextOutput('Post not implemented.').setMimeType(ContentService.MimeType.TEXT);

}
