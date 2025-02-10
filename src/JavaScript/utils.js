

function today() {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return now;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    today
  };
}