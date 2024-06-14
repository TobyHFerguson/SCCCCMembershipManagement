/**
 * @OnlyCurrentDoc - only edit this spreadsheet, and no other
 */
function handleOnEditEvent(event) {
    var sheetName = event.range.getSheet().getName();
    switch (sheetName) {
        case 'Renewals':
            processRenewals();
            break;
        case 'Transactions':
            processTransactions();
            break;
        default:
            break;
    }
}
function processTransactions() {
    processPaidTransactions_('Transactions');
}
function processRenewals() {
    var directory = getDirectory_();
    var notifier = getEmailNotifier_();
    var sheetName = 'Renewals';
    convertLinks_(sheetName);
    var fiddler = bmPreFiddler
        .PreFiddler()
        .getFiddler({
        id: null,
        sheetName: sheetName,
        createIfMissing: false
    })
        .needFormulas();
    var keepFormulas = fiddler.getColumnsWithFormulas();
    var tp = new ML.TransactionProcessor(directory, notifier);
    fiddler.mapRows(function (row, _a) {
        var rowFormulas = _a.rowFormulas;
        if (row.Processed)
            return row;
        tp.renew(row);
        keepFormulas.forEach(function (f) {
            return (row[f] = (rowFormulas)[f]);
        });
        return row;
    });
    fiddler.dumpValues();
    notifier.log();
}
function processPaidTransactions_(sheetName) {
    var directory = getDirectory_();
    var notifier = getEmailNotifier_();
    convertLinks_(sheetName);
    var transactionsFiddler = bmPreFiddler
        .PreFiddler()
        .getFiddler({
        id: null,
        sheetName: sheetName,
        createIfMissing: false
    })
        .needFormulas();
    var keepFormulas = transactionsFiddler.getColumnsWithFormulas();
    var tp = new ML.TransactionProcessor(directory, notifier);
    transactionsFiddler.mapRows(function (row, _a) {
        var rowFormulas = _a.rowFormulas;
        tp.processTransaction(row);
        keepFormulas.forEach(function (f) {
            return (row[f] = (rowFormulas)[f]);
        });
        return row;
    });
    transactionsFiddler.dumpValues();
    notifier.log();
}
function migrateCEMembers() {
    var notifier = getEmailNotifier_();
    var directory = getDirectory_();
    var ceFiddler = bmPreFiddler.PreFiddler().getFiddler({
        id: null,
        sheetName: 'CE Members',
        createIfMissing: false
    });
    ceFiddler
        .mapRows(function (row) {
        var cm = row;
        if (!cm.Imported) {
            var newMember = directory.makeMember(cm);
            try {
                newMember = migrateMember_(cm);
                cm.Imported = ML.Member.convertToYYYYMMDDFormat_(new Date());
                notifier.importSuccess(cm, newMember);
            }
            catch (err) {
                notifier.importFailure(cm, newMember, err);
            }
        }
        return row;
    })
        .dumpValues();
    notifier.log();
}
function createMembershipReport() {
    var directory = getDirectory_();
    var reportMembers = directory.getMembers().map(function (m) { return m.report; });
    var membersFiddler = bmPreFiddler.PreFiddler().getFiddler({
        id: null,
        sheetName: 'MembershipReport',
        createIfMissing: true
    });
    if (reportMembers !== undefined)
        membersFiddler.setData(reportMembers);
    membersFiddler.dumpValues();
}
function checkExpirations() {
    var expirationProcessor = new ML.ExpirationProcessor(getEmailConfiguration_(), getEmailNotifier_());
    getDirectory_()
        .getMembers()
        .forEach(function (m) { return expirationProcessor.checkExpiration(m); });
}
function getEmailNotifier_() {
    var emailConfig = getEmailConfiguration_();
    var notifier = new ML.EmailNotifier(GmailApp, emailConfig, getSystemConfig_());
    return notifier;
}
function getEmailConfiguration_() {
    return bmPreFiddler
        .PreFiddler()
        .getFiddler({
        id: null,
        sheetName: 'Email Configuration',
        createIfMissing: false
    })
        .getData()
        .reduce(function (p, c) {
        var t = c['Email Type'];
        p[t] = c;
        return p;
    }, {});
}
function updatedRow_(e) {
    console.log("Column: ".concat(e.range, " Row ").concat(e.range.getRow()));
    // printRow(e.range.getRow())
}
/**
 * Creates the menu item "Mail Merge" for user to run scripts on drop-down.
 */
function onOpen() {
    var ui = SpreadsheetApp.getUi();
    // ui.createMenu('Mail Merge')
    //     .addItem('Send Emails', 'sendEmails')
    //     .addToUi();
    ui.createMenu('Membership Management')
        .addItem('Create Membership Report', createMembershipReport.name)
        .addItem('Process Transactions', processTransactions.name)
        .addItem('Process Renewals', processRenewals.name)
        .addItem('Migrate CE Members', migrateCEMembers.name)
        .addItem('Check Expirations', checkExpirations.name)
        .addToUi();
}
function convertLinks_(sheetName) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet)
        return;
    var range = sheet.getDataRange();
    var rtvs = range.getRichTextValues();
    var values = range.getValues();
    var newValues = rtvs.map(function (row, r) {
        return row.map(function (column, c) {
            if (!column)
                return null;
            var v = column.getText() ? column.getText() : values[r][c];
            return column.getLinkUrl()
                ? "=hyperlink(\"".concat(column.getLinkUrl(), "\", \"").concat(v, "\")")
                : v;
        });
    });
    range.setValues(newValues);
    SpreadsheetApp.flush();
}
function getDirectory_() {
    var directory = new ML.Directory({ adminDirectory: AdminDirectory, options: getSystemConfig_() });
    return directory;
}
var systemConfiguration;
function getSystemConfig_() {
    if (systemConfiguration)
        return systemConfiguration;
    var systemConfigFiddler = bmPreFiddler.PreFiddler().getFiddler({
        id: null,
        sheetName: 'System Configuration',
        createIfMissing: false
    });
    systemConfiguration = systemConfigFiddler.getData()[0];
    return systemConfiguration;
}
function migrateMember_(currentMember) {
    var directory = getDirectory_();
    var nm = directory.makeMember(currentMember);
    try {
        return directory.addMember(nm);
    }
    catch (err) {
        if (err.message.endsWith('Entity already exists.')) {
            return directory.updateMember(nm);
        }
        else {
            throw err;
        }
    }
}
function testMigrateMember() {
    var currentMember = {
        'First Name': 'given',
        'Last Name': 'family',
        'Email Address': 'a@b.com',
        'Phone Number': '+14083869343',
        'In Directory': true,
        Joined: Member.convertToYYYYMMDDFormat_(new Date('2024-05-23')),
        Expires: Member.convertToYYYYMMDDFormat_(new Date('2025-05-23')),
        'Membership Type': 'Family'
    };
    migrateMember_(currentMember);
}
function addMemberToSG() {
    var directory = getDirectory_();
    var member = directory.getMember('ginger.rogers@santacruzcountycycling.club');
    directory.addMemberToGroup(member, 'club_members@santacruzcountycycling.club');
}
