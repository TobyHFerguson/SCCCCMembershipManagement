
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
    test('should replace placeholders with empty string when value is empty', () => {
      const template = 'a={x}&b={y}';
      const row = { x: 'val', y: '' };
      expect(utils.expandTemplate(template, row)).toBe('a=val&b=');
    });
    test('should replace placeholders with empty string when key is missing', () => {
      const template = 'a={x}&b={y}';
      const row = { x: 'val' };
      expect(utils.expandTemplate(template, row)).toBe('a=val&b=');
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

    // Helper: minimal valid URL with all required markers
    function allMarkersUrl(extras) {
      return BASE + '?usp=pp_url' +
        '&entry.444=Share+Name&entry.444=Share+Email&entry.444=Share+Phone' +
        '&entry.555=First&entry.666=Last&entry.777=Phone&entry.999=Member+ID' +
        (extras || '');
    }

    test('should convert full example URL keeping constants, converting checkboxes, template fields, and other entries', () => {
      const url = BASE + '?usp=pp_url' +
        '&entry.111=Yes' +
        '&entry.222=I+have+read+the+privacy+policy' +
        '&entry.333=I+Agree' +
        '&entry.444=Share+Name' +
        '&entry.444=Share+Email' +
        '&entry.444=Share+Phone' +
        '&entry.555=First' +
        '&entry.666=Last' +
        '&entry.777=Phone' +
        '&entry.888=1+year+-+$0.50' +
        '&entry.999=Member+ID';
      const result = utils.buildPrefillFormTemplate(url);
      expect(result).toBe(BASE + '?usp=pp_url' +
        '&entry.111=Yes' +
        '&entry.222=I+have+read+the+privacy+policy' +
        '&entry.333=I+Agree' +
        '&entry.444={Directory Share Name}' +
        '&entry.444={Directory Share Email}' +
        '&entry.444={Directory Share Phone}' +
        '&entry.555={First}' +
        '&entry.666={Last}' +
        '&entry.777={Phone}' +
        '&entry.888=1+year+-+$0.50' +
        '&entry.999={Member ID}');
    });

    test('should keep constant answers (Yes, I have read..., I Agree) as-is', () => {
      const url = BASE + '?usp=pp_url' +
        '&entry.111=Yes' +
        '&entry.222=I+have+read+the+privacy+policy' +
        '&entry.333=I+Agree' +
        '&entry.444=Share+Name&entry.444=Share+Email&entry.444=Share+Phone' +
        '&entry.555=First&entry.666=Last&entry.777=Phone&entry.999=Member+ID';
      const result = utils.buildPrefillFormTemplate(url);
      expect(result).toContain('entry.111=Yes');
      expect(result).toContain('entry.222=I+have+read+the+privacy+policy');
      expect(result).toContain('entry.333=I+Agree');
    });

    test('should convert Share entries to {Directory Share ...} template fields', () => {
      const url = allMarkersUrl();
      const result = utils.buildPrefillFormTemplate(url);
      expect(result).toContain('entry.444={Directory Share Name}');
      expect(result).toContain('entry.444={Directory Share Email}');
      expect(result).toContain('entry.444={Directory Share Phone}');
    });

    test('should convert template markers to {First}, {Last}, {Phone}, {Member ID}', () => {
      const url = allMarkersUrl();
      const result = utils.buildPrefillFormTemplate(url);
      expect(result).toContain('entry.555={First}');
      expect(result).toContain('entry.666={Last}');
      expect(result).toContain('entry.777={Phone}');
      expect(result).toContain('entry.999={Member ID}');
    });

    test('should keep non-marker entries as-is', () => {
      const url = allMarkersUrl('&entry.888=1+year+-+$0.50');
      const result = utils.buildPrefillFormTemplate(url);
      expect(result).toContain('entry.888=1+year+-+$0.50');
    });

    test('should preserve entry order from the original URL', () => {
      const url = BASE + '?usp=pp_url' +
        '&entry.999=Member+ID' +
        '&entry.444=Share+Phone' +
        '&entry.555=First' +
        '&entry.444=Share+Name' +
        '&entry.666=Last' +
        '&entry.444=Share+Email' +
        '&entry.777=Phone';
      const result = utils.buildPrefillFormTemplate(url);
      const entryParts = result.split('&').filter(p => p.startsWith('entry.'));
      expect(entryParts[0]).toBe('entry.999={Member ID}');
      expect(entryParts[1]).toBe('entry.444={Directory Share Phone}');
      expect(entryParts[2]).toBe('entry.555={First}');
      expect(entryParts[3]).toBe('entry.444={Directory Share Name}');
      expect(entryParts[4]).toBe('entry.666={Last}');
      expect(entryParts[5]).toBe('entry.444={Directory Share Email}');
      expect(entryParts[6]).toBe('entry.777={Phone}');
    });

    test('should handle %20 encoding for spaces', () => {
      const url = BASE + '?usp=pp_url' +
        '&entry.444=Share%20Name&entry.444=Share%20Email&entry.444=Share%20Phone' +
        '&entry.555=First&entry.666=Last&entry.777=Phone&entry.999=Member%20ID';
      const result = utils.buildPrefillFormTemplate(url);
      expect(result).toContain('entry.999={Member ID}');
      expect(result).toContain('entry.444={Directory Share Name}');
    });

    test('should throw if URL has no entry parameters', () => {
      const url = BASE + '?usp=pp_url';
      expect(() => utils.buildPrefillFormTemplate(url)).toThrow('No entry parameters found');
    });

    test('should throw if a template marker is missing', () => {
      // Missing Member ID
      const url = BASE + '?usp=pp_url' +
        '&entry.444=Share+Name&entry.444=Share+Email&entry.444=Share+Phone' +
        '&entry.555=First&entry.666=Last&entry.777=Phone';
      expect(() => utils.buildPrefillFormTemplate(url)).toThrow('Member ID');
    });

    test('should throw if a checkbox marker is missing', () => {
      // Missing Share Phone
      const url = BASE + '?usp=pp_url' +
        '&entry.444=Share+Name&entry.444=Share+Email' +
        '&entry.555=First&entry.666=Last&entry.777=Phone&entry.999=Member+ID';
      expect(() => utils.buildPrefillFormTemplate(url)).toThrow('Share Phone');
    });

    test('should handle URL without usp parameter', () => {
      const url = BASE + '?' +
        'entry.444=Share+Name&entry.444=Share+Email&entry.444=Share+Phone' +
        '&entry.555=First&entry.666=Last&entry.777=Phone&entry.999=Member+ID';
      const result = utils.buildPrefillFormTemplate(url);
      expect(result).toContain('{First}');
      expect(result).toContain('{Member ID}');
      expect(result).not.toContain('usp=pp_url');
    });

    test('should handle the real-world SCCCC Join/Renew form URL', () => {
      const url = 'https://docs.google.com/forms/d/e/1FAIpQLSd1HNA6BbcJhBmYuSs6aJINbKfxlEyfklWanTgFC0TQ-0cmtg/viewform' +
        '?usp=pp_url' +
        '&entry.1981419329=Yes' +
        '&entry.942593962=I+have+read+the+privacy+policy' +
        '&entry.147802975=I+Agree' +
        '&entry.1934601261=Share+Name' +
        '&entry.1934601261=Share+Email' +
        '&entry.1934601261=Share+Phone' +
        '&entry.617015365=First' +
        '&entry.1319508840=Last' +
        '&entry.1099404401=Phone' +
        '&entry.370903313=1+year+-+$0.50' +
        '&entry.955908988=Member+ID';
      const result = utils.buildPrefillFormTemplate(url);
      expect(result).toBe(
        'https://docs.google.com/forms/d/e/1FAIpQLSd1HNA6BbcJhBmYuSs6aJINbKfxlEyfklWanTgFC0TQ-0cmtg/viewform' +
        '?usp=pp_url' +
        '&entry.1981419329=Yes' +
        '&entry.942593962=I+have+read+the+privacy+policy' +
        '&entry.147802975=I+Agree' +
        '&entry.1934601261={Directory Share Name}' +
        '&entry.1934601261={Directory Share Email}' +
        '&entry.1934601261={Directory Share Phone}' +
        '&entry.617015365={First}' +
        '&entry.1319508840={Last}' +
        '&entry.1099404401={Phone}' +
        '&entry.370903313=1+year+-+$0.50' +
        '&entry.955908988={Member ID}');
    });
  });

  describe('addPrefillForm', () => {
    test('should map Directory Share true to Share checkbox value in URL', () => {
      const member = {
        First: 'John', Last: 'Doe', Phone: '(123) 456-7890',
        'Member ID': 'SC3-AAAAA',
        'Directory Share Name': true, 'Directory Share Email': false, 'Directory Share Phone': true
      };
      const template = 'https://example.com/form?entry.1={First}&entry.2={Last}&entry.3={Phone}&entry.4={Member ID}' +
        '&entry.5={Directory Share Name}&entry.5={Directory Share Email}&entry.5={Directory Share Phone}';
      const result = utils.addPrefillForm(member, template);
      const href = result.Form.match(/href="([^"]+)"/)[1];
      expect(href).toContain('entry.1=John');
      expect(href).toContain('entry.2=Doe');
      expect(href).toContain('entry.4=SC3-AAAAA');
      // true → checkbox text, false → empty
      expect(href).toMatch(/entry\.5=Share%20Name&entry\.5=&entry\.5=Share%20Phone/);
    });

    test('should produce empty values for all false directory shares', () => {
      const member = {
        First: 'Jane', Last: 'Smith', Phone: '555-1234',
        'Member ID': 'SC3-BBBBB',
        'Directory Share Name': false, 'Directory Share Email': false, 'Directory Share Phone': false
      };
      const template = 'https://example.com/form?entry.5={Directory Share Name}&entry.5={Directory Share Email}&entry.5={Directory Share Phone}' +
        '&entry.1={First}&entry.2={Last}&entry.3={Phone}&entry.4={Member ID}';
      const result = utils.addPrefillForm(member, template);
      const href = result.Form.match(/href="([^"]+)"/)[1];
      expect(href).toContain('entry.5=&entry.5=&entry.5=');
    });

    test('should not mutate the original member object', () => {
      const member = {
        First: 'John', Last: 'Doe', Phone: '555-1234',
        'Member ID': 'SC3-AAAAA',
        'Directory Share Name': true, 'Directory Share Email': false, 'Directory Share Phone': false
      };
      const template = 'https://example.com?entry.1={First}&entry.5={Directory Share Name}&entry.5={Directory Share Email}&entry.5={Directory Share Phone}' +
        '&entry.2={Last}&entry.3={Phone}&entry.4={Member ID}';
      utils.addPrefillForm(member, template);
      expect(member['Directory Share Name']).toBe(true);
      expect(member['Directory Share Email']).toBe(false);
    });

    test('should return member copy with Form property as HTML anchor', () => {
      const member = {
        First: 'John', Last: 'Doe', Phone: '555',
        'Member ID': 'SC3-AAAAA',
        'Directory Share Name': false, 'Directory Share Email': false, 'Directory Share Phone': false
      };
      const template = 'https://example.com?entry.1={First}&entry.2={Last}&entry.3={Phone}&entry.4={Member ID}' +
        '&entry.5={Directory Share Name}&entry.5={Directory Share Email}&entry.5={Directory Share Phone}';
      const result = utils.addPrefillForm(member, template);
      expect(result.Form).toMatch(/^<a href="[^"]+">renewal form<\/a>$/);
    });

    test('should work with old-style template that has no Directory Share fields', () => {
      const member = {
        First: 'John', Last: 'Doe', Phone: '555',
        'Directory Share Name': true, 'Directory Share Email': false, 'Directory Share Phone': false
      };
      const template = 'https://example.com?entry.1={First}&entry.2={Last}&entry.3={Phone}';
      const result = utils.addPrefillForm(member, template);
      const href = result.Form.match(/href="([^"]+)"/)[1];
      expect(href).toContain('entry.1=John');
      expect(href).toContain('entry.2=Doe');
      expect(href).toContain('entry.3=555');
    });
  });
});