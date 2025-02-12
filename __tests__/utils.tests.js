
(Utils = require('../src/JavaScript/utils'));

describe('utils', () => {
    it('has a getDateString() function', () => {
        expect(Utils.getDateString).toBeDefined();
    });
    it('has a addYearsToDate() function', () => {
        expect(Utils.addYearsToDate).toBeDefined();
    });
    it('addYearsToDate() should add years to a date', () => {
        const date = Utils.getDateString("2020-03-01");
        const result = Utils.addYearsToDate(date, 1);
        expect(result).toEqual(Utils.getDateString("2021-03-01"));
    });
    it('should handle a negative number of years', () => {
        const date = new Date("2020-03-01");
        const result = Utils.addYearsToDate(date, -1);
        expect(result).toEqual("2019-03-01");
    });
    describe('calculateExpirationDate', () => {
        test('should calculate expiration date based on period in years from today if no existing expiration date is provided', () => {
            const period = 2;
            const result = Utils.calculateExpirationDate(period);
            const expectedDate = new Date();
            expectedDate.setFullYear(expectedDate.getFullYear() + period);
            expect(result).toEqual(Utils.getDateString(expectedDate));
        });

        test('should calculate expiration date based on period in years from existing expiration date if provided', () => {
            const period = 3;
            const existingExpirationDate = new Date('2030-01-01');
            const result = Utils.calculateExpirationDate(period, existingExpirationDate);
            const expectedDate = Utils.getDateString('2033-01-01');
            expect(result).toEqual(expectedDate);
        });
        test('should return the greater of period added to today or the existing expiration date', () => {
            const period = 1;
            const existingExpirationDate = new Date();
            existingExpirationDate.setFullYear(existingExpirationDate.getFullYear() + 2);
            const result = Utils.calculateExpirationDate(period, existingExpirationDate);
            const expectedDate = new Date();
            expectedDate.setFullYear(expectedDate.getFullYear() + period + 2);
            expect(result).toEqual(Utils.getDateString(expectedDate));
        });

        test('should handle leap years correctly', () => {
            const period = 1;
            const existingExpirationDate = new Date('2052-02-29');
            const result = Utils.calculateExpirationDate(period, existingExpirationDate);
            const expectedDate = new Date('2053-03-01')
            expect(result).toEqual(Utils.getDateString(expectedDate));
        });

        test('should handle negative periods correctly', () => {
            const period = -1;
            const existingExpirationDate = new Date('2050-01-01');
            const result = Utils.calculateExpirationDate(period, existingExpirationDate);
            const expectedDate = new Date('2049-01-01');
            expect(result).toEqual(Utils.getDateString(expectedDate));
        });
    });
    describe('addDaysToDate  ', () => {
        it('should add a number of days to a date', () => {
          const date = Utils.getDateString('2021-01-01');
          const result = Utils.addDaysToDate(date, 2);
          expect(result).toEqual(Utils.getDateString('2021-01-03'));
        });
        it('shoud work with negative numbers', () => {
          const date = Utils.getDateString('2021-01-01');
          const result = Utils.addDaysToDate(date, -2);
          expect(result).toEqual(Utils.getDateString('2020-12-30'));
        });
        it('should work with zero', () => {
          const date = Utils.getDateString('2021-01-01');
          const result = Utils.addDaysToDate(date, 0);
          expect(result).toEqual(Utils.getDateString('2021-01-01'));
        });
        it('should work with a string date', () => {
          const date = '2021-01-01';
          const result = Utils.addDaysToDate(date, 2);
          expect(result).toEqual(Utils.getDateString('2021-01-03'));
        });
      })

})
