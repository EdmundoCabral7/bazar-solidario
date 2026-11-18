import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const envFile = resolve(__dirname, '../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const testDb =
  process.env.DATABASE_URL_TEST ??
  'postgresql://bazar:bazar@localhost:5433/bazar_test?schema=public';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDb,
      JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret-com-pelo-menos-32-caracteres!!',
      INTEGRATIONS_MODE: 'mock',
    },
  },
});
