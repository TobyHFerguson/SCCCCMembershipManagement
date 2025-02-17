if (typeof require !== 'undefined') {
  (utils = require('../src/JavaScript/utils'))
}

describe('utils', () => {
  const { getDateString, ActionType, addDaysToDate, addYearsToDate, expandTemplate, toLocaleDateString } = utils;

  describe('getDateString', () => {
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
  });
  describe('toLocaleDateString', () => {
    test('should return a local date string', () => {
      const date = new Date('2021-01-01T00:00:00');
      expect(toLocaleDateString(date)).toBe('1/1/2021');
    });
  });
});