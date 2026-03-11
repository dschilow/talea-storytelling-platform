import type { SVGProps } from 'react';
import type { AgentId } from '../../types/agent';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Tavi({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="24" cy="24" r="20" fill="currentColor" opacity="0.12" />
      <circle cx="24" cy="24" r="14" fill="currentColor" opacity="0.2" />
      <path
        d="M24 12c-2 0-4 1-5 3l-3 6c-1 2 0 4 2 5l4 2c1.3.6 2.7.6 4 0l4-2c2-1 3-3 2-5l-3-6c-1-2-3-3-5-3z"
        fill="currentColor"
        opacity="0.85"
      />
      <circle cx="20.5" cy="22" r="1.5" fill="white" />
      <circle cx="27.5" cy="22" r="1.5" fill="white" />
      <path d="M22 27c0 0 1 1.5 2 1.5s2-1.5 2-1.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path
        d="M16 18c-1-3 0-6 2-7M32 18c1-3 0-6-2-7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

function Fluesterfeder({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M34 8c-3 0-6 2-8 5L14 32c-1 2-1 4 0 5l2 2c1 1 3 1 5 0l19-12c3-2 5-5 5-8 0-4-3-8-6-10-1-.6-3-1-5-1z"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M32 10c-2.5 0-5 1.5-7 4L14 31c-.8 1.2-.5 2.5.5 3l1.5 1c1 .5 2 .2 3-.5L31 20c2.5-2 4-4.5 4-7 0-1.5-1-3-3-3z"
        fill="currentColor"
        opacity="0.7"
      />
      <line x1="14" y1="34" x2="10" y2="40" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M22 18l-2 3" stroke="white" strokeWidth="0.8" opacity="0.5" />
      <path d="M26 14l-2 3" stroke="white" strokeWidth="0.8" opacity="0.5" />
      <path d="M18 23l-2 3" stroke="white" strokeWidth="0.8" opacity="0.5" />
    </svg>
  );
}

function Sternenweber({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="24" cy="14" r="2.5" fill="currentColor" opacity="0.9" />
      <circle cx="12" cy="28" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="36" cy="28" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="18" cy="38" r="1.8" fill="currentColor" opacity="0.6" />
      <circle cx="30" cy="38" r="1.8" fill="currentColor" opacity="0.6" />
      <circle cx="8" cy="16" r="1.2" fill="currentColor" opacity="0.4" />
      <circle cx="40" cy="16" r="1.2" fill="currentColor" opacity="0.4" />
      <line x1="24" y1="14" x2="12" y2="28" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <line x1="24" y1="14" x2="36" y2="28" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <line x1="12" y1="28" x2="18" y2="38" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <line x1="36" y1="28" x2="30" y2="38" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <line x1="18" y1="38" x2="30" y2="38" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <line x1="12" y1="28" x2="36" y2="28" stroke="currentColor" strokeWidth="0.8" opacity="0.2" />
      <circle cx="24" cy="14" r="6" fill="currentColor" opacity="0.08" />
    </svg>
  );
}

function Traumwaechter({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="1.5" opacity="0.2" fill="none" />
      <circle cx="24" cy="24" r="11" stroke="currentColor" strokeWidth="1" opacity="0.15" fill="none" />
      <path
        d="M24 10c-2 0-4 2-4 5 0 4 4 7 4 7s4-3 4-7c0-3-2-5-4-5z"
        fill="currentColor"
        opacity="0.6"
      />
      <circle cx="24" cy="16" r="2" fill="currentColor" opacity="0.8" />
      <path
        d="M15 26c1.5-1 3.5-1 5 0M28 26c1.5-1 3.5-1 5 0"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.3"
      />
      <circle cx="24" cy="24" r="20" fill="currentColor" opacity="0.05" />
    </svg>
  );
}

function Funkenwerkstatt({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="12" y="22" width="24" height="18" rx="4" fill="currentColor" opacity="0.15" />
      <rect x="15" y="25" width="18" height="12" rx="2" fill="currentColor" opacity="0.3" />
      <path d="M18 22V18c0-3.3 2.7-6 6-6s6 2.7 6 6v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5" />
      <circle cx="20" cy="14" r="1.2" fill="currentColor" opacity="0.7" />
      <circle cx="28" cy="12" r="1" fill="currentColor" opacity="0.6" />
      <circle cx="24" cy="10" r="0.8" fill="currentColor" opacity="0.5" />
      <circle cx="16" cy="16" r="0.7" fill="currentColor" opacity="0.4" />
      <circle cx="32" cy="15" r="0.6" fill="currentColor" opacity="0.35" />
      <path d="M21 31l2-3 2 3 2-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
}

function Artefaktschmied({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M24 8l6 10h-12l6-10z"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M24 10l8 14H16l8-14z"
        fill="currentColor"
        opacity="0.3"
      />
      <path
        d="M24 14l5 8H19l5-8z"
        fill="currentColor"
        opacity="0.6"
      />
      <rect x="18" y="28" width="12" height="4" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="20" y="32" width="8" height="6" rx="1" fill="currentColor" opacity="0.25" />
      <line x1="24" y1="17" x2="24" y2="22" stroke="white" strokeWidth="1" opacity="0.5" />
      <line x1="21" y1="20" x2="27" y2="20" stroke="white" strokeWidth="1" opacity="0.4" />
      <circle cx="14" cy="12" r="0.8" fill="currentColor" opacity="0.3" />
      <circle cx="34" cy="12" r="0.8" fill="currentColor" opacity="0.3" />
      <circle cx="10" cy="20" r="0.6" fill="currentColor" opacity="0.2" />
      <circle cx="38" cy="18" r="0.6" fill="currentColor" opacity="0.2" />
    </svg>
  );
}

function Pfadfinder({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="24" cy="24" r="16" stroke="currentColor" strokeWidth="1.2" opacity="0.2" fill="none" />
      <circle cx="24" cy="24" r="11" stroke="currentColor" strokeWidth="0.8" opacity="0.15" fill="none" />
      <path d="M24 10v28M10 24h28" stroke="currentColor" strokeWidth="0.6" opacity="0.15" />
      <path
        d="M24 12l3 8-8-3 10-2-5 8z"
        fill="currentColor"
        opacity="0.6"
      />
      <path
        d="M24 36l-3-8 8 3-10 2 5-8z"
        fill="currentColor"
        opacity="0.3"
      />
      <circle cx="24" cy="24" r="2.5" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

function Leuchtglas({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <ellipse cx="24" cy="24" rx="14" ry="18" fill="currentColor" opacity="0.08" />
      <ellipse cx="24" cy="24" rx="10" ry="14" stroke="currentColor" strokeWidth="1.5" opacity="0.3" fill="none" />
      <ellipse cx="24" cy="24" rx="6" ry="9" fill="currentColor" opacity="0.15" />
      <circle cx="24" cy="21" r="3" fill="currentColor" opacity="0.5" />
      <path d="M22 26c0 0 1 2 2 2s2-2 2-2" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.4" />
      <line x1="24" y1="8" x2="24" y2="12" stroke="currentColor" strokeWidth="0.8" opacity="0.2" />
      <line x1="24" y1="36" x2="24" y2="40" stroke="currentColor" strokeWidth="0.8" opacity="0.2" />
    </svg>
  );
}

const iconComponents: Record<AgentId, React.FC<IconProps>> = {
  tavi: Tavi,
  fluesterfeder: Fluesterfeder,
  sternenweber: Sternenweber,
  traumwaechter: Traumwaechter,
  funkenwerkstatt: Funkenwerkstatt,
  artefaktschmied: Artefaktschmied,
  pfadfinder: Pfadfinder,
  leuchtglas: Leuchtglas,
};

export function AgentIcon({ agentId, size = 24, ...props }: IconProps & { agentId: AgentId }) {
  const Component = iconComponents[agentId];
  return <Component size={size} {...props} />;
}

export { Tavi, Fluesterfeder, Sternenweber, Traumwaechter, Funkenwerkstatt, Artefaktschmied, Pfadfinder, Leuchtglas };
