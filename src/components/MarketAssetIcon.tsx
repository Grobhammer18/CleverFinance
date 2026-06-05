import { useState, type CSSProperties } from 'react';

export type MarketAssetLogoFields = {
  icon: string;
  logoUrl?: string;
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
 * Heller Kachel-Hintergrund, damit auch helle/weiße Markenlogos sichtbar bleiben.
 */
export default function MarketAssetIcon({ item, size, borderRadius, style }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const br = borderRadius ?? Math.max(10, Math.round(size * 0.26));
  const url = item.logoUrl;
  const showImg = Boolean(url && !imgFailed);
  const pad = Math.max(3, Math.round(size * 0.12));

  const shell: CSSProperties = {
    width: size,
    height: size,
    borderRadius: br,
    flexShrink: 0,
    boxSizing: 'border-box',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.28)',
    background: 'linear-gradient(165deg, #f4f6f8 0%, #e8ecf1 100%)',
    ...style,
  };

  if (showImg && url) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        draggable={false}
        style={{
          ...shell,
          objectFit: 'contain',
          objectPosition: 'center',
          padding: pad,
        }}
      />
    );
  }

  return (
    <div
      style={{
        ...shell,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.46),
        fontWeight: 800,
        color: '#3d444d',
        background: 'linear-gradient(165deg, #2a3038 0%, #1c2128 100%)',
      }}
      aria-hidden
    >
      {item.icon}
    </div>
  );
}
