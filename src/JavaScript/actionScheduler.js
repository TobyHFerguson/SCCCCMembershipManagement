

if (typeof require !== 'undefined') {
  ({ ActionType, today_ } = require('./triggers'));
}

/**
 * Processes an action schedule and separates actions into email and expired member queues.
 *
 * @param {ActionSchedule[]} actionSchedule - The list of actions to be processed.
 * @returns {{ emailQueue: EmailQueue[], expiredMembersQueue: ExpiredMembersQueue[] }} An object containing two arrays: `emailQueue` for email actions and `expiredMembersQueue` for expired member actions.
 */
function processActionSchedule(actionSchedule) {
  const result = { emailQueue: [], expiredMembersQueue: [] };
  if (!actionSchedule || !Array.isArray(actionSchedule)) {
    return { emailQueue: [], expiredMembersQueue: [] };
  }
  for (i = actionSchedule.length - 1; i >= 0; i--) {
    const as = actionSchedule[i];
    const today = today_();
    if (as.Date <= today) {
      if (as.Type === ActionType.Expiry4) {
        result.expiredMembersQueue.push({Email: as.Email});
      } else {
        delete as.Date
        result.emailQueue.push(as);
      }
      actionSchedule.splice(i, 1);
    }
  }
  return result;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    processActionSchedule
  };
} 