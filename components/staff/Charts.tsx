"use client";

export function BarChart({
  data,
  format,
}: {
  data: { label: string; value: number }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex gap-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center">
          <div className="flex h-36 w-full items-end">
            <div
              title={format ? format(d.value) : String(d.value)}
              className="w-full rounded-t-md bg-[#FE8C00]"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 4 : 1 }}
            />
          </div>
          <span className="mt-1 text-[10px] text-gray-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function HBars({ rows }: { rows: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-semibold text-gray-600">{r.label}</span>
            <span className="text-gray-400">{r.value}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full"
              style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? "#FE8C00" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string | number;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${warn ? "bg-amber-50" : "bg-white"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${warn ? "text-amber-600" : "text-gray-900"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}