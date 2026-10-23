import { readFileSync } from 'node:fs';
import type { Report } from '../src/report/types';
import { fixturePath } from './data-source';
export const fixtureText = (file: string): string => readFileSync(fixturePath(file), 'utf8');
export const fixture = (file = 'scenario/normal.json'): Report => JSON.parse(fixtureText(file)) as Report;
export const bytes = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
