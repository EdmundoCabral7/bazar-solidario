import { execSync } from 'node:child_process';

/** Aplica as migrations no banco de teste (DATABASE_URL_TEST) antes da suíte. */
export default function setup() {
  const url =
    process.env.DATABASE_URL_TEST ??
    'postgresql://bazar:bazar@localhost:5433/bazar_test?schema=public';
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  });
}
