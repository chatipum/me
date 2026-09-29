import { afterEach, describe, expect, test } from 'bun:test';
import { requireEnv } from './env';

describe('requireEnv', () => {
  afterEach(() => {
    delete process.env.TEST_ENV_VALUE;
  });

  test('returns the value when set', () => {
    process.env.TEST_ENV_VALUE = 'abc';
    expect(requireEnv('TEST_ENV_VALUE')).toBe('abc');
  });

  test('throws when missing or empty', () => {
    expect(() => requireEnv('TEST_ENV_VALUE')).toThrow('Missing env: TEST_ENV_VALUE');
    process.env.TEST_ENV_VALUE = '';
    expect(() => requireEnv('TEST_ENV_VALUE')).toThrow('Missing env: TEST_ENV_VALUE');
  });
});
