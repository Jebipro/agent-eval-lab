import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone/index.js';

const schemaBytes = await readFile(new URL('../../docs/report.schema.json', import.meta.url));
const schema = JSON.parse(schemaBytes);
const ajv = new Ajv2020({
  strict: true, allErrors: false, coerceTypes: false, useDefaults: false, removeAdditional: false,
  code: { source: true, esm: true }
});
addFormats(ajv);
const validate = ajv.compile(schema);
const code = standaloneCode(ajv, validate);
const directory = new URL('../src/generated/', import.meta.url);
await mkdir(directory, { recursive: true });
// Ajv's standalone ESM export may reference format helpers using require().
// Bundle helpers at build time; never compile an input-provided schema in the browser.
let browserCode = code;
for (const name of ['date-time', 'uuid']) {
  const reference = `require("ajv-formats/dist/formats").fullFormats["${name}"]`;
  // Date-time formats depend on helpers. Use a static ESM import instead of serializing functions.
  if (browserCode.includes(reference)) browserCode = browserCode.replaceAll(reference, `fullFormats[${JSON.stringify(name)}]`);
}
if (browserCode.includes('fullFormats[')) browserCode = 'import { fullFormats } from "ajv-formats/dist/formats.js";\n' + browserCode;
if (/\brequire\s*\(/.test(browserCode)) throw new Error('Unexpected CommonJS dependency in generated validator');
await writeFile(new URL('validate.js', directory), browserCode);
await writeFile(new URL('validate.d.ts', directory), `import type { ValidateFunction } from 'ajv';\nimport type { Report } from '../report/types';\ndeclare const validate: ValidateFunction<Report>;\nexport default validate;\n`);
await writeFile(new URL('schema-hash.ts', directory), `export const schemaHash = '${createHash('sha256').update(schemaBytes).digest('hex')}';\n`);
console.log('Generated validator from canonical report.schema.json');
