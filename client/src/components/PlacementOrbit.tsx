import { BookOpen, Code2, Compass, MessageCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export function PlacementOrbit() {
  return <div className="placement-orbit" aria-hidden="true">
    <div className="orbit-label orbit-label-top"><span><i /> TRAINING NETWORK</span><span>D360 / 01</span></div>
    <div className="orbit-diagram">
      <svg className="orbit-wires" viewBox="0 0 560 350" fill="none">
        <ellipse cx="280" cy="175" rx="205" ry="122" />
        <ellipse cx="280" cy="175" rx="158" ry="89" />
        <path d="M280 24v302M50 175h460" className="orbit-axis" />
        <path d="m134 92 79 1 67 82 73-49h91m-164 49 31 91h66" className="orbit-trace" />
        <circle cx="133" cy="92" r="4" /><circle cx="437" cy="126" r="4" /><circle cx="377" cy="266" r="4" />
      </svg>
      <div className="orbit-core"><Compass /></div>
      <span className="orbit-node orbit-learn"><BookOpen size={14}/> LEARN</span>
      <span className="orbit-node orbit-code"><Code2 size={15}/> PRACTISE</span>
      <span className="orbit-node orbit-interview"><MessageCircle size={14}/> INTERVIEW</span>
    </div>
    <div className="orbit-label orbit-label-bottom"><span>BUILD YOUR SKILLS</span><span>ONE STEP AT A TIME</span></div>
  </div>;
}

export function WorkspaceHero({ eyebrow, title, detail, children }: {
  eyebrow: string;
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return <section className="workspace-hero mb-7" aria-labelledby="workspace-title">
    <div className="min-w-0">
      <p className="signal-kicker"><i /> {eyebrow}</p>
      <h1 id="workspace-title">{title}</h1>
      <p className="hero-detail">{detail}</p>
      {children && <div className="mt-5 flex flex-wrap gap-2.5">{children}</div>}
    </div>
    <PlacementOrbit />
  </section>;
}
