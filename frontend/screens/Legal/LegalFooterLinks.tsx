import { Link } from 'react-router-dom';
import { LEGAL_INFO_COMPLETE, LEGAL_PAGES } from './legalInfo';

/** Impressum · Datenschutz · AGB, shown once the operator details are filled in (see legalInfo.ts). */
export default function LegalFooterLinks({ className }: { className?: string }) {
  if (!LEGAL_INFO_COMPLETE) return null;
  return (
    <nav aria-label="Rechtliches" className={className}>
      {LEGAL_PAGES.map(page => <Link key={page.path} to={page.path}>{page.label}</Link>)}
    </nav>
  );
}
