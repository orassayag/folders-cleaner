import { describe, it, expect } from 'vitest';
import { settings } from '../index.js';

describe('settings', () => {
  it('should have a targetPath', () => {
    expect(settings).toHaveProperty('targetPath');
    expect(typeof settings.targetPath).toBe('string');
  });
});
