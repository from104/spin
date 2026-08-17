// §PLAN-STEP-EDITING.md 화면 배치 · 스텝 카드 — 왼쪽 세로 스텝 바(기현님 확정 2026-08-17).
//
// ── 왜 사이드바인가 (계획서 §화면 배치) ─────────────────────────────────────────────────
// 드릴 편집의 "스텝을 고르고 복제·이동한다"는 하단 TransportBar 의 가로 칩 줄(2026-08-12
// 재편)에 살고 있었다. 조사(RESEARCH-DRILL-EDITORS.md)가 가져온 것은 PPT/FastDraw 류의
// **왼쪽 세로 슬라이드 바** 문법이다 — 목록·선택·복제·이동·사슬·삭제를 한 자리에 모으고,
// TransportBar 는 재생 컨트롤만 남긴다(TransportBar.tsx 머리말). 이 파일은 그 첫 단계
// (구현 순서 ②)로 **목록·현재 스텝 강조·탭 이동·단일 카드 드래그 재정렬**만 담는다 — 복제
// 버튼·틈의 + · 사슬 토글·다중 선택은 ③~⑤가 이 GapSlot 자리에 얹는다.
//
// ── 스텝 카드 = 번호 + 썸네일만 ──────────────────────────────────────────────────────────
// "스텝 정보 최소화"(기현님 확정) — 이름은 카드에서 안 보인다. `DrillStep.name` 필드 자체는
// 당분간 모델에 남고(구현 순서 ⑦이 note 로 병합해 정리한다), 이 화면은 그 필드를 그냥 안 읽는다.
//
// ── 썸네일 계산은 TransportBar 의 칩 시절 것을 그대로 물려받는다 ────────────────────────
// `thumbs`/`teamColors` 메모, `CourtThumbnail glyphScale` 배선은 옛 TransportBar 의 사진 뭉치
// 로직 그대로다(2026-08-12 감사 evidence: 드릴이 안 바뀌면 다시 안 그린다). 배수 상수만
// `SIDEBAR_GLYPH_SCALE`(CourtThumbnail.tsx)로 바뀌었다 — 카드가 칩보다 훨씬 커서 목록 카드에
// 가까운 배수로 완전 보정할 수 있다(그 상수의 계산 주석 참고).
//
// ── 순서 바꾸기: 끌기 + 키보드 ───────────────────────────────────────────────────────────
// 끌기는 HTML5 DnD 가 아니라 포인터 이벤트다(태블릿에서 HTML5 DnD 는 사실상 죽어 있다 —
// useStepReorderDrag.ts 머리말). 세로 목록이라 축만 'y' 로 바뀌었을 뿐 문턱·미리보기·커밋
// 시점 규칙은 옛 가로 칩과 같다. 포인터 조작이 실패하기 쉬운 상황(끌기 정밀도가 필요한 조작을
// 마우스·터치가 아닌 다른 경로로 하는 경우 전반)을 위해 키보드 경로도 장식이 아니라 동등한
// 주 경로다: Space 로 집고 ↑/↓ 로 옮기고 Space/Enter 로 놓고 Esc 로 되돌린다. 세로 목록이라
// 좌우(←/→)가 아니라 상하(↑/↓) 를 쓴다 — 그 두 키는 전역에서 아무 것도 안 먹고 있다
// (core/keymap.ts: 스텝 이동은 PageUp/PageDown, 개체 이동은 포커스가 개체에 있을 때만).
//
// ── 접힘/고정은 같은 컴포넌트의 표시 모드다 ──────────────────────────────────────────────
// 좁은 창·세로 화면(collapsed)이면 고정 자리 대신 **여는 버튼**만 남고, 열면 판 위 **오버레이**
// 로 뜬다(닫기 = 바깥 탭 또는 같은 버튼 재클릭). 목록·재정렬 로직(`body`)은 두 모드가 완전히
// 같은 JSX 를 공유한다 — 감싸는 뼈대(고정 <nav> ↔ 오버레이 <nav> + 배경)만 갈린다.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Drill } from '../../model/drill.ts';
import type { StepId } from '../../core/ids.ts';
import { courtDefFor } from '../../model/court.ts';
import { IconListSteps, IconPlus } from '../../ui/icons.tsx';
import { CourtThumbnail, SIDEBAR_GLYPH_SCALE } from '../../render/CourtThumbnail.tsx';
import { buildStepThumb } from '../../model/thumb.ts';
import { LIMITS } from '../../model/validate.ts';
import { liveRegion } from '../../ui/LiveRegion.tsx';
import { movedOrder } from './bottomBarMetrics.ts';
import { useStepReorderDrag } from './useStepReorderDrag.ts';

