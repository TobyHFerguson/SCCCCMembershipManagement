
if (typeof require !== 'undefined') {
  var MembershipManagement = require('../src/services/MembershipManagement/utils')
  var utils = MembershipManagement.Utils;
}

describe('utils', () => {

  describe('dateOnly', () => {
    it('should return the given date with the time set to 00:00:00', () => {
      const date = new Date('2021-01-01T12:34:56');
      const expected = new Date(2021, 0, 1)
      const result = utils.dateOnly(date);
      expect(result).toEqual(expected);
    })
    it('should interpret dates without timezones as being in the current timezone', () => {
      const date = new Date('2021-01-01T00:00:00');
      const expected = new Date(2021, 0, 1)
      const result = utils.dateOnly(date);
      expect(result).toEqual(expected);
    })
    it('should handle strings', () => {
      const date = '2021-01-01T12:34:56';
      const expected = new Date(2021, 0, 1)
      const result = utils.dateOnly(date);
      expect(result).toEqual(expected);
    })
  }); 
  describe('calculateExpirationDate', () => {
    test('should calculate expiration date based on period in years from expiration if refernce <= expireation date', () => {
      const period = 2;
      const d = new Date(2020, 0, 1); // Jan 1, 2020
      const e = new Date(2022, 0, 1); // Jan 1, 2022
      const result = utils.calculateExpirationDate(d, e, period);
      const expectedResult  = utils.addYearsToDate(e, 2)
      expect(result).toEqual(expectedResult);
    });
    it('should calculate dates even if theyre strings', () => {
      const period = 2;
      const d = /** @type {any} */ ('2020-01-01'); // Jan 1, 2020
      const e = /** @type {any} */ ('2022-01-01'); // Jan 1, 2022
      const result = utils.calculateExpirationDate(d, e, /** @type {any} */ (period));
      const expectedResult  = utils.addYearsToDate(e, 2)
      expect(result).toEqual(expectedResult);
    });
    test('should return the greater of period added to today or the existing expiration date', () => {
      const period = 1;
      const today = new Date();
      const existingExpirationDate = new Date(today);
      existingExpirationDate.setFullYear(existingExpirationDate.getFullYear() + 2);
      const result = utils.calculateExpirationDate(today, existingExpirationDate, period);
      const expectedDate = utils.dateOnly(new Date());
      expectedDate.setFullYear(expectedDate.getFullYear() + period + 2);
      expect(result).toEqual(expectedDate);
    });

    test('should handle leap years correctly', () => {
      const period = 1;
      const existingExpirationDate = new Date('2052-02-29');
      const result = utils.calculateExpirationDate(new Date(), existingExpirationDate, period);
      const expectedDate = utils.dateOnly(new Date('2053-03-01'))
      expect(result).toEqual(expectedDate);
    });

    test('should handle negative periods correctly', () => {
      const period = -1;
      const existingExpirationDate = new Date('2050-01-01');
      const result = utils.calculateExpirationDate(new Date(), existingExpirationDate, period);
      const expectedDate = utils.dateOnly(new Date('2049-01-01'));
      expect(result).toEqual(expectedDate);
    });
  });

  describe('addDaysToDate', () => {
    test('should return a new date with days added', () => {
      const date = new Date('2021-01-01');
      const expectedDate = utils.dateOnly(new Date('2021-01-02'));
      const result = utils.addDaysToDate(date, 1);
      expect(result).toEqual(expectedDate);
    });
  });

  describe('addYearsToDate', () => {
    test('should return a new date with years added', () => {
      const date = new Date('2021-01-01');
      const expectedDate = utils.dateOnly(new Date('2022-01-01'));
      const result = utils.addYearsToDate(date, 1);
      expect(result).toEqual(expectedDate);
    });
  });

  describe('expandTemplate', () => {
    test('should replace placeholders with values from a row object', () => {
      const template = 'Hello, {name}! You joined on {Joined}';
      const joinDate = new Date(2021, 0, 1)
      const row = { name: 'Alice', Joined: joinDate };
      expect(utils.expandTemplate(template, row)).toBe('Hello, Alice! You joined on 1/1/2021');
    });
    test('should take US style dates', () => {
      const template = 'Hello, {name}! You joined on {Joined}';
      const row = { name: 'Alice', Joined: utils.dateOnly('1/1/2021') };
      console.log(new Date(row.Joined))
      expect(utils.expandTemplate(template, row)).toBe('Hello, Alice! You joined on 1/1/2021');
    });
    test('should convert date fields to local date strings', () => {
      const template = 'Your membership expires on {Expires}';
      const row = { Expires: utils.dateOnly('2021-01-01') };
      expect(utils.expandTemplate(template, row)).toBe('Your membership expires on 1/1/2021');
    });
  });
  describe('toLocaleDateString', () => {
    test('should return a local date string', () => {
      const date = new Date('2021-01-01T00:00:00');
      expect(utils.toLocaleDateString(date)).toBe('1/1/2021');
    });
  });

  describe('buildPrefillFormTemplate', () => {
    const BASE = 'https://docs.google.com/forms/d/e/1FAIpQLSfXXX/viewform';

    test('should convert marker answers to template fields and remove other entries', () => {
      const url = BASE + '?usp=pp_url' +
        '&entry.111=Yes' +
        '&entry.222=First' +
        '&entry.333=Last' +
        '&entry.444=Phone' +
        '&entry.555=Member+ID';
      const result = utils.buildPrefillFormTemplate(url);
      expect(result).toBe(BASE + '?usp=pp_url' +
        '&entry.222={First}' +
        '&entry.333={Last}' +
        '&entry.444={Phone}' +
        '&entry.555={Member ID}');
    });

    test('should handle %20 encoding for Member ID', () => {
      const url = BASE + '?usp=pp_url&entry.222=First&entry.333=Last&entry.444=Phone&entry.555=Member%20ID';
      const result = utils.buildPrefillFormTemplate(url);
      expect(result).toBe(BASE + '?usp=pp_url&entry.222={First}&entry.333={Last}&entry.444={Phone}&entry.555={Member ID}');
    });

    test('should preserve entry order from the original URL', () => {
      const url = BASE + '?usp=pp_url' +
        '&entry.999=Phone' +
        '&entry.111=First' +
        '&entry.555=Last' +
        '&entry.777=Member+ID';
      const result = utils.buildPrefillFormTemplate(url);
      expect(result).toBe(BASE + '?usp=pp_url' +
        '&entry.999={Phone}' +
        '&entry.111={First}' +
        '&entry.555={Last}' +
        '&entry.777={Member ID}');
    });

    test('should keep only the four marker entries and drop all others', () => {
      const url = BASE + '?usp=pp_url' +
        '&entry.100=I+agree' +
        '&entry.200=Share+Name' +
        '&entry.300=First' +
        '&entry.400=Last' +
        '&entry.500=Phone' +
        '&entry.600=Member+ID' +
        '&entry.200=Share+Email' +
        '&entry.200=Share+Phone';
      const result = utils.buildPrefillFormTemplate(url);
      // Only the 4 marker entries remain
      expect(result).toBe(BASE + '?usp=pp_url' +
        '&entry.300={First}' +
        '&entry.400={Last}' +
        '&entry.500={Phone}' +
        '&entry.600={Member ID}');
    });

    test('should throw if URL has no entry parameters', () => {
      const url = BASE + '?usp=pp_url';
      expect(() => utils.buildPrefillFormTemplate(url)).toThrow('No entry parameters found');
    });

    test('should throw if a marker answer is not found in the URL', () => {
      // Missing Member ID marker
      const url = BASE + '?usp=pp_url' +
        '&entry.222=First' +
        '&entry.333=Last' +
        '&entry.444=Phone';
      expect(() => utils.buildPrefillFormTemplate(url)).toThrow('Member ID');
    });

    test('should handle URL without usp parameter', () => {
      const url = BASE + '?entry.222=First&entry.333=Last&entry.444=Phone&entry.555=Member+ID';
      const result = utils.buildPrefillFormTemplate(url);
      expect(result).toBe(BASE + '?entry.222={First}&entry.333={Last}&entry.444={Phone}&entry.555={Member ID}');
    });
  });
});