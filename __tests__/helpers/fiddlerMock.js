// Helper to install in-memory sheet access mocks for tests
module.exports = function createFiddlerMock(initialFifo = [], initialDead = []) {
  let fifoData = Array.isArray(initialFifo) ? initialFifo.slice() : [];
  let deadData = Array.isArray(initialDead) ? initialDead.slice() : [];
  let originalGetData = null;
  let originalSetData = null;

  function install() {
    // Ensure global Common exists, preserving existing properties
    global.Common = global.Common || {};
    global.Common.Data = global.Common.Data || {};
    global.Common.Data.Storage = global.Common.Data.Storage || {};
    global.SpreadsheetManager = global.SpreadsheetManager || {};
    global.SheetAccess = global.SheetAccess || {};
    
    // Mock SheetAccess getData/setData methods
    originalGetData = global.SheetAccess.getData;
    originalSetData = global.SheetAccess.setData;
    
    global.SheetAccess.getData = (name) => {
      if (name === 'ExpirationFIFO') {
        return fifoData.slice();
      }
      if (name === 'ExpirationDeadLetter') {
        return deadData.slice();
      }
      if (name === 'ExpirySchedule') {
        return [];
      }
      // default empty data for other sheets
      return [];
    };
    
    global.SheetAccess.setData = (name, data) => {
      if (name === 'ExpirationFIFO') {
        fifoData = Array.isArray(data) ? data.slice() : [];
      }
      if (name === 'ExpirationDeadLetter') {
        deadData = Array.isArray(data) ? data.slice() : [];
      }
      // For other sheets, do nothing
    };
  }

  function restore() {
    if (originalGetData) global.SheetAccess.getData = originalGetData;
    if (originalSetData) global.SheetAccess.setData = originalSetData;
  }

  function getFifo() { return fifoData.slice(); }
  function getDead() { return deadData.slice(); }

  return { install, restore, getFifo, getDead, _internal: { setFifo: (d) => { fifoData = d.slice(); }, setDead: (d) => { deadData = d.slice(); } } };
}
