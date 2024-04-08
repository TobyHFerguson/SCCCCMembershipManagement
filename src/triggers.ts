import exp = require('constants');
import {
  Directory,
  EmailNotifier,
  ExpirationProcessor,
  Member,
  Notifier,
  TransactionProcessor,
} from './Code';
import {
  CurrentMember,
  EmailConfigurationCollection,
  SystemConfiguration,
  Transaction,
  bmPreFiddler,
} from './Types';

/**
 * @OnlyCurrentDoc - only edit this spreadsheet, and no other
 */
function processPaidTransactions() {
  const directory = getDirectory_();
  const notifier = getEmailNotifier_();
  convertLinks_('Transactions');
  const transactionsFiddler = bmPreFiddler
    .PreFiddler()
    .getFiddler({
      id: null,
      sheetName: 'Transactions',
      createIfMissing: false,
    })
    .needFormulas();
  const keepFormulas = transactionsFiddler.getColumnsWithFormulas();
  const tp = new TransactionProcessor(directory, notifier);
  transactionsFiddler.mapRows((row: object, { rowFormulas }) => {
    tp.processTransaction(<Transaction>row);
    keepFormulas.forEach(
      f =>
      ((<{ [key: string]: object }>row)[f] = (<{ [key: string]: object }>(
        rowFormulas
      ))[f])
    );
    return row;
  });
  transactionsFiddler.dumpValues();
  notifier.log();
}

function migrateCEMembers(): void {
  const notifier = getEmailNotifier_();
  const directory = getDirectory_();
  const ceFiddler = bmPreFiddler.PreFiddler().getFiddler({
    id: null,
    sheetName: 'CE Members',
    createIfMissing: false,
  });
  ceFiddler
    .mapRows(row => {
      const cm: CurrentMember = <CurrentMember>row;
      if (!cm.Imported) {
        let newMember = directory.makeMember(cm);
        try {
          newMember = migrateMember_(cm);
          cm.Imported = new Date();
          notifier.importSuccess(cm, newMember);
        } catch (err: any) {
          notifier.importFailure(cm, newMember, err);
        }
      }
      return row;
    })
    .dumpValues();
  notifier.log();
}

function createMembershipReport() {
  const directory = getDirectory_();
  const reportMembers = directory.getMembers().map(m => m.report);
  const membersFiddler = bmPreFiddler.PreFiddler().getFiddler({
    id: null,
    sheetName: 'MembershipReport',
    createIfMissing: true,
  });
  if (reportMembers !== undefined) membersFiddler.setData(reportMembers);
  membersFiddler.dumpValues();
}

function checkExpirations() {
  const expirationProcessor = new ExpirationProcessor(getEmailConfiguration_(), getEmailNotifier_());
  getDirectory_().getMembers().forEach(m => expirationProcessor.)
}
function getEmailNotifier_() {
      const emailConfig = getEmailConfiguration_();
      const notifier = new EmailNotifier(GmailApp, emailConfig, { test: true });
      return notifier;
    }

function getEmailConfiguration_() {
  return <EmailConfigurationCollection>bmPreFiddler
    .PreFiddler()
    .getFiddler({
      id: null,
      sheetName: 'Email Configuration',
      createIfMissing: false,
    })
    .getData()
    .reduce((p, c) => {
      const t: string = (<{ [key: string]: string; }>c)['Email Type'];
      (<{ [key: string]: object; }>p)[t] = c;
      return p;
    }, {});
}

function updatedRow_(e: { range: GoogleAppsScript.Spreadsheet.Range }) {
      console.log(`Column: ${e.range} Row ${e.range.getRow()}`);
      // printRow(e.range.getRow())
    }

/**
 * Creates the menu item "Mail Merge" for user to run scripts on drop-down.
 */
function onOpen() {
      const ui = SpreadsheetApp.getUi();
      // ui.createMenu('Mail Merge')
      //     .addItem('Send Emails', 'sendEmails')
      //     .addToUi();
      ui.createMenu('Membership Management')
        .addItem('Create Membership Report', 'createMembershipReport')
        .addItem('Process Transactions', 'processPaidTransactions')
        .addToUi();
    }

function convertLinks_(sheetName: string) {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
      if (!sheet) return;
      const range = sheet.getDataRange();
      const rtvs = range.getRichTextValues();
      const values = range.getValues();
      const newValues = rtvs.map((row, r) => {
        return row.map((column, c) => {
          if (!column) return null;
          const v = column.getText() ? column.getText() : values[r][c];
          return column.getLinkUrl()
            ? `=hyperlink("${column.getLinkUrl()}", "${v}")`
            : v;
        });
      });
      range.setValues(newValues);
      SpreadsheetApp.flush();
    }

function getDirectory_() {
      const directory = new Directory(getSystemConfig_());
      return directory;
    }

function getSystemConfig_() {
      const systemConfigFiddler = bmPreFiddler.PreFiddler().getFiddler({
        id: null,
        sheetName: 'System Configuration',
        createIfMissing: false,
      });
      const systemConfiguration = <SystemConfiguration>(
        systemConfigFiddler.getData()[0]
      );
      return systemConfiguration;
    }

function migrateMember_(currentMember: CurrentMember): Member {
      const directory = getDirectory_();
      const nm = directory.makeMember(currentMember);
      try {
        return directory.addMember(nm);
      } catch (err: any) {
        if (err.message.endsWith('Entity already exists.')) {
          return directory.updateMember(nm);
        } else {
          throw err;
        }
      }
    }

function testMigrateMember() {
      const currentMember: CurrentMember = {
        'First Name': 'given',
        'Last Name': 'family',
        'Email Address': 'a@b.com',
        'Phone Number': '+14083869343',
        'In Directory': true,
        Joined: Member.convertToYYYYMMDDFormat_(new Date('2024-05-23')),
        Expires: Member.convertToYYYYMMDDFormat_(new Date('2025-05-23')),
        'Membership Type': 'Family',
      };
      migrateMember_(currentMember);
    }
