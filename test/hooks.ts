// tests/hooks.js
import sinon = require('sinon'); // Restores the default sandbox after every test
exports.mochaHooks = {
  afterEach() {
    sinon.restore();
  },
};
