import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const metadata = { title: 'Acesso administrativo', robots: { index: false } };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-2 text-2xl font-bold">Acesso da equipe</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Voluntários, tesouraria e responsável de TI.
      </p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
