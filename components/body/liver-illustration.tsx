const legend = [
  { key: "alt", label: "ALT", location: "Cytosol", desc: "Found mainly free-floating in the cell's cytoplasm.", y: 60 },
  { key: "ast", label: "AST", location: "Cytosol + mitochondria", desc: "Found in both the cytoplasm and mitochondria.", y: 120 },
  { key: "ggt", label: "GGT", location: "Cell membrane / bile duct", desc: "Associated with the hepatobiliary (bile-duct) system.", y: 180 },
];

/**
 * A simplified, labeled hepatocyte (liver cell) diagram — illustrative only,
 * not to biological scale. Shows *where* ALT/AST/GGT are conceptually
 * associated within the cell, to explain why a lab panel reports them
 * together, without implying anything about severity or diagnosis.
 */
export function LiverIllustration() {
  return (
    <svg viewBox="0 0 420 240" className="mx-auto h-auto w-full max-w-[480px]">
      {/* cell membrane */}
      <ellipse cx="150" cy="120" rx="120" ry="95" fill="var(--system-liver-soft)" stroke="var(--system-liver)" strokeWidth="2" />
      {/* nucleus */}
      <circle cx="120" cy="130" r="34" fill="var(--surface-elevated)" stroke="var(--border)" strokeWidth="1.5" />
      <circle cx="120" cy="130" r="10" fill="var(--border)" opacity="0.6" />
      {/* mitochondria */}
      <ellipse cx="195" cy="85" rx="20" ry="11" fill="var(--surface-elevated)" stroke="var(--system-liver)" strokeWidth="1.5" />
      <ellipse cx="205" cy="160" rx="18" ry="10" fill="var(--surface-elevated)" stroke="var(--system-liver)" strokeWidth="1.5" />
      {/* bile canaliculus edge (right side of membrane) */}
      <path d="M 265 70 Q 280 120 265 170" fill="none" stroke="var(--system-liver)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />

      {/* markers + leader lines */}
      {/* ALT — cytosol, free point away from nucleus/mitochondria */}
      <circle cx="150" cy="185" r="4" fill="var(--state-good)" />
      <path d="M 150 185 L 300 60" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />

      {/* AST — mitochondria */}
      <circle cx="195" cy="85" r="4" fill="var(--state-watch)" />
      <path d="M 195 85 L 300 120" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />

      {/* GGT — membrane/bile duct */}
      <circle cx="266" cy="120" r="4" fill="var(--state-elevated)" />
      <path d="M 266 120 L 300 180" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />

      {/* legend */}
      {legend.map((item, i) => (
        <g key={item.key} transform={`translate(300, ${legend[i].y - 40})`}>
          <circle cx="0" cy="0" r="4" fill={i === 0 ? "var(--state-good)" : i === 1 ? "var(--state-watch)" : "var(--state-elevated)"} />
          <text x="12" y="4" fontSize="13" fontWeight="700" fill="var(--text-primary)">
            {item.label}
          </text>
          <text x="12" y="20" fontSize="10" fill="var(--text-secondary)">
            {item.location}
          </text>
        </g>
      ))}
    </svg>
  );
}

export const liverLegendCopy = legend;
