/**
 * @fileoverview Tests for MemberIdGenerator class
 * 
 * Tests the Member ID generation utility with comprehensive coverage:
 * - Format validation (SC3-XXXXX pattern)
 * - Charset compliance (no ambiguous characters)
 * - Collision avoidance
 * - Edge cases (empty sets, large sets)
 * - Error handling (maxAttempts exhaustion)
 * - Validation method (isValid)
 * - Getter methods (PREFIX, CHARSET)
 * - Statistical uniqueness
 */

// Load the MemberIdGenerator class and assign to global
const { MemberIdGenerator } = require('../src/common/utils/MemberIdGenerator.js');
global.MemberIdGenerator = MemberIdGenerator;

describe('MemberIdGenerator Class', () => {
  
  describe('generate() - Basic Functionality', () => {
    
    test('should return string matching format SC3-XXXXX', () => {
      const id = MemberIdGenerator.generate(new Set());
      
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^SC3-[A-Z0-9]{5}$/);
      expect(id.length).toBe(9); // 'SC3-' (4) + 5 chars
    });

    test('should use only characters from CHARSET (no ambiguous chars 0, O, I, L, 1)', () => {
      const forbiddenChars = ['0', 'O', 'I', 'L', '1'];
      const allowedChars = MemberIdGenerator.CHARSET.split('');
      
      // Generate multiple IDs to increase confidence
      for (let i = 0; i < 50; i++) {
        const id = MemberIdGenerator.generate(new Set());
        const randomPart = id.substring(4); // Remove 'SC3-' prefix
        
        for (const char of randomPart) {
          expect(allowedChars).toContain(char);
          expect(forbiddenChars).not.toContain(char);
        }
      }
    });

    test('should never return an ID in the existingIds set', () => {
      const existingIds = new Set(['SC3-AAAAA', 'SC3-BBBBB', 'SC3-CCCCC']);
      
      for (let i = 0; i < 20; i++) {
        const id = MemberIdGenerator.generate(existingIds);
        expect(existingIds.has(id)).toBe(false);
      }
    });
  });

  describe('generate() - Input Types', () => {
    
    test('should work with empty existingIds Set', () => {
      const id = MemberIdGenerator.generate(new Set());
      
      expect(id).toMatch(/^SC3-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/);
    });

    test('should work with empty existingIds Array', () => {
      const id = MemberIdGenerator.generate([]);
      
      expect(id).toMatch(/^SC3-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/);
    });

    test('should work with large existingIds set (1000+ entries)', () => {
      const largeSet = new Set();
      
      // Generate 1000 IDs
      for (let i = 0; i < 1000; i++) {
        const id = MemberIdGenerator.generate(largeSet);
        largeSet.add(id);
      }
      
      // Generate one more that doesn't collide
      const newId = MemberIdGenerator.generate(largeSet);
      expect(largeSet.has(newId)).toBe(false);
      expect(newId).toMatch(/^SC3-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/);
    });

    test('should work with existingIds as Array', () => {
      const existingArray = ['SC3-AAAAA', 'SC3-BBBBB'];
      const id = MemberIdGenerator.generate(existingArray);
      
      expect(existingArray).not.toContain(id);
      expect(id).toMatch(/^SC3-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/);
    });
  });

  describe('generate() - Error Handling', () => {
    
    test('should throw after maxAttempts if all IDs collide', () => {
      // Mock Math.random to always return 0 (always generates same ID)
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0);
      
      const existingIds = new Set(['SC3-AAAAA']); // Pre-add the ID that will be generated
      
      expect(() => {
        MemberIdGenerator.generate(existingIds, 10);
      }).toThrow('Unable to generate unique Member ID after 10 attempts');
      
      // Restore Math.random
      Math.random = originalRandom;
    });

    test('should use default maxAttempts of 100', () => {
      // Mock Math.random to always return 0
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0);
      
      const existingIds = new Set(['SC3-AAAAA']);
      
      expect(() => {
        MemberIdGenerator.generate(existingIds); // No maxAttempts specified
      }).toThrow('Unable to generate unique Member ID after 100 attempts');
      
      Math.random = originalRandom;
    });
  });

  describe('isValid() - Valid IDs', () => {
    
    test('should return true for valid IDs like SC3-A7K3M', () => {
      expect(MemberIdGenerator.isValid('SC3-A7K3M')).toBe(true);
      expect(MemberIdGenerator.isValid('SC3-ZZZZZ')).toBe(true);
      expect(MemberIdGenerator.isValid('SC3-23456')).toBe(true);
      expect(MemberIdGenerator.isValid('SC3-ABCDE')).toBe(true);
      expect(MemberIdGenerator.isValid('SC3-H9M2P')).toBe(true);
    });

    test('should accept any character from CHARSET', () => {
      const charset = MemberIdGenerator.CHARSET;
      
      // Build an ID using each character in charset
      for (let i = 0; i < charset.length; i++) {
        const char = charset[i];
        const testId = `SC3-${char}${char}${char}${char}${char}`;
        expect(MemberIdGenerator.isValid(testId)).toBe(true);
      }
    });
  });

  describe('isValid() - Invalid IDs', () => {
    
    test('should return false for empty string, null, undefined', () => {
      expect(MemberIdGenerator.isValid('')).toBe(false);
      expect(MemberIdGenerator.isValid(null)).toBe(false);
      expect(MemberIdGenerator.isValid(undefined)).toBe(false);
    });

    test('should return false for non-string types', () => {
      expect(MemberIdGenerator.isValid(12345)).toBe(false);
      expect(MemberIdGenerator.isValid({})).toBe(false);
      expect(MemberIdGenerator.isValid([])).toBe(false);
      expect(MemberIdGenerator.isValid(true)).toBe(false);
    });

    test('should return false for wrong prefix', () => {
      expect(MemberIdGenerator.isValid('ABC-A7K3M')).toBe(false);
      expect(MemberIdGenerator.isValid('SC2-A7K3M')).toBe(false);
      expect(MemberIdGenerator.isValid('SC3A7K3M')).toBe(false); // Missing dash
      expect(MemberIdGenerator.isValid('SC3_A7K3M')).toBe(false); // Wrong separator
    });

    test('should return false for wrong length', () => {
      expect(MemberIdGenerator.isValid('SC3-A7K')).toBe(false); // Too short
      expect(MemberIdGenerator.isValid('SC3-A7K3')).toBe(false); // 4 chars
      expect(MemberIdGenerator.isValid('SC3-A7K3M9')).toBe(false); // Too long
      expect(MemberIdGenerator.isValid('SC3-A7K3M9X')).toBe(false); // 7 chars
    });

    test('should return false for ambiguous chars (0, O, I, L, 1)', () => {
      expect(MemberIdGenerator.isValid('SC3-A0K3M')).toBe(false); // Contains 0
      expect(MemberIdGenerator.isValid('SC3-AOK3M')).toBe(false); // Contains O
      expect(MemberIdGenerator.isValid('SC3-AIK3M')).toBe(false); // Contains I
      expect(MemberIdGenerator.isValid('SC3-ALK3M')).toBe(false); // Contains L
      expect(MemberIdGenerator.isValid('SC3-A1K3M')).toBe(false); // Contains 1
    });

    test('should return false for lowercase', () => {
      expect(MemberIdGenerator.isValid('SC3-a7k3m')).toBe(false);
      expect(MemberIdGenerator.isValid('SC3-A7k3m')).toBe(false); // Mixed case
      expect(MemberIdGenerator.isValid('sc3-A7K3M')).toBe(false); // Lowercase prefix
    });

    test('should return false for special characters', () => {
      expect(MemberIdGenerator.isValid('SC3-A7K!M')).toBe(false);
      expect(MemberIdGenerator.isValid('SC3-A@K3M')).toBe(false);
      expect(MemberIdGenerator.isValid('SC3-A7K#M')).toBe(false);
      expect(MemberIdGenerator.isValid('SC3-A K3M')).toBe(false); // Space
    });
  });

  describe('Getters', () => {
    
    test('PREFIX getter should return SC3-', () => {
      expect(MemberIdGenerator.PREFIX).toBe('SC3-');
    });

    test('CHARSET getter should return expected 31-char string', () => {
      const charset = MemberIdGenerator.CHARSET;
      
      // 26 letters - 3 ambiguous (O, I, L) + 10 digits - 2 ambiguous (0, 1) = 31
      expect(charset.length).toBe(31);
      expect(charset).toBe('ABCDEFGHJKMNPQRSTUVWXYZ23456789');
      
      // Verify no ambiguous characters
      expect(charset).not.toContain('0');
      expect(charset).not.toContain('O');
      expect(charset).not.toContain('I');
      expect(charset).not.toContain('L');
      expect(charset).not.toContain('1');
    });
  });

  describe('Statistical Uniqueness', () => {
    
    test('100 generated IDs should all be unique', () => {
      const generatedIds = new Set();
      
      for (let i = 0; i < 100; i++) {
        const id = MemberIdGenerator.generate(generatedIds);
        
        // Should not exist yet
        expect(generatedIds.has(id)).toBe(false);
        
        // Add to set
        generatedIds.add(id);
      }
      
      // All 100 should be unique
      expect(generatedIds.size).toBe(100);
    });

    test('generated IDs should have reasonable randomness', () => {
      const generatedIds = [];
      
      // Generate 20 IDs
      for (let i = 0; i < 20; i++) {
        generatedIds.push(MemberIdGenerator.generate(new Set(generatedIds)));
      }
      
      // Check that not all IDs start with the same character
      const firstChars = new Set(generatedIds.map(id => id[4])); // First char after 'SC3-'
      expect(firstChars.size).toBeGreaterThan(1);
      
      // Check that not all IDs end with the same character
      const lastChars = new Set(generatedIds.map(id => id[8])); // Last char
      expect(lastChars.size).toBeGreaterThan(1);
    });
  });
});