export interface StepSidebarProps {
  /** 카드마다 판을 그리므로 steps 만으로는 부족하다 — cast·팀 색·코트가 함께 필요하다. */
  drill: Drill;
  stepId: StepId;
  onSelectStep(id: StepId): void;
  /** 순서 변경. `toIndex` 는 옮긴 **뒤**의 자리(edits.ts moveStep 과 같은 규칙). */
  onReorderStep(id: StepId, toIndex: number): void;
  /** [한 장 더 찍기] — 지금 스텝을 복제해 바로 뒤에 넣는다(STEP_ADD 의미 그대로,
   *  EditorWorkspace.addStepHere 가 이어 커밋 뒤 새 스텝을 선택한다). */
  onAddStep(): void;
  /** 좁은 창·세로 화면이면 true(EditorWorkspace 의 `narrow || portrait`). */
  collapsed: boolean;
}

/** 사이드바 고정/오버레이 폭. 좌우 패딩(`SIDEBAR_PAD_PX` 10×2)을 빼면 카드가 실제로 채우는
 *  폭이 200px 다 — `CourtThumbnail` 의 `SIDEBAR_GLYPH_SCALE` 계산 주석이 이 숫자에서 나온다.
 *  두 상수가 갈리면 그 주석이 거짓말을 하므로 폭을 바꿀 때는 함께 고친다. */
export const SIDEBAR_WIDTH_PX = 220;
export const SIDEBAR_PAD_PX = 10;

const cardNumberBadge = (selected: boolean) =>
  ({
    position: 'absolute',
    left: 6,
    top: 6,
    minWidth: 18,
    height: 18,
    padding: '0 4px',
    borderRadius: 5,
    background: selected ? 'var(--accent)' : 'color-mix(in srgb, var(--panel) 82%, transparent)',
    color: selected ? 'var(--accent-ink-strong)' : 'var(--muted)',
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '0.75rem',
    fontWeight: 700,
    lineHeight: '18px',
    textAlign: 'center',
  }) as const;

/** 카드 사이·양 끝의 틈. 지금은 드래그 중 놓을 자리를 보여주는 표시와 자리뿐이다 —
 *  이후 단계(복제 + 버튼·사슬 토글, PLAN-STEP-EDITING.md 구현 순서 ③④)가 여기 꽂힌다.
 *  `data-gap-index` 는 그 단계가 "이 틈이 몇 번째인가" 를 찾는 자리다. */
function GapSlot({ index, active }: { index: number; active: boolean }) {
  return (
    <div
      data-gap-index={index}
      aria-hidden="true"
      style={{
        flex: 'none',
        height: active ? 10 : 4,
        margin: '1px 0',
        borderRadius: 3,
        background: active ? 'var(--accent)' : 'transparent',
        transition: 'height 120ms ease, background 120ms ease',
      }}
    />
  );
}

