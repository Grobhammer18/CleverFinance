import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { AppTourStep } from '../onboarding/appGuideContent';

type Props = {
  open: boolean;
  steps: AppTourStep[];
  onClose: () => void;
  onTabChange: (tab: string) => void;
};

type BubblePos = { left: number; top: number; placement: 'top' | 'bottom' | 'center' };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function AppGuideTour({ open, steps, onClose, onTabChange }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = steps[index];
  const isCenter = !step?.target;
  const isLast = index >= steps.length - 1;

  const measure = useCallback(() => {
    if (!step?.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    setRect(el.getBoundingClientRect());
  }, [step?.target]);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !step) return;
    if (step.tab) onTabChange(step.tab);
    const t1 = window.setTimeout(measure, 80);
    const t2 = window.setTimeout(measure, 280);
    const onReflow = () => measure();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, index, step, measure, onTabChange]);

  const bubblePos = useMemo((): BubblePos => {
    if (isCenter || !rect) {
      return {
        left: window.innerWidth / 2,
        top: window.innerHeight / 2,
        placement: 'center',
      };
    }
    const pad = 14;
    const maxW = Math.min(340, window.innerWidth - 24);
    const cx = rect.left + rect.width / 2;
    const below = rect.bottom + pad;
    const above = rect.top - pad;
    if (below + 200 < window.innerHeight) {
      return {
        left: clamp(cx, 12 + maxW / 2, window.innerWidth - 12 - maxW / 2),
        top: below,
        placement: 'bottom',
      };
    }
    return {
      left: clamp(cx, 12 + maxW / 2, window.innerWidth - 12 - maxW / 2),
      top: above,
      placement: 'top',
    };
  }, [isCenter, rect]);

  if (!open || !step || steps.length === 0) return null;

  const pad = 10;
  const spotlight =
    rect &&
    (() => {
      const l = rect.left - pad;
      const t = rect.top - pad;
      const w = rect.width + pad * 2;
      const h = rect.height + pad * 2;
      return (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            left: l,
            top: t,
            width: w,
            height: h,
            borderRadius: 14,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.82)',
            border: '2px solid #58a6ff',
            pointerEvents: 'none',
            zIndex: 100001,
            transition: 'left 0.25s ease, top 0.25s ease, width 0.25s ease, height 0.25s ease',
          }}
        />
      );
    })();

  const bubbleStyle: CSSProperties =
    bubblePos.placement === 'center'
      ? {
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(360px, calc(100vw - 32px))',
          zIndex: 100003,
        }
      : {
          position: 'fixed',
          left: bubblePos.left,
          top: bubblePos.top,
          transform: bubblePos.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
          width: 'min(340px, calc(100vw - 24px))',
          zIndex: 100003,
        };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-tour-title"
      style={{ position: 'fixed', inset: 0, zIndex: 100000, pointerEvents: 'auto' }}
    >
      {!rect && (
        <div
          aria-hidden
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 100000 }}
        />
      )}
      {spotlight}
      <div style={bubbleStyle}>
        <div
          style={{
            position: 'relative',
            background: 'linear-gradient(165deg, #161b22 0%, #0d1117 100%)',
            border: '1px solid #58a6ff',
            borderRadius: 16,
            padding: '18px 16px 14px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(88,166,255,0.2)',
          }}
        >
          {bubblePos.placement !== 'center' && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: '50%',
                width: 0,
                height: 0,
                ...(bubblePos.placement === 'bottom'
                  ? { top: -10, transform: 'translateX(-50%)', borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderBottom: '10px solid #58a6ff' }
                  : { bottom: -10, transform: 'translateX(-50%)', borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '10px solid #58a6ff' }),
              }}
            />
          )}
          <div style={{ fontSize: 11, color: '#58a6ff', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>
            Schritt {index + 1} von {steps.length}
          </div>
          <div id="app-tour-title" style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.3, marginBottom: 8 }}>
            {step.title}
          </div>
          <p style={{ fontSize: 14, color: '#c9d1d9', lineHeight: 1.55, margin: 0 }}>{step.message}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' as const }}>
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                style={{
                  flex: 1,
                  minWidth: 90,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #30363d',
                  background: '#21262d',
                  color: '#e6edf3',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Zurück
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (isLast) onClose();
                else setIndex((i) => i + 1);
              }}
              style={{
                flex: 1,
                minWidth: 90,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid #3fb950',
                background: '#238636',
                color: '#fff',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {isLast ? 'Los geht\'s 🚀' : 'Weiter'}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              marginTop: 10,
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: '#7d8590',
              fontSize: 12,
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            Tour überspringen
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
