// manager.js (Your actual code)
const Manager = require('../src/JavaScript/Manager');
  
  
  
  // manager.test.js (Your test file)
  
  describe('Manager.fun', () => {
    it('should call console.log with "help" when argument is "help"', () => {
      // 1. Create a mock for console.log
      const consoleLogSpy = jest.spyOn(console, 'log');
  
      // 2. Create an instance of your Manager class
      
  
      // 3. Call the function you are testing
      Manager.fun('help');
  
      // 4. Assert that console.log was called with the expected argument
      expect(consoleLogSpy).toHaveBeenCalledWith('help');
  
      // 5. Clean up the mock after the test to prevent interference with other tests.  This is important!
      consoleLogSpy.mockRestore();
    });
  
    it('should call console.log with "other" when argument is "other"', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      Manager.fun('other');
      expect(consoleLogSpy).toHaveBeenCalledWith('other');
      consoleLogSpy.mockRestore();
    });
  
    it('should not call console.log when argument is something else', () => {
      const consoleLogSpy = jest.spyOn(console, 'log');
      Manager.fun('something_else');
      expect(consoleLogSpy).not.toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });
  });