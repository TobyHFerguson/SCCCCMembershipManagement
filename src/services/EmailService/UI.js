// Guarded initializer so this file can be safely loaded in any order
if (typeof EmailService === 'undefined') {
    // @ts-ignore - create namespace in GAS
    var EmailService = {};
}
EmailService.UI = EmailService.UI || {};

EmailService.UI = {
    showEmailDialog: function () {
        var actionSpecTypes = this._getActionSpecTypes();
        var template = HtmlService.createTemplateFromFile('services/EmailService/EmailDialog');
        template.actionSpecTypes = actionSpecTypes;
        var html = template.evaluate()
            .setWidth(400)
            .setHeight(300);
        SpreadsheetApp.getUi().showModalDialog(html, 'Send Test Email');
    },
    _getActionSpecTypes: () => {
        var actionSpecs = Common.Data.Access.getActionSpecs();
        const result = Object.keys(actionSpecs);
        console.log('getActionSpecTypes', result);
        return result;
    }
}

