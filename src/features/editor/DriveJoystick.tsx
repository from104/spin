// 휠체어 조정 모드의 **화면 가상 조이스틱** — docs/PLAN-SIMPLE-DRIVE.md 결정 B5. 큰 원(받침) 안의 작은 원(손잡이)을 끌면 그만큼
// 몬다(모바일 게임식). 터치 전용이 아니다 — 마우스로도 끈다. 값은 입력원(src/drive/input/joystick.ts)에 넣기만 하고 운동학·물리는
// 모른다(B9 ②). 키보드와 더해지는 것은 useDriveSession 이 한다.
//
// ── 계약 ────────────────────────────────────────────────────────────────────────────────────────────
// · **body 포털 + fixed** — UI 배율 래퍼(.spin-scale, transform: scale) 안의 fixed 는 어긋난다(72a6a12 교훈). 자리는 판 컨테이너에
//   심은 투명 탐침의 화면 상자(배율이 이미 반영된 값)에서 오른쪽 아래 — 기능 바·재생 묶음·트레이는 판 밖이라 안 덮는다. safe-area 도 지킨다.
// · 손가락 **하나만** 받는다(setPointerCapture). 쥔 동안 다른 누름은 무시한다. 판은 이 손짓을 아예 못 본다(포털이라 판의 DOM 밖) —
//   그래서 drivePress 의 '판을 누르면 먹기' 도, 키 층의 '아무 키 = 나가기' 도 타지 않는다. React 합성 이벤트는 포털을 거슬러
//   조상으로 번지므로 stopPropagation 으로 끊는다.
// · 놓기·취소·캡처 잃음에서 손잡이는 가운데로 돌아가고 입력은 0. 창 blur·화면 숨김·모드 끝·갈아타기는 세션이 입력원을 reset 하고,
//   그 통지(onReset)로 여기 손짓도 끝낸다 — 입력은 0 인데 손잡이가 기운 채 남지 않게. 다음 누름까지 움직임은 무시한다.
// · 손잡이 자리는 React 상태가 아니라 style 로 바로 옮긴다(포인터 이동마다 편집기 전체가 다시 그려지지 않게).
// · 속도 [−]·[+] — 터치에는 1–5 키가 없다. 상단 띠에 속도 단추가 없어서 여기 둔다.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { DRIVE } from '../../core/constants.ts';
import { snapKnob, stickToInput, type JoystickDriveSource } from '../../drive/input/joystick.ts';
import { ZERO_INPUT } from '../../drive/model.ts';
import { useT } from '../../i18n/useT.ts';

/** 받침 지름(CSS px) — 계획서 B5. 큰 터치 타깃이면 180. */
const SIZE = { normal: 140, large: 180 } as const;
/** 손잡이 지름 ÷ 받침 지름. */
const KNOB_RATIO = 0.36;
/** 손잡이가 받침 테두리 밖으로 나오는 정도(손잡이 지름의 몫). 이동 반경 = 받침 반경 − 손잡이 지름 × (½ − 이 값) — 손잡이를 받침 안에
 *  가두면 이동이 짧아(140 px 에서 ≈ 40 px) 기운 만큼의 빠르기를 손가락으로 고르기 어렵다(2026-11-18 기현님: *"움직인 정도에 따라
 *  최고 속도가 달라야"*). 모바일 게임 조이스틱처럼 손잡이 일부가 테두리 밖으로 나간다. */
const KNOB_OVERHANG = 0.25;
/** 판 가장자리에서 띄우는 거리(px). */
const GAP = 12;

/** 판 컨테이너의 오른쪽·아래 변이 화면 오른쪽·아래에서 떨어진 거리와 화면 크기(px). */
interface Anchor {
  right: number;
  bottom: number;
  vw: number;
  vh: number;
}

