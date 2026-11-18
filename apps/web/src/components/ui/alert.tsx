import * as React from 'react';
import { cn } from '@/lib/utils';

const tones = {
  info: 'border-sky-600/30 bg-sky-600/10',
  success: 'border-green-600/30 bg-green-600/10',
  warning: 'border-amber-500/40 bg-amber-500/10',
  danger: 'border-destructive/40 bg-destructive/10',
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
  role,
}: {
  tone?: keyof typeof tones;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  role?: string;
}) {
  return (
    <div
      role={role ?? (tone === 'danger' ? 'alert' : 'status')}
      className={cn('rounded-md border p-4 text-sm', tones[tone], className)}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn(title && 'mt-1')}>{children}</div>}
    </div>
  );
}
