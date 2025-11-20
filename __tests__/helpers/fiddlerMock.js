// Helper to install in-memory fiddler mocks for tests
module.exports = function createFiddlerMock(initialFifo = [], initialDead = []) {
  let fifoData = Array.isArray(initialFifo) ? initialFifo.slice() : [];
  let deadData = Array.isArray(initialDead) ? initialDead.slice() : [];
  let originalGetFiddler = null;

  function install() {
    // Ensure global Common exists
    global.Common = global.Common || { Data: { Storage: { SpreadsheetManager: {} } } };
    originalGetFiddler = global.Common.Data.Storage.SpreadsheetManager.getFiddler;
    global.Common.Data.Storage.SpreadsheetManager.getFiddler = (name) => {
      if (name === 'ExpirationFIFO') {
        return {
          getData: () => fifoData.slice(),
          setData: (d) => { fifoData = Array.isArray(d) ? d.slice() : []; return global.Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirationFIFO'); },
          dumpValues: () => { }
        };
      }
      if (name === 'ExpirationDeadLetter') {
        return {
          getData: () => deadData.slice(),
          setData: (d) => { deadData = Array.isArray(d) ? d.slice() : []; return global.Common.Data.Storage.SpreadsheetManager.getFiddler('ExpirationDeadLetter'); },
          dumpValues: () => { }
        };
      }
      // default simple fiddler for other sheets
      return { getData: () => [], setData: () => ({ dumpValues: () => { } }), dumpValues: () => { } };
    };
  }

  function restore() {
    if (originalGetFiddler) global.Common.Data.Storage.SpreadsheetManager.getFiddler = originalGetFiddler;
  }

  function getFifo() { return fifoData.slice(); }
  function getDead() { return deadData.slice(); }

  return { install, restore, getFifo, getDead, _internal: { setFifo: (d) => { fifoData = d.slice(); }, setDead: (d) => { deadData = d.slice(); } } };
}
