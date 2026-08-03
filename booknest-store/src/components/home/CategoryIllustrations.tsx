import type { ReactNode } from "react";

/** Premium vector illustrations per category theme (no emoji). */

type IlluProps = { className?: string };

function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="cg1" x1="12" y1="8" x2="84" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C084FC" />
          <stop offset="0.5" stopColor="#A855F7" />
          <stop offset="1" stopColor="#EC4899" />
        </linearGradient>
        <linearGradient id="cg2" x1="20" y1="20" x2="76" y2="76" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E9D5FF" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
        <linearGradient id="cg3" x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F0ABFC" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {children}
    </svg>
  );
}

export function IlluProgramming({ className }: IlluProps) {
  return (
    <Frame className={className}>
      <rect x="14" y="22" width="68" height="44" rx="6" fill="url(#cg1)" opacity="0.9" filter="url(#softGlow)" />
      <rect x="18" y="26" width="60" height="32" rx="3" fill="#160726" opacity="0.85" />
      <path d="M28 36h8M28 42h14M28 48h10" stroke="#C084FC" strokeWidth="2" strokeLinecap="round" />
      <path d="M52 38l6 6-6 6M64 38l-6 6 6 6" stroke="#F0ABFC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="34" y="68" width="28" height="4" rx="2" fill="url(#cg2)" />
      <rect x="28" y="72" width="40" height="6" rx="2" fill="#2D174A" stroke="#A855F7" strokeWidth="1" />
    </Frame>
  );
}

export function IlluAI({ className }: IlluProps) {
  return (
    <Frame className={className}>
      <circle cx="48" cy="44" r="22" fill="url(#cg1)" opacity="0.25" />
      <rect x="32" y="28" width="32" height="28" rx="10" fill="url(#cg3)" filter="url(#softGlow)" />
      <circle cx="40" cy="40" r="3" fill="#160726" />
      <circle cx="56" cy="40" r="3" fill="#160726" />
      <path d="M40 50h16" stroke="#160726" strokeWidth="2" strokeLinecap="round" />
      <circle cx="48" cy="20" r="3" fill="#F0ABFC" />
      <path d="M48 23v5" stroke="#C084FC" strokeWidth="2" />
      <circle cx="22" cy="36" r="2.5" fill="#A855F7" />
      <circle cx="74" cy="36" r="2.5" fill="#EC4899" />
      <circle cx="26" cy="58" r="2" fill="#C084FC" />
      <circle cx="70" cy="58" r="2" fill="#F0ABFC" />
      <path d="M34 36L24 36M62 36h10M36 52L28 58M60 52l8 6" stroke="#A855F7" strokeWidth="1.2" opacity="0.7" />
    </Frame>
  );
}

export function IlluBusiness({ className }: IlluProps) {
  return (
    <Frame className={className}>
      <rect x="28" y="36" width="40" height="32" rx="4" fill="url(#cg1)" filter="url(#softGlow)" />
      <path d="M38 36v-6a10 10 0 0 1 20 0v6" stroke="#E9D5FF" strokeWidth="3" fill="none" />
      <rect x="44" y="48" width="8" height="8" rx="1.5" fill="#160726" opacity="0.5" />
      <path d="M18 70V48l8 6 8-12 8 8 8-14 8 10v24H18z" fill="url(#cg2)" opacity="0.35" />
      <path d="M18 54l8 6 8-12 8 8 8-14 8 10" stroke="#F0ABFC" strokeWidth="2" fill="none" strokeLinecap="round" />
    </Frame>
  );
}

export function IlluFinance({ className }: IlluProps) {
  return (
    <Frame className={className}>
      <circle cx="36" cy="42" r="16" fill="url(#cg1)" filter="url(#softGlow)" />
      <circle cx="36" cy="42" r="11" fill="#2D174A" stroke="#E9D5FF" strokeWidth="1.5" />
      <text x="36" y="47" textAnchor="middle" fill="#F0ABFC" fontSize="14" fontWeight="700" fontFamily="system-ui">
        $
      </text>
      <circle cx="58" cy="50" r="12" fill="url(#cg3)" opacity="0.9" />
      <circle cx="58" cy="50" r="8" fill="#23103A" stroke="#C084FC" strokeWidth="1" />
      <path d="M18 72c8-14 16-10 24-18s14-4 22-12 12-4 16-2" stroke="#A855F7" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M68 42l8-2-2 8" stroke="#EC4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

export function IlluHistory({ className }: IlluProps) {
  return (
    <Frame className={className}>
      <path d="M20 72h56" stroke="#7C3AED" strokeWidth="2" />
      <rect x="28" y="40" width="10" height="32" fill="url(#cg2)" />
      <rect x="43" y="28" width="10" height="44" fill="url(#cg1)" filter="url(#softGlow)" />
      <rect x="58" y="40" width="10" height="32" fill="url(#cg3)" />
      <path d="M24 40h18M39 28h18M54 40h18" stroke="#E9D5FF" strokeWidth="3" strokeLinecap="round" />
      <circle cx="48" cy="18" r="5" fill="#F0ABFC" opacity="0.8" />
    </Frame>
  );
}

export function IlluScience({ className }: IlluProps) {
  return (
    <Frame className={className}>
      <ellipse cx="48" cy="48" rx="28" ry="10" stroke="url(#cg1)" strokeWidth="2" transform="rotate(30 48 48)" />
      <ellipse cx="48" cy="48" rx="28" ry="10" stroke="url(#cg3)" strokeWidth="2" transform="rotate(-30 48 48)" />
      <ellipse cx="48" cy="48" rx="28" ry="10" stroke="#C084FC" strokeWidth="1.5" opacity="0.6" />
      <circle cx="48" cy="48" r="8" fill="url(#cg1)" filter="url(#softGlow)" />
      <circle cx="70" cy="32" r="3" fill="#EC4899" />
      <circle cx="28" cy="60" r="2.5" fill="#A855F7" />
      <circle cx="68" cy="62" r="2" fill="#F0ABFC" />
    </Frame>
  );
}

export function IlluHealth({ className }: IlluProps) {
  return (
    <Frame className={className}>
      <path
        d="M48 78c-18-12-28-24-28-38a16 16 0 0 1 28-10 16 16 0 0 1 28 10c0 14-10 26-28 38z"
        fill="url(#cg1)"
        filter="url(#softGlow)"
        opacity="0.9"
      />
      <path d="M48 36v20M38 46h20" stroke="#160726" strokeWidth="3.5" strokeLinecap="round" opacity="0.55" />
    </Frame>
  );
}

export function IlluCooking({ className }: IlluProps) {
  return (
    <Frame className={className}>
      <ellipse cx="48" cy="68" rx="26" ry="8" fill="#2D174A" stroke="#A855F7" strokeWidth="1" />
      <path d="M24 68c0-18 8-34 24-34s24 16 24 34" fill="url(#cg1)" opacity="0.85" filter="url(#softGlow)" />
      <path d="M36 34c0-8 5-14 12-14s12 6 12 14" stroke="#E9D5FF" strokeWidth="2.5" fill="none" />
      <circle cx="48" cy="22" r="3" fill="#F0ABFC" />
      <path d="M30 52h36" stroke="#160726" strokeWidth="2" opacity="0.25" />
    </Frame>
  );
}

export function IlluCrypto({ className }: IlluProps) {
  return (
    <Frame className={className}>
      <circle cx="48" cy="48" r="26" fill="url(#cg1)" opacity="0.2" />
      <circle cx="48" cy="48" r="20" fill="url(#cg3)" filter="url(#softGlow)" />
      <path
        d="M42 32h10c5 0 9 3 9 8s-3 7-7 8c5 1 8 4 8 9s-4 9-10 9H42V32zm6 14h4c2.2 0 4-1.3 4-3.5S54.2 39 52 39h-4v7zm0 18h5c2.8 0 5-1.6 5-4s-2.2-4-5-4h-5v8z"
        fill="#160726"
        opacity="0.7"
      />
      <path d="M20 30l8 6M76 30l-8 6M20 66l8-6M76 66l-8-6" stroke="#C084FC" strokeWidth="2" strokeLinecap="round" />
    </Frame>
  );
}

export function IlluSelfHelp({ className }: IlluProps) {
  return (
    <Frame className={className}>
      <path d="M48 72V40" stroke="url(#cg1)" strokeWidth="4" strokeLinecap="round" />
      <path d="M48 42c-10 0-16 8-16 16 8 0 16-4 16-16z" fill="url(#cg3)" opacity="0.8" />
      <path d="M48 42c10 0 16 8 16 16-8 0-16-4-16-16z" fill="url(#cg2)" opacity="0.8" />
      <circle cx="48" cy="30" r="8" fill="url(#cg1)" filter="url(#softGlow)" />
      <path d="M34 78c4-10 10-14 14-14s10 4 14 14" stroke="#C084FC" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="30" cy="24" r="2" fill="#EC4899" />
      <circle cx="66" cy="22" r="2.5" fill="#F0ABFC" />
    </Frame>
  );
}

export function IlluNovel({ className }: IlluProps) {
  return (
    <Frame className={className}>
      <path d="M22 24h24c6 0 10 4 10 10v42c-6-4-14-6-22-6H22V24z" fill="url(#cg1)" filter="url(#softGlow)" />
      <path d="M74 24H50c-6 0-10 4-10 10v42c6-4 14-6 22-6h12V24z" fill="url(#cg3)" />
      <path d="M48 34v42" stroke="#E9D5FF" strokeWidth="1.5" opacity="0.5" />
    </Frame>
  );
}

export function IlluChildren({ className }: IlluProps) {
  return (
    <Frame className={className}>
      <circle cx="36" cy="36" r="12" fill="url(#cg2)" filter="url(#softGlow)" />
      <circle cx="60" cy="40" r="10" fill="url(#cg3)" />
      <path d="M20 72c4-16 12-24 16-24s10 6 12 14c2-8 8-14 14-14s12 10 14 24" fill="url(#cg1)" opacity="0.85" />
      <circle cx="32" cy="34" r="1.5" fill="#160726" />
      <circle cx="40" cy="34" r="1.5" fill="#160726" />
      <path d="M32 40c2 2 6 2 8 0" stroke="#160726" strokeWidth="1.5" strokeLinecap="round" />
    </Frame>
  );
}

export function IlluTech({ className }: IlluProps) {
  return (
    <Frame className={className}>
      <rect x="22" y="28" width="52" height="36" rx="4" fill="url(#cg1)" filter="url(#softGlow)" />
      <rect x="26" y="32" width="44" height="24" rx="2" fill="#160726" opacity="0.8" />
      <circle cx="48" cy="44" r="6" stroke="#C084FC" strokeWidth="2" />
      <path d="M48 38v-2M48 52v-2M42 44h-2M56 44h-2" stroke="#F0ABFC" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="36" y="68" width="24" height="4" rx="1" fill="#7C3AED" />
    </Frame>
  );
}

export function IlluDefault({ className }: IlluProps) {
  return (
    <Frame className={className}>
      <rect x="30" y="22" width="36" height="50" rx="4" fill="url(#cg1)" filter="url(#softGlow)" />
      <rect x="36" y="30" width="24" height="3" rx="1.5" fill="#E9D5FF" opacity="0.7" />
      <rect x="36" y="38" width="18" height="2.5" rx="1" fill="#E9D5FF" opacity="0.45" />
      <rect x="36" y="44" width="20" height="2.5" rx="1" fill="#E9D5FF" opacity="0.35" />
    </Frame>
  );
}

const MAP: Record<string, (p: IlluProps) => ReactNode> = {
  "lap-trinh": (p) => <IlluProgramming {...p} />,
  ai: (p) => <IlluAI {...p} />,
  "kinh-doanh": (p) => <IlluBusiness {...p} />,
  "tai-chinh": (p) => <IlluFinance {...p} />,
  "lich-su": (p) => <IlluHistory {...p} />,
  "khoa-hoc": (p) => <IlluScience {...p} />,
  "suc-khoe": (p) => <IlluHealth {...p} />,
  "nau-an": (p) => <IlluCooking {...p} />,
  crypto: (p) => <IlluCrypto {...p} />,
  "self-help": (p) => <IlluSelfHelp {...p} />,
  "tieu-thuyet": (p) => <IlluNovel {...p} />,
  "thieu-nhi": (p) => <IlluChildren {...p} />,
  "cong-nghe": (p) => <IlluTech {...p} />,
  startup: (p) => <IlluBusiness {...p} />,
  "tam-ly": (p) => <IlluSelfHelp {...p} />,
  "giao-duc": (p) => <IlluDefault {...p} />,
  english: (p) => <IlluDefault {...p} />,
  comics: (p) => <IlluNovel {...p} />,
  "nuoi-day-con": (p) => <IlluChildren {...p} />,
};

export function CategoryIllustration({ slug, className }: { slug: string; className?: string }) {
  const render = MAP[slug] || ((p: IlluProps) => <IlluDefault {...p} />);
  return <>{render({ className: className || "h-16 w-16" })}</>;
}
