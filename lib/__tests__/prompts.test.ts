import { describe, expect, test } from 'vitest';
import { buildUserSystemPrompt } from '../ai/prompts';
import type { UserSystemPrompt } from '../types';

describe('System Prompt Builder', () => {
  describe('buildUserSystemPrompt', () => {
    test('returns empty string for empty prompt', () => {
      const emptyPrompt: UserSystemPrompt = {};
      const result = buildUserSystemPrompt(emptyPrompt);
      expect(result).toBe('');
    });

    test('returns empty string for null/undefined prompt', () => {
      expect(buildUserSystemPrompt(null as any)).toBe('');
      expect(buildUserSystemPrompt(undefined as any)).toBe('');
    });

    test('builds prompt with only name', () => {
      const prompt: UserSystemPrompt = {
        name: 'Alice',
      };

      const result = buildUserSystemPrompt(prompt);
      expect(result).toContain('User Information:');
      expect(result).toContain('- Name: Alice');
      expect(result).not.toContain('Profession:');
      expect(result).not.toContain('Personality Traits:');
      expect(result).not.toContain('User Preferences:');
    });

    test('builds prompt with only profession', () => {
      const prompt: UserSystemPrompt = {
        profession: 'Software Engineer',
      };

      const result = buildUserSystemPrompt(prompt);
      expect(result).toContain('User Information:');
      expect(result).toContain('- Profession: Software Engineer');
      expect(result).not.toContain('Name:');
      expect(result).not.toContain('Personality Traits:');
      expect(result).not.toContain('User Preferences:');
    });

    test('builds prompt with only traits', () => {
      const prompt: UserSystemPrompt = {
        traits: ['analytical', 'friendly'],
      };

      const result = buildUserSystemPrompt(prompt);
      expect(result).toContain('User Information:');
      expect(result).toContain('- Personality Traits: analytical, friendly');
      expect(result).not.toContain('Name:');
      expect(result).not.toContain('Profession:');
      expect(result).not.toContain('User Preferences:');
    });

    test('builds prompt with only preferences', () => {
      const prompt: UserSystemPrompt = {
        preferences: 'Please be concise and technical',
      };

      const result = buildUserSystemPrompt(prompt);
      expect(result).toContain('User Preferences:');
      expect(result).toContain('Please be concise and technical');
      expect(result).not.toContain('User Information:');
    });

    test('builds complete prompt with all fields', () => {
      const prompt: UserSystemPrompt = {
        name: 'John Doe',
        profession: 'Data Scientist',
        traits: ['analytical', 'detail-oriented', 'curious'],
        preferences:
          'I prefer technical explanations with examples. Please be thorough but concise.',
      };

      const result = buildUserSystemPrompt(prompt);

      // Check structure
      expect(result).toContain('User Information:');
      expect(result).toContain('User Preferences:');

      // Check content
      expect(result).toContain('- Name: John Doe');
      expect(result).toContain('- Profession: Data Scientist');
      expect(result).toContain(
        '- Personality Traits: analytical, detail-oriented, curious',
      );
      expect(result).toContain(
        'I prefer technical explanations with examples. Please be thorough but concise.',
      );

      // Check sections are separated
      const sections = result.split('\n\n');
      expect(sections.length).toBe(2); // User Information + User Preferences
    });

    test('handles empty traits array', () => {
      const prompt: UserSystemPrompt = {
        name: 'Alice',
        traits: [],
      };

      const result = buildUserSystemPrompt(prompt);
      expect(result).toContain('- Name: Alice');
      expect(result).not.toContain('Personality Traits:');
    });

    test('handles single trait', () => {
      const prompt: UserSystemPrompt = {
        traits: ['friendly'],
      };

      const result = buildUserSystemPrompt(prompt);
      expect(result).toContain('- Personality Traits: friendly');
    });

    test('formats multiple sections correctly', () => {
      const prompt: UserSystemPrompt = {
        name: 'Test User',
        preferences: 'Test preferences',
      };

      const result = buildUserSystemPrompt(prompt);
      const sections = result.split('\n\n');

      expect(sections[0]).toContain('User Information:');
      expect(sections[0]).toContain('- Name: Test User');
      expect(sections[1]).toContain('User Preferences:');
      expect(sections[1]).toContain('Test preferences');
    });

    test('trims whitespace properly', () => {
      const prompt: UserSystemPrompt = {
        name: '  Alice  ',
        profession: '  Engineer  ',
        preferences: '  Be helpful  ',
      };

      const result = buildUserSystemPrompt(prompt);
      expect(result).toContain('- Name:   Alice  '); // Preserves original spacing
      expect(result).toContain('- Profession:   Engineer  ');
      expect(result).toContain('  Be helpful  ');
    });
  });
});
