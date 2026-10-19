import { expect, test } from 'vitest';
import { add } from './add';
test('adds positive and negative numbers', () => { expect(add(2, 3)).toBe(5); expect(add(-2, 1)).toBe(-1); });
