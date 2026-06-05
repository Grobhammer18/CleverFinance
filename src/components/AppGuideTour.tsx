import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { AppTourStep } from '../onboarding/appGuideContent';

type Props = {
  open: boolean;
  steps: AppTourStep[];
  onClose: () => void;
  onTabChange: (tab: string) => void;
};

type BubblePos = { left: number; top: number; placement: 'top' | 'bottom' | 'center' };
type RectSnap = { top: number; left: number; width: number; height: number; bottom: number };

const TAB_BAR_RESERVE = 84;
const VIEW_MARGIN = 12;
const TARGET_GAP = 12;
const BUBBLE_ESTIMATE_H = 280;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function viewportBox() {
  const vv = window.visualViewport;
  return {
    top: vv?.offsetTop ?? 0,
    left: vv?.offsetLeft ?? 0,
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
  };
}

function snapRect(r: DOMRect): RectSnap {
  return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom };
}

function rectsNearEqual(a: RectSnap | null, b: RectSnap | null) {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.top - b.top) < 1 &&
    Math.abs(a.left - b.left) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  );
}

function bubblePosEqual(a: BubblePos, b: BubblePos) {
  return a.placement === b.placement && Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1;
}

function computeBubblePosition(rect: RectSnap, bubbleH: number, bubbleW: number): BubblePos {
  const vp = viewportBox();
  const maxW = Math.min(340, vp.width - VIEW_MARGIN * 2);
  const w = Math.min(bubbleW, maxW);
  const h = bubbleH || BUBBLE_ESTIMATE_H;

  const minTop = vp.top + VIEW_MARGIN;
  const maxBottom = vp.top + vp.height - TAB_BAR_RESERVE - VIEW_MARGIN;
  const cx = clamp(rect.left + rect.width / 2, vp.left + VIEW_MARGIN + w / 2, vp.left + vp.width - VIEW_MARGIN - w / 2);

  const spaceBelow = maxBottom - (rect.bottom + TARGET_GAP);
  const spaceAbove = rect.top - TARGET_GAP - minTop;

  const fitsBelow = spaceBelow >= h;
  const fitsAbove = spaceAbove >= h;

  if (fitsBelow || (!fitsAbove && spaceBelow >= spaceAbove)) {
    const top = clamp(rect.bottom + TARGET_GAP, minTop, maxBottom - h);
    return { left: cx, top, placement: 'bottom' };
  }

  if (fitsAbove || spaceAbove > spaceBelow) {
    const anchorBottom = clamp(rect.top - TARGET_GAP, minTop + h, maxBottom);
    return { left: cx, top: anchorBottom, placement: 'top' };
  }

  return {
    left: vp.left + vp.width / 2,
    top: vp.top + vp.height / 2,
    placement: 'center',
  };
}

export default function AppGuideTour({ open, steps, onClose, onTabChange }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<RectSnap | null>(null);
  const [bubblePos, setBubblePos] = useState<BubblePos>({
    left: 0,
    top: 0,
    placement: 'center',
  });
  const bubbleRef = useRef<HTMLDivElement>(null);
  const pauseReflowRef = useRef(false);
  const layoutGenRef = useRef(0);

  const step = steps[index];
  const isLast = index >= steps.length - 1;

  const layoutStep = useCallback(() => {
    if (!step) return;

    if (!step.target) {
      const vp = viewportBox();
      setRect(null);
      const centerPos = {
        left: vp.left + vp.width / 2,
        top: vp.top + vp.height / 2,
        placement: 'center' as const,
      };
      setBubblePos((prev) => (bubblePosEqual(prev, centerPos) ? prev : centerPos));
      return;
    }

    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) {
      const vp = viewportBox();
      setRect(null);
      const centerPos = {
        left: vp.left + vp.width / 2,
        top: vp.top + vp.height / 2,
        placement: 'center' as const,
      };
      setBubblePos((prev) => (bubblePosEqual(prev, centerPos) ? prev : centerPos));
      return;
    }

    pauseReflowRef.current = true;
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
    pauseReflowRef.current = false;

    const targetRect = snapRect(el.getBoundingClientRect());
    setRect((prev) => (rectsNearEqual(prev, targetRect) ? prev : targetRect));

    const bubbleH = bubbleRef.current?.offsetHeight ?? BUBBLE_ESTIMATE_H;
    const bubbleW = bubbleRef.current?.offsetWidth ?? Math.min(340, window.innerWidth - 24);
    const nextPos = computeBubblePosition(targetRect, bubbleH, bubbleW);
    setBubblePos((prev) => (bubblePosEqual(prev, nextPos) ? prev : nextPos));
  }, [step]);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open || steps.length === 0) return;
    setIndex((i) => Math.min(i, steps.length - 1));
  }, [open, steps.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open || !step) return;

    const gen = ++layoutGenRef.current;
    if (step.tab) onTabChange(step.tab);

    const run = () => {
      if (layoutGenRef.current !== gen) return;
      layoutStep();
    };

    run();
    const raf = requestAnimationFrame(() => requestAnimationFrame(run));
    const t1 = window.setTimeout(run, 120);
    const t2 = window.setTimeout(run, 360);

    const onReflow = () => {
      if (pauseReflowRef.current) return;
      run();
    };
    window.addEventListener('resize', onReflow);
    window.visualViewport?.addEventListener('resize', onReflow);
    window.visualViewport?.addEventListener('scroll', onReflow);

    return () => {
      layoutGenRef.current += 1;
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', onReflow);
      window.visualViewport?.removeEventListener('resize', onReflow);
      window.visualViewport?.removeEventListener('scroll', onReflow);
    };
  }, [open, index, step, layoutStep, onTabChange]);

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
            transition: 'left 0.15s ease, top 0.15s ease, width 0.15s ease, height 0.15s ease',
          }}
        />
      );
    })();

  const bubbleStyle: CSSProperties =
    bubblePos.placement === 'center'
      ? {
          position: 'fixed',
          left: bubblePos.left,
          top: bubblePos.top,
          transform: 'translate(-50%, -50%)',
          width: 'min(360px, calc(100vw - 32px))',
          maxHeight: `calc(100dvh - ${TAB_BAR_RESERVE + VIEW_MARGIN * 2}px)`,
          zIndex: 100003,
        }
      : {
          position: 'fixed',
          left: bubblePos.left,
          top: bubblePos.top,
          transform: bubblePos.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
          width: 'min(340px, calc(100vw - 24px))',
          maxHeight: `calc(100dvh - ${TAB_BAR_RESERVE + VIEW_MARGIN * 2}px)`,
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
      <div ref={bubbleRef} style={bubbleStyle}>
        <div
          style={{
            position: 'relative',
            background: 'linear-gradient(165deg, #161b22 0%, #0d1117 100%)',
            border: '1px solid #58a6ff',
            borderRadius: 16,
            padding: '18px 16px 14px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(88,166,255,0.2)',
            maxHeight: 'inherit',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
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
                  ? {
                      top: -10,
                      transform: 'translateX(-50%)',
                      borderLeft: '10px solid transparent',
                      borderRight: '10px solid transparent',
                      borderBottom: '10px solid #58a6ff',
                    }
                  : {
                      bottom: -10,
                      transform: 'translateX(-50%)',
                      borderLeft: '10px solid transparent',
                      borderRight: '10px solid transparent',
                      borderTop: '10px solid #58a6ff',
                    }),
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
              {isLast ? "Los geht's 🚀" : 'Weiter'}
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
