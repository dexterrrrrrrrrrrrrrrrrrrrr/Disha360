import { Link } from 'react-router-dom';
import { BookOpen, Code2, MessageSquare } from 'lucide-react';
import type { ReactNode } from 'react';
import { Brand } from '../components/Brand';
import { PlacementOrbit } from '../components/PlacementOrbit';

const pathways = [
  { Icon: BookOpen, label: 'Learning modules' },
  { Icon: Code2, label: 'Coding practice' },
  { Icon: MessageSquare, label: 'Mock interviews' },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="auth-shell">
    <header className="auth-top">
      <Link to="/login" aria-label="Disha360 home"><Brand /></Link>
      <span className="signal-kicker"><i /> PLACEMENT WORKSPACE</span>
    </header>
    <div className="auth-grid">
      <main id="main-content" tabIndex={-1} className="auth-main">
        <div className="auth-card">{children}</div>
      </main>
      <aside className="auth-story" aria-label="Placement preparation">
        <p className="signal-kicker"><i /> LEARN / PRACTISE / PREPARE</p>
        <h2>Build skills.<br/><span>Get placement ready.</span></h2>
        <p className="auth-description">Follow your learning plan, practise for interviews, and see your progress in one workspace.</p>
        <PlacementOrbit />
        <ul className="auth-pathways">{pathways.map(({ Icon, label }) =>
          <li key={label}><Icon size={15} aria-hidden="true" />{label}</li>)}</ul>
      </aside>
    </div>
    <footer className="auth-footer"><span>© {new Date().getFullYear()} Disha360</span><span>Placement preparation, one step at a time.</span></footer>
  </div>;
}
