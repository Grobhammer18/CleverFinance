import { useState, type CSSProperties } from 'react';
import cleverFinanceLogoUrl from '../assets/clever-finance-logo.png';
import { ASSET_CACHE_BUST } from '../config/assetCacheBust';

function buildLogoSrc(): string {
  const sep = cleverFinanceLogoUrl.includes('?') ? '&' : '?';
  let url = `${cleverFinanceLogoUrl}${sep}v=${ASSET_CACHE_BUST}`;
  if (import.meta.env.DEV) url += `&t=${Date.now()}`;
  return url;
}

type Props = { size?: number; style?: CSSProperties };

/** Clever Finance Wortmarke (Logo-Grafik). */
export default function CleverFinanceLogo({ size = 54, style }: Props) {
  const [src] = useState(buildLogoSrc);

  return (
    <img
      src={src}
      alt="Clever Finance"
      style={{
        height: size,
        width: 'auto',
        maxWidth: 'min(320px, 90vw)',
        display: 'block',
        borderRadius: Math.min(22, Math.round(size * 0.2)),
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(56, 139, 253, 0.12)',
        objectFit: 'contain',
        ...style,
      }}
    />
  );
}
