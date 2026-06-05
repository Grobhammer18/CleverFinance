import { useState, type CSSProperties } from 'react';
import { allwinPalette } from '../theme/allwinPalette';

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
 * Dunkler Kachel-Hintergrund (weiße Marken-Logos wie Apple bleiben sichtbar).
 */
export default function MarketAssetIcon({ item, size, borderRadius, style }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const br = borderRadius ?? Math.max(8, Math.round(size * 0.28));
  const url = item.logoUrl;
  const showImg = Boolean(url && !imgFailed);
  const pad = Math.max(2, Math.round(size * 0.1));

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
          width: size,
          height: size,
          borderRadius: br,
          objectFit: 'contain',
          objectPosition: 'center',
          padding: pad,
          boxSizing: 'border-box',
          background: allwinPalette.hole,
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
        background: allwinPalette.hole,
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
