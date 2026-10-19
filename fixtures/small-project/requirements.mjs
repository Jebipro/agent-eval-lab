import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
assert.match(readFileSync('src/add.ts', 'utf8'), /export function add/);
console.log('Required public add function is present.');