export function StepSidebar({ drill, stepId, onSelectStep, onReorderStep, onAddStep, collapsed }: StepSidebarProps) {
  const steps = drill.steps;

  // 카드 사진. 드릴이 바뀔 때만 다시 만든다 — TransportBar 시절 칩과 같은 이유
  // (드릴이 안 바뀌면 재사용, 60장이라도 CourtThumbnail 이 새 props 로 다시 그리지 않는다).
  const thumbs = useMemo(() => new Map(drill.steps.map((s, i) => [s.id, buildStepThumb(drill, i)])), [drill]);
  const teamColors = useMemo(
    () => ({
      home: drill.teams.home.color,
      away: drill.teams.away.color,
      homeGk: drill.teams.home.gkColor,
      awayGk: drill.teams.away.gkColor,
    }),
    [drill.teams],
  );
  const courtDef = courtDefFor(drill.courtMode, drill.courtSize);
  const cardAspectCss = `${courtDef.vbW} / ${courtDef.vbH}`;

  const cardRefs = useRef(new Map<StepId, HTMLButtonElement>());
  const measureCenters = useCallback(
    () =>
      // 지금 **화면 순서**로 재야 한다(세로 목록이라 top 기준). steps 순서로 재면 미리보기로
      // 자리를 바꾼 뒤 판정이 어긋난다 — DOM 을 직접 훑는 이유다.
      [...cardRefs.current.values()]
        .filter((el) => el.isConnected)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return r.top + r.height / 2;
        }),
    [],
  );
  const drag = useStepReorderDrag({
    axis: 'y',
    measureCenters,
    onCommit: (id, to) => {
      onReorderStep(id, to);
      liveRegion.say(`${to + 1}번째로 옮겼습니다.`);
    },
  });

  // 키보드 순서 바꾸기의 '집은' 상태. 집힌 카드는 ↑/↓ 를 전역으로 안 넘기고 자기가 먹는다.
  const [held, setHeld] = useState<{ id: StepId; origin: number } | null>(null);
  const hintId = useId();

  // 끌기 중에는 미리보기 순서로 그린다. 커밋은 손을 뗄 때 한 번이다.
  const order = drag.state ? movedOrder(steps, drag.state.from, drag.state.to) : steps;

  // 스텝이 바뀌면 그 카드가 보이도록 목록을 굴린다. jsdom 에는 scrollIntoView 가 없다 —
  // 존재 가드 후 호출한다.
  useEffect(() => {
    cardRefs.current.get(stepId)?.scrollIntoView?.({ block: 'nearest' });
  }, [stepId]);

  const onCardKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, s: { id: StepId }, i: number) => {
    if (e.key === ' ') {
      // 네이티브 click(Space 로 발화)과 전역 재생 토글을 **둘 다** 막는다. 여기서 막지 않으면
      // 집으려던 순간 스텝이 선택되고 재생이 켜진다.
      e.preventDefault();
      e.stopPropagation();
      if (held?.id === s.id) {
        setHeld(null);
        liveRegion.say(`${i + 1}번째에 놓았습니다.`);
      } else {
        setHeld({ id: s.id, origin: i });
        liveRegion.say(`스텝 ${i + 1} 집었습니다. 위아래 방향키로 옮기고 스페이스로 놓으세요.`);
      }
      return;
    }
    if (!held || held.id !== s.id) return; // 집지 않았으면 ↑/↓ 는 아무 것도 안 건드린다

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      const to = i + (e.key === 'ArrowUp' ? -1 : 1);
      if (to < 0 || to >= steps.length) return; // 끝에서는 조용히 멈춘다(감아 돌지 않는다)
      onReorderStep(s.id, to);
      liveRegion.say(`${to + 1}번째로 옮겼습니다.`);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // 전역 Esc(선택 해제)까지 함께 터지면 되돌린 이유가 안 보인다
      onReorderStep(s.id, held.origin);
      setHeld(null);
      liveRegion.say('제자리로 되돌렸습니다.');
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      setHeld(null);
      liveRegion.say(`${i + 1}번째에 놓았습니다.`);
    }
  };

  const panelId = useId();
  const [open, setOpen] = useState(false);

  const body = (
    <>
      <span id={hintId} className="sr-only">
        스페이스로 집은 뒤 위아래 방향키로 순서를 바꿉니다. 스페이스나 엔터로 놓고, Esc 로 되돌립니다.
      </span>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: SIDEBAR_PAD_PX,
        }}
      >
        {order.flatMap((s, i) => {
          const selected = s.id === stepId;
          const dragging = drag.state?.id === s.id;
          const grabbed = held?.id === s.id;
          return [
            <GapSlot key={`gap-${s.id}`} index={i} active={drag.state !== null && drag.state.to === i} />,
            <button
              key={s.id}
              ref={(el) => {
                if (el) cardRefs.current.set(s.id, el);
                else cardRefs.current.delete(s.id);
              }}
              type="button"
              // 화면 순서를 재정렬 계산·테스트가 읽는 자리. ARIA 의미가 아니라 순전한 배관이라
              // aria-posinset(특정 role 을 요구한다) 대신 평범한 데이터 속성을 쓴다.
              // `data-step-id` 는 카드가 없앤 이름표(name) 대신 테스트가 "화면 순서가 아니라
              // 실제 어느 스텝인가" 를 식별하는 자리다 — aria-label 은 표시 위치(`i+1`)라
              // 순서가 바뀌면 같은 값이 다른 스텝에서도 나온다.
              data-index={i}
              data-step-id={s.id}
              aria-current={selected ? 'step' : undefined}
              aria-label={`스텝 ${i + 1}`}
              aria-describedby={hintId}
              onPointerDown={(e) => drag.start(e, s.id, i)}
              onClick={() => {
                if (drag.consumeDragClick()) return; // 끌기의 뒤끝이 선택으로 둔갑하지 않게
                onSelectStep(s.id);
              }}
              onKeyDown={(e) => onCardKeyDown(e, s, i)}
              onBlur={() => grabbed && setHeld(null)}
              style={{
                position: 'relative',
                flex: 'none',
                width: '100%',
                aspectRatio: cardAspectCss,
                borderRadius: 10,
                overflow: 'hidden',
                background: 'var(--elev)',
                border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                outline: grabbed ? '2px dashed var(--accent)' : undefined,
                outlineOffset: 2,
                opacity: dragging ? 0.55 : 1,
                // 세로 목록이라 드래그 축(y)과 목록 스크롤 축(y)이 같다 — 카드 위에서 시작한
                // 손짓은 재정렬이 가져간다(옛 가로 칩도 같은 트레이드오프였다, touchAction:
                // 'pan-y'). 목록이 넘칠 때 터치로 굴리려면 카드가 아니라 틈을 잡아야 한다.
                touchAction: 'pan-x',
              }}
            >
              <span aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
                <CourtThumbnail
                  fill
                  mode={drill.courtMode}
                  size={drill.courtSize}
                  thumb={thumbs.get(s.id)}
                  teamColors={teamColors}
                  glyphScale={SIDEBAR_GLYPH_SCALE}
                />
              </span>
              <span aria-hidden="true" style={cardNumberBadge(selected)}>
                {i + 1}
              </span>
            </button>,
          ];
        })}
        <GapSlot index={order.length} active={false} />

        <button
          type="button"
          title={steps.length >= LIMITS.maxSteps ? `스텝은 ${LIMITS.maxSteps}장까지입니다.` : '지금 판을 한 장 더 찍어 뒤에 넣습니다.'}
          disabled={steps.length >= LIMITS.maxSteps}
          onClick={onAddStep}
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            minHeight: 'var(--hit)',
            marginTop: 4,
            border: '1px dashed var(--border-strong)',
            borderRadius: 10,
            color: 'var(--faint-text)',
            fontSize: '0.78125rem',
            fontWeight: 600,
            opacity: steps.length >= LIMITS.maxSteps ? 0.4 : 1,
          }}
        >
          <IconPlus size={15} />
          한 장 더 찍기
        </button>
      </div>
    </>
  );

  if (!collapsed) {
    return (
      <nav
        aria-label="스텝 목록"
        style={{
          flex: 'none',
          width: SIDEBAR_WIDTH_PX,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          borderRight: '1px solid var(--border)',
          background: 'var(--panel)',
        }}
      >
        {body}
      </nav>
    );
  }

  // ── 접힘 모드 — 여는 버튼 + 오버레이(닫기 = 바깥 탭 또는 같은 버튼) ─────────────────────
  // 부모(EditorWorkspace)의 `<main>` 이 이미 position:relative 라 여기서 absolute 로 그 상자
  // 기준에 뜬다(InspectorHost 의 오버레이와 같은 자리 규칙).
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? '스텝 목록 닫기' : '스텝 목록 열기'}
        onClick={() => setOpen((v) => !v)}
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 20,
          width: 'var(--hit)',
          height: 'var(--hit)',
          borderRadius: 10,
          background: 'var(--panel)',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 6px 16px rgba(0,0,0,.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text)',
        }}
      >
        <IconListSteps size={18} />
      </button>
      {open && (
        // 바깥 탭 = 배경 자체를 눌렀을 때만(target===currentTarget) — ui/Modal.tsx 의 백드롭과
        // 같은 판정이다. 자식(카드·버튼)을 눌렀을 때는 새지 않는다.
        <div
          data-sidebar-backdrop=""
          aria-hidden="true"
          onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}
          style={{ position: 'absolute', inset: 0, zIndex: 24, background: 'rgba(0,0,0,.25)' }}
        />
      )}
      {open && (
        <nav
          id={panelId}
          aria-label="스텝 목록"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            zIndex: 25,
            width: `min(${SIDEBAR_WIDTH_PX}px, 88%)`,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            background: 'var(--panel)',
            borderRight: '1px solid var(--border-strong)',
            boxShadow: '10px 0 30px rgba(0,0,0,.35)',
          }}
        >
          {body}
        </nav>
      )}
    </>
  );
}
