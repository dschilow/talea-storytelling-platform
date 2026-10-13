import { Bell } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNotifications } from '@/contexts/NotificationsContext';
import { motion, useReducedMotion } from 'framer-motion';

export default function NotificationsButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const count = useNotifications()?.summary?.unreadCount ?? 0;
  const reduceMotion = useReducedMotion();
  const active = location.pathname === '/mitteilungen';
  return (
    <motion.button
      type="button"
      onClick={() => navigate('/mitteilungen')}
      aria-label={count ? `Mitteilungen, ${count} ungelesen` : 'Mitteilungen'}
      aria-current={active ? 'page' : undefined}
      className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] text-[var(--talea-text-secondary)] transition-colors hover:bg-[var(--talea-surface-inset)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      style={active ? { background: 'var(--talea-accent-terracotta-soft)', color: 'var(--primary)' } : undefined}
      whileTap={reduceMotion ? undefined : { scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 460, damping: 30 }}
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {count > 0 && (
        <span aria-hidden="true" className="absolute -right-1 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-[var(--primary-foreground)] ring-2 ring-[var(--talea-surface-primary)]">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </motion.button>
  );
}
