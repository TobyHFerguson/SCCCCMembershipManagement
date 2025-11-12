// @ts-nocheck - test uses dynamic JS globals and Jest mocks that TypeScript cannot easily infer
const { MembershipManagement } = require('../src/services/MembershipManagement/Manager');

describe('persistAmbiguousTransactions', () => {
  beforeEach(() => {
    // Ensure a minimal Common.Data.Storage.SpreadsheetManager exists for mocking
    global.Common = global.Common || {};
    global.Common.Data = global.Common.Data || {};
    global.Common.Data.Storage = global.Common.Data.Storage || {};
    global.Common.Data.Storage.SpreadsheetManager = global.Common.Data.Storage.SpreadsheetManager || {};
    global.Common.Data.Storage.SpreadsheetManager.getFiddler = global.Common.Data.Storage.SpreadsheetManager.getFiddler || jest.fn();
  });

  it('persists ambiguous transactions to fiddler when present', () => {
  const manager = new MembershipManagement.Manager({}, [{ Email: 'group@example.com' }], {}, () => {}, new Date());
    manager._ambiguousTransactions = [
      { txnRow: 5, txn: { 'Email Address': 'x@example.com', 'Payable Status': 'paid' }, candidates: [1, 2] }
    ];

    // Mock fiddler
  const setDataMock = jest.fn();
  const dumpValuesMock = jest.fn();
  const fakeFiddler = { setData: setDataMock, dumpValues: dumpValuesMock };
  setDataMock.mockImplementation(() => fakeFiddler);

    const spy = jest.spyOn(Common.Data.Storage.SpreadsheetManager, 'getFiddler').mockImplementation((name) => {
      expect(name).toBe('AmbiguousTransactions');
      return fakeFiddler;
    });

    const res = manager.persistAmbiguousTransactions('AmbiguousTransactions');
    expect(res.persisted).toBe(true);
    expect(res.count).toBe(1);
    expect(setDataMock).toHaveBeenCalledTimes(1);
    const rows = setDataMock.mock.calls[0][0];
    expect(rows.length).toBe(1);
    expect(rows[0]['Email']).toBe('x@example.com');

    spy.mockRestore();
  });

  it('returns reason when there are no ambiguous transactions', () => {
  const manager = new MembershipManagement.Manager({}, [{ Email: 'group@example.com' }], {}, () => {}, new Date());
    manager._ambiguousTransactions = [];
    const res = manager.persistAmbiguousTransactions('AmbiguousTransactions');
    expect(res.persisted).toBe(false);
    expect(res.reason).toBe('no_ambiguous_transactions');
  });
});
