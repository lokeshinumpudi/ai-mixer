import { describe, expect, test } from 'vitest';
import {
  SYSTEM_PROMPT_LIMITS,
  systemPromptSchema,
  validateSystemPrompt,
  validateSystemPromptSafe,
} from '../validations';

describe('System Prompt Validation', () => {
  describe('systemPromptSchema', () => {
    test('validates valid system prompt data', () => {
      const validData = {
        name: 'John Doe',
        profession: 'Software Engineer',
        traits: ['friendly', 'analytical'],
        preferences: 'Please be concise and technical',
      };

      const result = systemPromptSchema.parse(validData);
      expect(result).toEqual(validData);
    });

    test('allows empty/undefined fields', () => {
      const emptyData = {};
      const result = systemPromptSchema.parse(emptyData);
      expect(result).toEqual({});
    });

    test('validates character limits for name', () => {
      const longName = 'a'.repeat(SYSTEM_PROMPT_LIMITS.NAME_MAX + 1);

      expect(() => {
        systemPromptSchema.parse({ name: longName });
      }).toThrow('Name must be 100 characters or less');
    });

    test('validates character limits for profession', () => {
      const longProfession = 'a'.repeat(
        SYSTEM_PROMPT_LIMITS.PROFESSION_MAX + 1,
      );

      expect(() => {
        systemPromptSchema.parse({ profession: longProfession });
      }).toThrow('Profession must be 200 characters or less');
    });

    test('validates traits array limits', () => {
      const tooManyTraits = Array(
        SYSTEM_PROMPT_LIMITS.TRAITS_MAX_COUNT + 1,
      ).fill('trait');

      expect(() => {
        systemPromptSchema.parse({ traits: tooManyTraits });
      }).toThrow('Maximum 50 traits allowed');
    });

    test('validates individual trait character limits', () => {
      const longTrait = 'a'.repeat(SYSTEM_PROMPT_LIMITS.TRAIT_MAX_LENGTH + 1);

      expect(() => {
        systemPromptSchema.parse({ traits: [longTrait] });
      }).toThrow('Each trait must be 100 characters or less');
    });

    test('validates preferences character limit', () => {
      const longPreferences = 'a'.repeat(
        SYSTEM_PROMPT_LIMITS.PREFERENCES_MAX + 1,
      );

      expect(() => {
        systemPromptSchema.parse({ preferences: longPreferences });
      }).toThrow('Preferences must be 3000 characters or less');
    });
  });

  describe('validateSystemPrompt', () => {
    test('returns parsed data for valid input', () => {
      const validData = {
        name: 'Alice',
        profession: 'Designer',
        traits: ['creative'],
        preferences: 'Visual explanations preferred',
      };

      const result = validateSystemPrompt(validData);
      expect(result).toEqual(validData);
    });

    test('throws error for invalid input', () => {
      const invalidData = {
        name: 'a'.repeat(200), // Too long
      };

      expect(() => {
        validateSystemPrompt(invalidData);
      }).toThrow();
    });
  });

  describe('validateSystemPromptSafe', () => {
    test('returns success for valid data', () => {
      const validData = {
        name: 'Bob',
        profession: 'Teacher',
      };

      const result = validateSystemPromptSafe(validData);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
      expect(result.error).toBeUndefined();
    });

    test('returns error for invalid data', () => {
      const invalidData = {
        name: 'a'.repeat(200), // Too long
      };

      const result = validateSystemPromptSafe(invalidData);
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    test('handles non-object input gracefully', () => {
      const result = validateSystemPromptSafe('invalid');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('SYSTEM_PROMPT_LIMITS', () => {
    test('has correct limit values', () => {
      expect(SYSTEM_PROMPT_LIMITS.NAME_MAX).toBe(100);
      expect(SYSTEM_PROMPT_LIMITS.PROFESSION_MAX).toBe(200);
      expect(SYSTEM_PROMPT_LIMITS.TRAITS_MAX_COUNT).toBe(50);
      expect(SYSTEM_PROMPT_LIMITS.TRAIT_MAX_LENGTH).toBe(100);
      expect(SYSTEM_PROMPT_LIMITS.PREFERENCES_MAX).toBe(3000);
    });
  });
});
