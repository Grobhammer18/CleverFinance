import { useEffect, useMemo, useState, type CSSProperties } from 'react';

export type MarketAssetLogoFields = {
  icon: string;
  logoUrl?: string;
  logoUrlFallbacks?: string[];
};

type Props = {
  item: MarketAssetLogoFields;
  size: number;
  /** Default: proportional zu `size` */
  borderRadius?: number;
  style?: CSSProperties;
};

/**
 * CDN-Logo wenn `logoUrl` gesetzt und ladbar — sonst Fallback-Zeichen.
 * Transparenter Hintergrund — Logos sitzen direkt auf der Kartenfläche.
 */
export default function MarketAssetIcon({ item, size, borderRadius, style }: Props) {
  const candidates = useMemo(() => {
    const list: string[] = [];
    if (item.logoUrl?.trim()) list.push(item.logoUrl.trim());
    if (item.logoUrlFallbacks?.length) {
      for (const u of item.logoUrlFallbacks) {
        const t = u?.trim();
        if (t && !list.includes(t)) list.push(t);
      }
    }
    return list;
  }, [item.logoUrl, item.logoUrlFallbacks]);

  const [candidateIdx, setCandidateIdx] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    setCandidateIdx(0);
    setExhausted(false);
  }, [candidates.join('\0')]);

  const br = borderRadius ?? Math.max(8, Math.round(size * 0.28));
  const url = candidates[candidateIdx];
  const showImg = Boolean(url && !exhausted);
  const pad = Math.max(2, Math.round(size * 0.1));

  if (showImg && url) {
    return (
      <img
        key={url}
        src={url}
        alt=""
        aria-hidden
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          if (candidateIdx < candidates.length - 1) {
            setCandidateIdx((i) => i + 1);
          } else {
            setExhausted(true);
          }
        }}
        draggable={false}
        style={{
          width: size,
          height: size,
          borderRadius: br,
          objectFit: 'contain',
          objectPosition: 'center',
          padding: pad,
          boxSizing: 'border-box',
          background: 'transparent',
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: br,
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.52),
        flexShrink: 0,
        ...style,
      }}
      aria-hidden
    >
      {item.icon}
    </div>
  );
}
