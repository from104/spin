// 스포트라이트 튜토리얼 오버레이 — docs/PLAN-HELP-TUTORIAL.md §C.
//
// ── 구멍을 4분할로 그리는 이유 ────────────────────────────────────────────────────────
// SVG `<mask>` 로 뚫은 alpha:0 영역은 브라우저마다 포인터 이벤트 통과 여부가 다르다 — 믿을
// 수 없다. 대신 어두운 덮개를 구멍을 **감싸는 네 조각**(위·아래·좌·우)으로 나눠 그린다.
// 구멍 자리에는 물리적으로 요소가 아예 없으므로 그 아래 진짜 화면 요소가 항상 클릭된다
// (계획서: "v1 은 보기만" — 클릭은 되지만 그걸로 다음 단계로 넘어가지는 않는다).
//
// ── 포커스·키보드(§7 완전 대응, 10문답) ──────────────────────────────────────────────
// role="dialog" + Tab 트랩(ui/Modal.tsx 와 같은 관용구, 대상은 카드 안 버튼 3개뿐이라 더
// 단순하다) + Esc = skip + ←/→ 이전/다음 + Enter = 다음. 단계가 바뀔 때마다 liveRegion 이
// "n/N 제목 — 설명" 을 낭독한다 — 스포트라이트는 본래 시각 장치라 청각 경로를 따로 만들지
// 않으면 스크린리더 사용자에게는 아무 일도 안 일어난 것과 같다.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useT } from '../../i18n/useT.ts';
import { liveRegion } from '../LiveRegion.tsx';
import type { TutorialStep } from './types.ts';

