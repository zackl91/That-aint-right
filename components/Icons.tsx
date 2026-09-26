type P = { size?: number; className?: string };
const base = (size = 22) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
});

export const HomeIcon = ({ size }: P) => <svg {...base(size)}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>;
export const CalendarIcon = ({ size }: P) => <svg {...base(size)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
export const RankIcon = ({ size }: P) => <svg {...base(size)}><path d="M5 20V11M12 20V4M19 20v-7M2 20h20" /></svg>;
export const SkullIcon = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 3a8 8 0 0 0-8 8c0 3 1.5 5 3 6v3h10v-3c1.5-1 3-3 3-6a8 8 0 0 0-8-8z" /><circle cx="9" cy="11" r="1.5" /><circle cx="15" cy="11" r="1.5" /><path d="M10 20v-2M14 20v-2" /></svg>
);
export const UserIcon = ({ size }: P) => <svg {...base(size)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>;
export const CloseIcon = ({ size = 18 }: P) => <svg {...base(size)} strokeWidth={2.5}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const ArrowIcon = ({ size = 24 }: P) => <svg {...base(size)} strokeWidth={2.5}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const ChevronLeft = ({ size = 18 }: P) => <svg {...base(size)} strokeWidth={2.5}><path d="M15 6l-6 6 6 6" /></svg>;
export const ChevronRight = ({ size = 18 }: P) => <svg {...base(size)} strokeWidth={2.5}><path d="M9 6l6 6-6 6" /></svg>;
export const CheckIcon = ({ size = 22 }: P) => <svg {...base(size)} strokeWidth={3}><path d="M5 12l5 5 9-10" /></svg>;
export const XIcon = ({ size = 22 }: P) => <svg {...base(size)} strokeWidth={3}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const ZoomIcon = ({ size = 20 }: P) => <svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4M11 8v6M8 11h6" /></svg>;
