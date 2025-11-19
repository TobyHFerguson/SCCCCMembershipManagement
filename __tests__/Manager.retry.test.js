const { MembershipManagement } = require('../src/services/MembershipManagement/Manager');

describe('Manager retry/backoff TDD', () => {
  const utils = MembershipManagement.Utils;
  const actionSpecs = { Renew: { Subject: 's', Body: 'b' } };
  const today = utils.dateOnly('2025-01-01');
  const groups = [{ Email: 'g@x.com' }];
  const groupManager = { groupAddFun: () => {}, groupRemoveFun: () => {} };

  test('on transient email failure attempts increment and nextRetryAt is set', () => {
    const sendEmail = jest.fn(() => { throw new Error('transient'); });
    const manager = new MembershipManagement.Manager(actionSpecs, groups, groupManager, sendEmail, today);

    const expired = [{ email: 'a@x.com', subject: 'sub', htmlBody: '<p>hi</p>', attempts: 0 }];

    const res = manager.processExpiredMembers(expired, sendEmail, groupManager.groupRemoveFun, { maxRetries: 5, computeNextRetryAt: utils.computeNextRetryAt });

  expect(res.processed).toBe(0);
  expect(Array.isArray(res.failed)).toBe(true);
  expect(res.failed.length).toBe(1);
  // metadata about retries is returned in failedMeta
  expect(Array.isArray(res.failedMeta)).toBe(true);
  expect(res.failedMeta.length).toBe(1);
  const fMeta = res.failedMeta[0];
  expect(fMeta.attempts).toBeGreaterThanOrEqual(1);
  expect(typeof fMeta.nextRetryAt).toBe('string');
  expect(new Date(fMeta.nextRetryAt).getTime()).toBeGreaterThan(Date.now());
  expect(fMeta.dead).toBeFalsy();
  });

  test('when attempts >= maxRetries the item is marked dead', () => {
    const sendEmail = jest.fn(() => { throw new Error('perm'); });
    const manager = new MembershipManagement.Manager(actionSpecs, groups, groupManager, sendEmail, today);

    const expired = [{ email: 'b@x.com', subject: 'sub', htmlBody: '<p>hi</p>', attempts: 2 }];

    const res = manager.processExpiredMembers(expired, sendEmail, groupManager.groupRemoveFun, { maxRetries: 2, computeNextRetryAt: utils.computeNextRetryAt });

  expect(res.processed).toBe(0);
  expect(res.failed.length).toBe(1);
  expect(Array.isArray(res.failedMeta)).toBe(true);
  expect(res.failedMeta.length).toBe(1);
  const fMeta = res.failedMeta[0];
  expect(fMeta.attempts).toBeGreaterThanOrEqual(2);
  expect(fMeta.dead).toBeTruthy();
  // dead items should not have nextRetryAt
  expect(fMeta.nextRetryAt === '' || fMeta.nextRetryAt === undefined).toBeTruthy();
  });
});
