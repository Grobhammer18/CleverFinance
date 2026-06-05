import { useCallback, useEffect, useRef, useState } from 'react';
import CleverFinanceLogo from './CleverFinanceLogo';
import { allwinPalette } from '../theme/allwinPalette';

type Props = {
  onDone: () => void;
};

const DURATION_MS = 1200;

/**
 * Kurzer Vollbild-Launch beim ersten Besuch (localStorage).
 * Ruhig ohne Lade-Animation — nur kurzes Einblenden.
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
    const t = window.setTimeout(() => setOut(true), DURATION_MS - 200);
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
        transition: 'opacity 0.2s ease-out',
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@700;800;900&display=swap');`}</style>
      <CleverFinanceLogo size={52} style={{ marginBottom: 12 }} />
      <div style={{ fontSize: 15, color: '#7d8590', maxWidth: 280, lineHeight: 1.5 }}>Deine Finanzen. Clever gedacht.</div>
      <button
        type="button"
        onClick={() => finish()}
        style={{
          marginTop: 40,
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
