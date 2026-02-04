// Helper to install in-memory fiddler mocks for tests
module.exports = function createFiddlerMock(initialFifo = [], initialDead = []) {
  let fifoData = Array.isArray(initialFifo) ? initialFifo.slice() : [];
  let deadData = Array.isArray(initialDead) ? initialDead.slice() : [];
  let originalGetFiddler = null;

  function install() {
    // Ensure global Common exists, preserving existing properties
    global.Common = global.Common || {};
    global.Common.Data = global.Common.Data || {};
    global.Common.Data.Storage = global.Common.Data.Storage || {};
    global.SpreadsheetManager = global.SpreadsheetManager || {};
    
    originalGetFiddler = global.SpreadsheetManager.getFiddler;
    global.SpreadsheetManager.getFiddler = (name) => {
      if (name === 'ExpirationFIFO') {
        return {
          getData: () => fifoData.slice(),
          setData: (d) => { fifoData = Array.isArray(d) ? d.slice() : []; return global.SpreadsheetManager.getFiddler('ExpirationFIFO'); },
          dumpValues: () => { }
        };
      }
      if (name === 'ExpirationDeadLetter') {
        return {
          getData: () => deadData.slice(),
          setData: (d) => { deadData = Array.isArray(d) ? d.slice() : []; return global.SpreadsheetManager.getFiddler('ExpirationDeadLetter'); },
          dumpValues: () => { }
        };
      }
      if (name === 'ExpirySchedule') {
        return {
          getData: () => [],
          setData: (d) => ({ dumpValues: () => { } }),
          dumpValues: () => { }
        };
      }
      // default simple fiddler for other sheets
      return { getData: () => [], setData: () => ({ dumpValues: () => { } }), dumpValues: () => { } };
    };
    
    // Add clearFiddlerCache method for SheetAccess compatibility
    global.SpreadsheetManager.clearFiddlerCache = () => { };
  }

  function restore() {
    if (originalGetFiddler) global.SpreadsheetManager.getFiddler = originalGetFiddler;
  }

  function getFifo() { return fifoData.slice(); }
  function getDead() { return deadData.slice(); }

  return { install, restore, getFifo, getDead, _internal: { setFifo: (d) => { fifoData = d.slice(); }, setDead: (d) => { deadData = d.slice(); } } };
}
