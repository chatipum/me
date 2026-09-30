export const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none';
export const buttonClass =
  'rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50';
export const secondaryButtonClass =
  'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-50';

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the input is passed as children and nested in the label
    <label className="block space-y-1">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      {children}
      {error && <span className="block text-sm text-red-600">{error}</span>}
    </label>
  );
}
