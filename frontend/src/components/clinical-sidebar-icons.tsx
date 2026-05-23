import type { ReactNode } from "react";

/** Outline icons for clinician / senior clinician sidebar - CP-style, uses currentColor for theme. */

function IconWrapper({ children }: { children: ReactNode }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="clinical-sidebar-svg"
    >
      {children}
    </svg>
  );
}

const icons: Record<string, ReactNode> = {
  Home: (
    <IconWrapper>
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-7H10v7H5a1 1 0 01-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
    </IconWrapper>
  ),
  Appointments: (
    <IconWrapper>
      <rect x={4} y={5} width={16} height={14} rx={2} stroke="currentColor" strokeWidth={1.75} />
      <path d="M8 3v4M16 3v4M4 11h16" stroke="currentColor" strokeWidth={1.75} />
      <path d="M9 15h2M13 15h2" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
    </IconWrapper>
  ),
  Patients: (
    <IconWrapper>
      <circle cx={12} cy={9} r={3.5} stroke="currentColor" strokeWidth={1.75} />
      <path
        d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </IconWrapper>
  ),
  Reports: (
    <IconWrapper>
      <path
        d="M8 4h10a2 2 0 012 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
      <path d="M9 9h6M9 13h4" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
    </IconWrapper>
  ),
  Calendar: (
    <IconWrapper>
      <rect x={3} y={5} width={18} height={16} rx={2} stroke="currentColor" strokeWidth={1.75} />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
      <circle cx={8} cy={15} r={1} fill="currentColor" />
      <circle cx={12} cy={15} r={1} fill="currentColor" />
      <circle cx={16} cy={15} r={1} fill="currentColor" />
    </IconWrapper>
  ),
  Finance: (
    <IconWrapper>
      <rect x={3} y={5} width={18} height={14} rx={2} stroke="currentColor" strokeWidth={1.75} />
      <path d="M3 10h18" stroke="currentColor" strokeWidth={1.75} />
      <path d="M7 15h5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </IconWrapper>
  ),
  "Historical Statements": (
    <IconWrapper>
      <path
        d="M8 3h11a2 2 0 012 2v15H8V3z"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
      <path d="M8 3H6a2 2 0 00-2 2v15h4" stroke="currentColor" strokeWidth={1.75} />
      <path d="M11 8h6M11 12h6M11 16h4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </IconWrapper>
  ),
};

export function ClinicalSidebarIcon({ label }: { label: string }) {
  const node = icons[label];
  if (node) return <>{node}</>;
  return (
    <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.02em" }}>{label.slice(0, 2).toUpperCase()}</span>
  );
}
