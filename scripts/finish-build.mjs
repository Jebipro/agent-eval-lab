import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { reportSchema } from '../dist/report/schema.js';
chmodSync('dist/cli/index.js', 0o755);
mkdirSync('docs', { recursive: true });
writeFileSync('docs/report.schema.json', JSON.stringify(z.toJSONSchema(reportSchema), null, 2) + '\n');
