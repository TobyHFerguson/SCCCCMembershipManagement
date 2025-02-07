/**
 * Merges two lists of objects based on a list of keys using spread syntax.
 * @param {Array} a - The first list of objects.
 * @param {Array} b - The second list of objects.
 * @param {Array} k - The list of keys.
 * @returns {Array} - The list of merged objects.
 */
function mergeObjects(a, b, k) {
    return a.map((objA, index) => {
      const objB = b[index];
      const mergedObj = { ...objA };
      k.forEach(key => {
        if (objB.hasOwnProperty(key)) {
          mergedObj[key] = objB[key];
        }
      });
      return mergedObj;
    });
  }
  /**
   * Logs messages to the console if the script property 'logging' is true.
   * @param  {...any} args - The messages or objects to log.
   */
  function log(...args) {
    const logging = PropertiesService.getScriptProperties().getProperty('logging') === 'true';
    if (logging) {
      console.log(...args);
    }
  }