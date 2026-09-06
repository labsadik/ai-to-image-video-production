'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

const styles = {
  primary: 'bg-slate-950 text-white shadow-sm hover:bg-slate-800 focus-visible:ring-slate-300',
  secondary: 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:ring-slate-200',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-slate-200',
  danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50 focus-visible:ring-red-200',
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof styles;
  loading?: boolean;
  children: ReactNode;
};

export function Button({ variant = 'primary', loading = false, disabled, children, className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-[background-color,transform,box-shadow,opacity] duration-200 focus-visible:outline-none focus-visible:ring-4 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
