

if (typeof require !== 'undefined') {
  ({ ActionType, today_ } = require('./triggers'));
} 

function processActionSchedule(actionSchedule) {
  const result = { emailQueue: [], expiredMembersQueue: [] };
  if (!actionSchedule || !Array.isArray(actionSchedule)) {
    return { emailQueue: [], expiredMembersQueue: [] };
  }
  actionSchedule.filter(as => {
    if (as.Date < today_()) {
      return true;
    } else {
      if (as.Type === ActionType.Join) {
        result.emailQueue.push(as);
      } else if (as.Type === ActionType.Expiry) {
        result.expiredMembersQueue.push(as);
      }

      return false
    }
  });
  return result;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    processActionSchedule
  };
} 