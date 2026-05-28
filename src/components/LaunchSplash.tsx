import { useCallback, useEffect, useRef, useState } from 'react';
import CleverFinanceLogo from './CleverFinanceLogo';
import { allwinPalette, cfAccent } from '../theme/allwinPalette';

type Props = {
  onDone: () => void;
};

const DURATION_MS = 1800;

/**
 * Kurzer Vollbild-Launch beim ersten Besuch (localStorage).
 * Passt optisch zur gleichen Oberfläche wie die App (Logo-Charcoal, Akzentblau).
 */
export default function LaunchSplash({ onDone }: Props) {
  const [out, setOut] = useState(false);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    const t = window.setTimeout(() => setOut(true), DURATION_MS - 320);
    const t2 = window.setTimeout(() => finish(), DURATION_MS);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [finish]);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: allwinPalette.appFallback,
        backgroundImage: allwinPalette.app,
        color: '#e6edf3',
        fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
        opacity: out ? 0 : 1,
        transition: 'opacity 0.32s ease-out',
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@700;800;900&display=swap');`}</style>
      <CleverFinanceLogo size={52} style={{ marginBottom: 12 }} />
      <div style={{ fontSize: 15, color: '#7d8590', maxWidth: 280, lineHeight: 1.5 }}>Deine Finanzen. Clever gedacht.</div>
      <div
        style={{
          marginTop: 36,
          width: 120,
          height: 3,
          borderRadius: 99,
          background: '#21262d',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: '40%',
            borderRadius: 99,
            background: `linear-gradient(90deg, ${cfAccent.blue}, ${cfAccent.blueLight})`,
            animation: 'allwinLaunchBar 1.6s ease-in-out infinite',
          }}
        />
      </div>
      <style>{`
        @keyframes allwinLaunchBar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
      <button
        type="button"
        onClick={() => finish()}
        style={{
          marginTop: 32,
          background: 'transparent',
          border: 'none',
          color: '#5b93ff',
          fontSize: 13,
          cursor: 'pointer',
          textDecoration: 'underline',
          textUnderlineOffset: 3,
        }}
      >
        Überspringen
      </button>
    </div>
  );
}
