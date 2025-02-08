
const logging = PropertiesService.getScriptProperties().getProperty('logging') === 'true';
/**
 * Logs messages to the console if the script property 'logging' is true.
 * @param  {...any} args - The messages or objects to log.
 */
function log(...args) {
  if (logging) {
    console.log(...args);
  }
}

function blank(object) {
  Object.keys(object).forEach(key => {
    object.key =''
  });
}