export interface TutorialOverlayProps {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  onNext(): void;
  onPrev(): void;
  onSkip(): void;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 구멍이 대상 요소보다 살짝 넓다 — 테두리에 딱 붙으면 강조 링이 요소를 가린다. */
const PAD = 6;
const CARD_WIDTH = 300;
const CARD_GAP = 12;
const CARD_MARGIN = 12;
const BACKDROP: CSSProperties = { position: 'fixed', background: 'rgba(0,0,0,.72)' };

function measure(target: string): Rect | null {
  const el = document.querySelector(`[data-tut="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x - PAD, y: r.y - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

export function TutorialOverlay({ step, stepIndex, totalSteps, onNext, onPrev, onSkip }: TutorialOverlayProps) {
  const t = useT();
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardHeight, setCardHeight] = useState(0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => {
    const remeasure = () => setRect(measure(step.target));
    remeasure();
    window.addEventListener('resize', remeasure);
    return () => window.removeEventListener('resize', remeasure);
  }, [step.target]);

  // 카드 높이는 문구 길이(번역·단계마다 다름)에 좌우돼 고정값을 못 쓴다 — 매 커밋 뒤
  // 실측해서 배치를 다시 계산한다. 값이 바뀔 때만 setState 하므로 안정화되면 더 안 돈다.
  useLayoutEffect(() => {
    const h = cardRef.current?.offsetHeight ?? 0;
    if (h > 0 && h !== cardHeight) setCardHeight(h);
  });

  useEffect(() => {
    liveRegion.say(`${stepIndex + 1}/${totalSteps} ${t(step.titleKey)} — ${t(step.bodyKey)}`);
    nextBtnRef.current?.focus({ preventScroll: true });
  }, [step, stepIndex, totalSteps, t]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Modal.tsx 와 같은 IME 가드 — 카드 자체엔 텍스트 입력이 없지만 배경 어딘가 조합 중일 수 있다.
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onSkip();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        onNext();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrev();
        return;
      }
      if (e.key !== 'Tab' || !cardRef.current) return;
      const focusables = Array.from(cardRef.current.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onNext, onPrev, onSkip]);

  // 대상이 그 순간 화면에 없으면(스크롤·전환 중) 아무것도 안 그린다 — 다음 재측정을 기다린다.
  if (!rect) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const holeRight = rect.x + rect.width;
  const holeBottom = rect.y + rect.height;

  // 첫 페인트 전(아직 실측 못한 때)은 넉넉한 추정치로 자리를 잡는다 — 실측되면 위
  // useLayoutEffect 가 cardHeight state 를 갱신해 다음 커밋에서 정확한 자리로 보정된다.
  const effectiveCardHeight = cardHeight || 220;
  const belowSpace = vh - holeBottom - CARD_GAP - CARD_MARGIN;
  const aboveSpace = rect.y - CARD_GAP - CARD_MARGIN;

  // 구멍(스포트라이트)이 카드보다 커서 위·아래 어느 쪽에도 안 들어가면, 구멍과 겹치는 것을
  // 허용하고 화면 안에 완전히 들어오는 쪽(공간이 더 넓은 쪽)에 붙인다 — "화면 밖으로 나감"
  // 신고(2026-08-20 실기)의 원인이 정확히 이 분기 없음이었다: 항상 안 겹치는 자리를 찾으려다
  // 구멍이 크면 음수 좌표까지 밀려났다.
  let top: number;
  if (belowSpace >= effectiveCardHeight) {
    top = holeBottom + CARD_GAP;
  } else if (aboveSpace >= effectiveCardHeight) {
    top = rect.y - CARD_GAP - effectiveCardHeight;
  } else {
    top = belowSpace >= aboveSpace ? holeBottom + CARD_GAP : rect.y - CARD_GAP - effectiveCardHeight;
  }
  // 최종 안전망 — 위 분기가 무엇을 골랐든 뷰포트 밖으로는 절대 못 나간다.
  top = Math.min(Math.max(top, CARD_MARGIN), Math.max(CARD_MARGIN, vh - CARD_MARGIN - effectiveCardHeight));

  const cardWidth = Math.min(CARD_WIDTH, vw - CARD_MARGIN * 2);
  const cardLeft = Math.min(Math.max(rect.x, CARD_MARGIN), Math.max(CARD_MARGIN, vw - cardWidth - CARD_MARGIN));

  const cardStyle: CSSProperties = {
    position: 'fixed',
    left: cardLeft,
    top,
    width: cardWidth,
    maxHeight: vh - CARD_MARGIN * 2,
    overflowY: 'auto',
    zIndex: 301,
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid var(--border-strong)',
    background: 'var(--panel)',
    color: 'var(--text)',
    boxShadow: '0 12px 30px rgba(0,0,0,.5)',
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={t('tutorial.dialogAriaLabel')} style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
      {/* 어두운 덮개 4조각. onPointerDown 은 카드 배경 클릭과 같은 뜻(Modal.tsx 관례) — skip. */}
      <div onPointerDown={onSkip} style={{ ...BACKDROP, left: 0, top: 0, width: vw, height: Math.max(0, rect.y) }} />
      <div onPointerDown={onSkip} style={{ ...BACKDROP, left: 0, top: holeBottom, width: vw, height: Math.max(0, vh - holeBottom) }} />
      <div onPointerDown={onSkip} style={{ ...BACKDROP, left: 0, top: rect.y, width: Math.max(0, rect.x), height: rect.height }} />
      <div onPointerDown={onSkip} style={{ ...BACKDROP, left: holeRight, top: rect.y, width: Math.max(0, vw - holeRight), height: rect.height }} />
      {/* 구멍 강조 링 — 시각 전용, 클릭을 안 먹는다. */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          borderRadius: 10,
          boxShadow: '0 0 0 3px var(--accent)',
          pointerEvents: 'none',
        }}
      />

      <div ref={cardRef} style={cardStyle}>
        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--faint-text)', marginBottom: 6 }}>
          {t('tutorial.stepCounter', { i: stepIndex + 1, total: totalSteps })}
        </div>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 6 }}>{t(step.titleKey)}</h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', lineHeight: 1.55, marginBottom: 14 }}>{t(step.bodyKey)}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={onSkip} style={buttonStyle('ghost')}>
            {t('tutorial.skip')}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onPrev} disabled={stepIndex === 0} style={{ ...buttonStyle('secondary'), opacity: stepIndex === 0 ? 0.4 : 1 }}>
              {t('tutorial.prev')}
            </button>
            <button ref={nextBtnRef} type="button" onClick={onNext} style={buttonStyle('primary')}>
              {stepIndex + 1 >= totalSteps ? t('tutorial.done') : t('tutorial.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function buttonStyle(variant: 'primary' | 'secondary' | 'ghost'): CSSProperties {
  return {
    minHeight: 36,
    padding: '0 12px',
    borderRadius: '0.5rem',
    fontSize: '0.8125rem',
    fontWeight: 600,
    border: variant === 'secondary' ? '1px solid var(--border)' : '1px solid transparent',
    background: variant === 'primary' ? 'var(--accent)' : 'transparent',
    color: variant === 'primary' ? 'var(--accent-ink-strong)' : variant === 'ghost' ? 'var(--faint-text)' : 'var(--text)',
    opacity: 1,
  };
}
