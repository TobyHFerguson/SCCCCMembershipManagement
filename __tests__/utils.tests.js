if (typeof require !== 'undefined') {
  (utils = require('../src/JavaScript/utils'))
}

describe('utils', () => {
  const { getDateString, ActionType, addDaysToDate, addYearsToDate, expandTemplate, toLocaleDateString } = utils;

  describe('getDateString', () => {
    describe('calculateExpirationDate', () => {
      test('should calculate expiration date based on period in years from today if no existing expiration date is provided', () => {
        const period = 2;
        try {
          const result = utils.calculateExpirationDate(period);
        }
        catch(e) {
          expect(e.message).toBe('No expiration dated provided');
        }
      });
  
      test('should calculate expiration date based on period in years from existing expiration date if provided', () => {
        const period = 3;
        const existingExpirationDate = new Date('2030-01-01');
        const result = utils.calculateExpirationDate(existingExpirationDate, period);
        const expectedDate = new Date('2033-01-01');
        expect(utils.getDateString(result)).toEqual(utils.getDateString(expectedDate));
      });
  
      test('should return the greater of period added to today or the existing expiration date', () => {
        const period = 1;
        const existingExpirationDate = new Date();
        existingExpirationDate.setFullYear(existingExpirationDate.getFullYear() + 2);
        const result = utils.calculateExpirationDate(existingExpirationDate, period);
        const expectedDate = new Date();
        expectedDate.setFullYear(expectedDate.getFullYear() + period + 2);
        expect(utils.getDateString(result)).toEqual(utils.getDateString(expectedDate));
      });
  
      test('should handle leap years correctly', () => {
        const period = 1;
        const existingExpirationDate = new Date('2052-02-29');
        const result = utils.calculateExpirationDate(existingExpirationDate, period);
        const expectedDate = new Date('2053-03-01')
        expect(utils.getDateString(result)).toEqual(utils.getDateString(expectedDate));
      });
  
      test('should handle negative periods correctly', () => {
        const period = -1;
        const existingExpirationDate = new Date('2050-01-01');
        const result = utils.calculateExpirationDate(existingExpirationDate, period);
        const expectedDate = new Date('2049-01-01');
        expect(utils.getDateString(result)).toEqual(utils.getDateString(expectedDate));
      });
    });
    test('should return a string in the format YYYY-MM-DD', () => {
      const date = new Date('2021-01-01');
      expect(getDateString(date)).toBe('2021-01-01');
    });
  });

  describe('addDaysToDate', () => {
    test('should return a new date with days added', () => {
      const date = new Date('2021-01-01');
      const result = addDaysToDate(date, 1);
      expect(result).toEqual(new Date('2021-01-02'));
    });
  });

  describe('addYearsToDate', () => {
    test('should return a new date with years added', () => {
      const date = new Date('2021-01-01');
      const result = addYearsToDate(date, 1);
      expect(result).toEqual(new Date('2022-01-01'));
    });
  });

  describe('expandTemplate', () => {
    test('should replace placeholders with values from a row object', () => {
      const template = 'Hello, {name}! You joined on {Joined}';
      const row = { name: 'Alice', Joined: '2021-01-01' };
      console.log(new Date(row.Joined))
      expect(expandTemplate(template, row)).toBe('Hello, Alice! You joined on 1/1/2021');
    });
    test('should take US style dates', () => {
      const template = 'Hello, {name}! You joined on {Joined}';
      const row = { name: 'Alice', Joined: '1/1/2021' };
      console.log(new Date(row.Joined))
      expect(expandTemplate(template, row)).toBe('Hello, Alice! You joined on 1/1/2021');
    });
    test('should convert date fields to local date strings', () => {
      const template = 'Your membership expires on {Expires}';
      const row = { Expires: new Date('2021-01-01') };
      expect(expandTemplate(template, row)).toBe('Your membership expires on 1/1/2021');
    });
  });
  describe('toLocaleDateString', () => {
    test('should return a local date string', () => {
      const date = new Date('2021-01-01T00:00:00');
      expect(toLocaleDateString(date)).toBe('1/1/2021');
    });
  });
});