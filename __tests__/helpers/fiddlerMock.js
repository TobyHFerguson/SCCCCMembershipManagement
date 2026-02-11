// Helper to install in-memory sheet access mocks for tests
module.exports = function createFiddlerMock(initialFifo = [], initialDead = []) {
  let fifoData = Array.isArray(initialFifo) ? initialFifo.slice() : [];
  let deadData = Array.isArray(initialDead) ? initialDead.slice() : [];
  let originalGetData = null;
  let originalSetData = null;
  let originalGetDataAsArrays = null;

  function install() {
    // Ensure global Common exists, preserving existing properties
    global.Common = global.Common || {};
    global.Common.Data = global.Common.Data || {};
    global.Common.Data.Storage = global.Common.Data.Storage || {};
    global.SpreadsheetManager = /** @type {any} */ (global.SpreadsheetManager || {});
    global.SheetAccess = /** @type {any} */ (global.SheetAccess || {});
    
    // Mock SheetAccess getData/setData/getDataAsArrays methods
    originalGetData = global.SheetAccess.getData;
    originalSetData = global.SheetAccess.setData;
    originalGetDataAsArrays = global.SheetAccess.getDataAsArrays;
    
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
    
    global.SheetAccess.getDataAsArrays = (name) => {
      if (name === 'ExpirationFIFO') {
        if (fifoData.length === 0) return [];
        // Convert objects to arrays with headers
        const headers = Object.keys(fifoData[0]);
        const rows = fifoData.map(obj => headers.map(h => obj[h]));
        return [headers, ...rows];
      }
      if (name === 'ExpirationDeadLetter') {
        if (deadData.length === 0) return [];
        const headers = Object.keys(deadData[0]);
        const rows = deadData.map(obj => headers.map(h => obj[h]));
        return [headers, ...rows];
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
    if (originalGetDataAsArrays) global.SheetAccess.getDataAsArrays = originalGetDataAsArrays;
  }

  function getFifo() { return fifoData.slice(); }
  function getDead() { return deadData.slice(); }

  return { install, restore, getFifo, getDead, _internal: { setFifo: (d) => { fifoData = d.slice(); }, setDead: (d) => { deadData = d.slice(); } } };
}