export function DriveJoystick({
  source,
  level,
  onLevel,
  large,
  onHeldChange,
}: {
  source: JoystickDriveSource;
  level: number;
  onLevel(level: number): void;
  large: boolean;
  /** 손가락이 손잡이를 쥐고 있는가 — 판의 길게 누르기 메뉴를 그동안 막는 데 쓴다(EditorStage). */
  onHeldChange?(held: boolean): void;
}) {
  const t = useT();
  const probeRef = useRef<HTMLDivElement | null>(null);
  const baseRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<number | null>(null);
  const centerRef = useRef({ x: 0, y: 0 });
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const heldRef = useRef(onHeldChange);
  heldRef.current = onHeldChange;

  const size = large ? SIZE.large : SIZE.normal;
  const knob = Math.round(size * KNOB_RATIO);
  const travel = size / 2 - knob * (0.5 - KNOB_OVERHANG);
  /** 손잡이가 테두리 밖으로 나오는 거리 — 속도 단추와 겹치지 않게 그만큼 띄운다. */
  const overhang = Math.ceil(knob * KNOB_OVERHANG);

  // ── 자리: 판 컨테이너 오른쪽 아래 ──
  useLayoutEffect(() => {
    const probe = probeRef.current;
    if (!probe) return;
    const measure = (): void => {
      const r = probe.getBoundingClientRect();
      const root = document.documentElement;
      setAnchor((prev) => {
        const next = {
          right: Math.max(0, root.clientWidth - r.right),
          bottom: Math.max(0, root.clientHeight - r.bottom),
          vw: root.clientWidth,
          vh: root.clientHeight,
        };
        return prev && prev.right === next.right && prev.bottom === next.bottom && prev.vw === next.vw && prev.vh === next.vh ? prev : next;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(probe);
    // UI 배율(--ui-scale)은 transform 이라 ResizeObserver 가 모른다 — 그 값이 사는 documentElement 의 style 을 본다.
    const mo = new MutationObserver(measure);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const placeKnob = useCallback((x: number, y: number, spring: boolean) => {
    const el = knobRef.current;
    if (!el) return;
    el.style.transition = spring ? 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none';
    el.style.transform = `translate(${x}px, ${y}px)`;
  }, []);

  /** 손짓 끝 — 가운데로, 입력 0. 캡처는 풀 수 있으면 푼다(lostpointercapture 로 다시 들어와도 activeRef 가 비어 있어 한 번뿐). */
  const release = useCallback(
    (zeroInput: boolean) => {
      const id = activeRef.current;
      if (id === null) return;
      activeRef.current = null;
      if (zeroInput) source.set(ZERO_INPUT);
      placeKnob(0, 0, true);
      const base = baseRef.current;
      if (base?.hasPointerCapture?.(id)) base.releasePointerCapture(id);
      heldRef.current?.(false);
    },
    [source, placeKnob],
  );

  // 세션이 입력원을 비우면(blur·숨김·끝·갈아타기) 손짓도 끝낸다.
  useEffect(() => source.onReset(() => release(false)), [source, release]);
  // 화면에서 빠지면(모드 끝) 쥔 손짓을 놓는다.
  useEffect(() => () => release(true), [release]);

  const track = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const dx = e.clientX - centerRef.current.x;
      const dy = e.clientY - centerRef.current.y;
      const k = snapKnob(dx, dy, travel);
      placeKnob(k.x, k.y, false);
      source.set(stickToInput(dx, dy, travel));
    },
    [source, travel, placeKnob],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    e.stopPropagation();
    if (activeRef.current !== null) return; // 손가락 하나만
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); // 마우스 끌기가 글자를 고르거나 초점을 옮기지 않게
    const base = e.currentTarget;
    const r = base.getBoundingClientRect();
    centerRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    activeRef.current = e.pointerId;
    base.setPointerCapture?.(e.pointerId);
    heldRef.current?.(true);
    track(e);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.pointerId !== activeRef.current) return;
    e.stopPropagation();
    track(e);
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>): void => {
    e.stopPropagation();
    if (e.pointerId !== activeRef.current) return;
    release(true);
  };

  const btn = large ? 56 : 44;
  // 판이 판넬보다 좁으면(좁은 세로 창 + 큰 표적 — 2026-11-17 실측 412×839 에서 판 컨테이너 폭 ≈ 90 px) 판 오른쪽 아래에 맞추면 화면 왼쪽
  // 밖으로 나간다. 화면 안에 붙잡아 둔다 — 그때는 트레이 일부를 덮지만 몰 수단이 사라지는 것보다 낫다.
  // 손잡이는 받침 테두리 밖으로 overhang 만큼 나간다 — 오른쪽·아래 여백과 위쪽 높이에 그만큼 더해 판·화면 밖으로 나가지 않게.
  const edge = GAP + overhang;
  const panelW = size + 8 + overhang + btn;
  const panelH = Math.max(size + overhang, 3 * btn + 8);
  const right = anchor ? Math.max(edge, Math.min(anchor.right + edge, anchor.vw - panelW - edge)) : edge;
  const bottom = anchor ? Math.max(edge, Math.min(anchor.bottom + edge, anchor.vh - panelH - GAP)) : edge;
  const speedBtn = {
    width: btn,
    height: btn,
    minWidth: 'var(--hit)',
    minHeight: 'var(--hit)',
    borderRadius: 999,
    border: '1px solid var(--border-strong)',
    background: 'color-mix(in srgb, var(--panel) 92%, transparent)',
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  } as const;
  // [+]·[−] 는 글자가 아니라 그림으로 — 글꼴의 기준선·글리프 여백 때문에 원 가운데에서 비켜 보였다(2026-11-18 기현님).
  const icon = (plus: boolean) => (
    <svg aria-hidden="true" width={btn * 0.42} height={btn * 0.42} viewBox="0 0 16 16" style={{ display: 'block' }}>
      <path d={plus ? 'M8 2v12M2 8h12' : 'M2 8h12'} stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" fill="none" />
    </svg>
  );

  return (
    <>
      <div ref={probeRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', visibility: 'hidden' }} />
      {anchor &&
        createPortal(
          <div
            role="group"
            aria-label={t('drive.stick.label')}
            data-testid="drive-joystick"
            data-drive-ui=""
            style={{
              position: 'fixed',
              right: `max(${right}px, calc(env(safe-area-inset-right, 0px) + ${edge}px))`,
              bottom: `max(${bottom}px, calc(env(safe-area-inset-bottom, 0px) + ${edge}px))`,
              // 판·상단 띠(3) 위, 도구 레일 펼침(40)·메뉴(60)·모달(70~) 아래 — 조정 중에 떠도 그것들을 가리지 않는다.
              zIndex: 35,
              display: 'flex',
              alignItems: 'center',
              gap: 8 + overhang,
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
            // 단추의 누름·클릭도 포털을 거슬러 편집기 조상으로 번지지 않게(받침은 자기 처리기에서 끊는다).
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                data-testid="drive-speed-up"
                aria-label={t('drive.speed.up')}
                title={t('drive.speed.up')}
                disabled={level >= DRIVE.levels}
                onClick={() => onLevel(level + 1)}
                style={speedBtn}
              >
                {icon(true)}
              </button>
              <span
                data-testid="drive-speed-level"
                title={t('drive.speed.level', { level })}
                style={{
                  minWidth: btn,
                  textAlign: 'center',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: 'var(--text)',
                  fontVariantNumeric: 'tabular-nums',
                  textShadow: '0 0 3px var(--panel)',
                }}
              >
                {level}
              </span>
              <button
                type="button"
                data-testid="drive-speed-down"
                aria-label={t('drive.speed.down')}
                title={t('drive.speed.down')}
                disabled={level <= 1}
                onClick={() => onLevel(level - 1)}
                style={speedBtn}
              >
                {icon(false)}
              </button>
            </div>
            <div
              ref={baseRef}
              role="img"
              aria-label={t('drive.stick.aria')}
              title={t('drive.stick.aria')}
              data-testid="drive-stick"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              onLostPointerCapture={onPointerEnd}
              style={{
                position: 'relative',
                width: size,
                height: size,
                flex: 'none',
                borderRadius: '50%',
                border: '2px solid color-mix(in srgb, var(--accent) 70%, transparent)',
                background: 'color-mix(in srgb, var(--panel) 55%, transparent)',
                boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--text) 12%, transparent)',
                touchAction: 'none',
                cursor: 'grab',
              }}
            >
              {/* 받침에 내접하는 점선 십자 — 데드존 안에서 손잡이가 이 선에 붙는다(snapKnob). */}
              <svg
                aria-hidden="true"
                width={size - 4}
                height={size - 4}
                viewBox="-1 -1 2 2"
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
              >
                <path
                  d="M0 -1V1M-1 0H1"
                  stroke="color-mix(in srgb, var(--text) 45%, transparent)"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  vectorEffect="non-scaling-stroke"
                  fill="none"
                />
              </svg>
              <div
                ref={knobRef}
                aria-hidden="true"
                data-testid="drive-stick-knob"
                style={{
                  position: 'absolute',
                  left: (size - knob) / 2 - 2,
                  top: (size - knob) / 2 - 2,
                  width: knob,
                  height: knob,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  border: '2px solid var(--accent-ink-strong)',
                  boxShadow: '0 2px 6px color-mix(in srgb, black 35%, transparent)',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
