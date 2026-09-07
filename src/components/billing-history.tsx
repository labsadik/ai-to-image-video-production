import { CreditCard, ExternalLink } from 'lucide-react';

export type BillingTransaction = {
  id: string;
  kind: string;
  status: string;
  plan_id: string | null;
  description: string | null;
  amount_minor: number;
  currency: string;
  purchased_at: string;
  period_end: string | null;
  receipt_url: string | null;
};

function money(amountMinor: number, currency: string) { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amountMinor / 100); }
function label(kind: string, planId: string | null, description: string | null) { if (description) return description; if (kind === 'plan' || kind === 'renewal') return `${planId === 'business' ? 'Growth' : 'Starter'} plan`; if (kind === 'credit_pack') return 'Credit purchase'; if (kind === 'addon') return 'Credit add-on'; return 'Billing transaction'; }

export function BillingHistory({ transactions }: { transactions: BillingTransaction[] }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700"><CreditCard className="size-4" /></span><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">Billing history</p><h2 className="mt-1 text-lg font-semibold text-slate-950">Payments saved to your account</h2><p className="mt-1 text-xs leading-5 text-slate-500">Verified Stripe payments and subscription renewals are stored against your user profile.</p></div></div>{transactions.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No completed payments yet.</div> : <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400"><th className="px-3 py-3 font-semibold">Date</th><th className="px-3 py-3 font-semibold">Description</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold text-right">Amount</th><th className="px-3 py-3" /></tr></thead><tbody>{transactions.map((transaction)=><tr key={transaction.id} className="border-b border-slate-50 last:border-0"><td className="px-3 py-4 text-xs text-slate-500">{new Date(transaction.purchased_at).toLocaleDateString()}</td><td className="px-3 py-4"><p className="text-sm font-semibold text-slate-900">{label(transaction.kind, transaction.plan_id, transaction.description)}</p>{transaction.period_end&&<p className="mt-1 text-[11px] text-slate-400">Period ends {new Date(transaction.period_end).toLocaleDateString()}</p>}</td><td className="px-3 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${transaction.status==='paid'?'bg-emerald-50 text-emerald-700':transaction.status==='refunded'?'bg-amber-50 text-amber-700':'bg-slate-100 text-slate-600'}`}>{transaction.status}</span></td><td className="px-3 py-4 text-right text-sm font-semibold text-slate-900">{money(Number(transaction.amount_minor), transaction.currency)}</td><td className="px-3 py-4 text-right">{transaction.receipt_url&&<a href={transaction.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">Receipt <ExternalLink className="size-3" /></a>}</td></tr>)}</tbody></table></div>}</section>;
}
