import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openapiSpec } from '../src/docs/openapi';

const out = resolve(__dirname, '../../../docs/openapi.json');
writeFileSync(out, JSON.stringify(openapiSpec, null, 2) + '\n');
console.log(`OpenAPI exportado para ${out}`);
