import { Orbit } from 'lucide-react';

export function Brand() {
  return <div className="flex items-center gap-3">
    <span className="brand-chip" aria-hidden="true"><Orbit size={23} strokeWidth={2.2}/></span>
    <div>
      <div className="text-xl font-bold tracking-tight text-ink">Disha<span className="text-brand">360</span></div>
      <div className="text-[10px] font-semibold uppercase tracking-[.15em] text-slate-400">Placement training</div>
    </div>
  </div>;
}
