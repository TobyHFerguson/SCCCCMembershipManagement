const { MembershipManagement } = require('../src/services/MembershipManagement/Manager');

describe('findMemberIndex focused tests', () => {
  const Manager = MembershipManagement.Manager;

  it('matches by phone when email not present (phone+name -> update)', () => {
    const members = [
      { Email: '', Phone: '123-456', First: 'John', Last: 'Doe', Status: 'Active' }
    ];

    const { emailMap, phoneMap } = Manager.buildMultiMaps(members);

    const txn = { 'Email Address': 'new@example.com', Phone: '123-456', 'First Name': 'John', 'Last Name': 'Doe' };

    const idx = Manager.findMemberIndex(txn, members, emailMap, phoneMap);
    expect(idx).toBe(0);
  });

  it('matches by email when present (email+name -> update phone)', () => {
    const members = [
      { Email: 'old@example.com', Phone: '', First: 'Jane', Last: 'Smith', Status: 'Active' }
    ];

    const { emailMap, phoneMap } = Manager.buildMultiMaps(members);

    const txn = { 'Email Address': 'old@example.com', Phone: '555-111', 'First Name': 'Jane', 'Last Name': 'Smith' };

    const idx = Manager.findMemberIndex(txn, members, emailMap, phoneMap);
    expect(idx).toBe(0);
  });
});
