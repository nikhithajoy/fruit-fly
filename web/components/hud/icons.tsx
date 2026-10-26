import type { ReactNode } from "react";

function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const PauseIcon = () => <Icon><path d="M9 5v14M15 5v14" /></Icon>;
export const PlayIcon = () => <Icon><path d="M7 5l12 7-12 7z" /></Icon>;
export const FollowIcon = () => <Icon><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></Icon>;
export const ResetIcon = () => <Icon><path d="M4 12a8 8 0 1 0 2.5-5.8" /><path d="M4 4v4h4" /></Icon>;
export const CloseIcon = () => <Icon><path d="M6 6l12 12M18 6L6 18" /></Icon>;
export const ViewsIcon = () => (
  <Icon><path d="M3 7l9-4 9 4-9 4z" /><path d="M3 12l9 4 9-4" /><path d="M3 17l9 4 9-4" /></Icon>
);
export const InfoIcon = () => <Icon size={20}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Icon>;
export const GamepadIcon = () => (
  <Icon><rect x="2" y="7" width="20" height="11" rx="5" /><path d="M7 11v3M5.5 12.5h3M15 12h.01M18 11h.01" /></Icon>
);
