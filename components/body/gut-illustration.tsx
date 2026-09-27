export function GutIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="mx-auto h-auto w-full max-w-[360px]">
      <defs>
        <linearGradient id="gutGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--sys-gut)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--sys-gut)" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {/* stomach */}
      <path
        d="M96,40 C80,42 68,58 72,76 C75,92 92,98 108,94 C118,110 138,112 150,100 C166,84 158,54 138,44 C124,36 108,36 96,40 Z"
        fill="url(#gutGrad)"
        opacity={0.9}
      />
      {/* small intestine coils */}
      <path
        d="M108,110 C70,120 70,150 108,158 C146,166 146,190 108,196 C78,201 74,182 92,176"
        fill="none"
        stroke="var(--sys-gut)"
        strokeWidth="14"
        strokeLinecap="round"
        opacity={0.55}
      />
      <path
        d="M150,105 C190,118 200,145 168,158 C140,169 140,190 172,198 C196,204 206,190 200,178"
        fill="none"
        stroke="var(--sys-gut)"
        strokeWidth="14"
        strokeLinecap="round"
        opacity={0.45}
      />
      {/* large intestine frame */}
      <path
        d="M50,90 C40,120 40,180 60,205 C90,228 220,228 250,205 C270,182 270,120 258,90"
        fill="none"
        stroke="var(--sys-gut)"
        strokeWidth="16"
        strokeLinecap="round"
        opacity={0.28}
      />
      <circle cx={112} cy={64} r={4} fill="var(--surface)" opacity={0.8} />
      <circle cx={130} cy={150} r={4} fill="var(--surface)" opacity={0.6} />
      <circle cx={180} cy={165} r={4} fill="var(--surface)" opacity={0.6} />
    </svg>
  );
}
