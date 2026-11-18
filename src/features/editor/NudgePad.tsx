// 미세 조정 패드 — 개체 메뉴의 [미세 조정] 이 여는 **떠 있는 반투명 팝업** (기현 지시 2026-09-02).
//
// *"모든 객체 오른쪽 메뉴(긴터치)에 미세 조정이라는 메뉴 넣고 마우스 또는 터치로 키보드
//  이동·회전을 에뮬하는 팝업을 반투명하게 만들고 아무 키를 누르거나 다른곳 클릭·터치시 닫기.
//  기존 오른 버튼에 나오는 키보드 이동 패드를 이걸로 대체"*
//
// ── 왜 메뉴 안에서 꺼냈는가 ──────────────────────────────────────────────────────────
// 2026-08-29 에는 이 3×2 판이 **개체 메뉴 안에** 박혀 있었다. 그래서 두 가지가 겹쳤다:
//   ① 메뉴가 불투명해서, 조정하는 동안 **정작 움직이는 개체가 메뉴 밑에 깔렸다.** 2.5px 을
//      맞추는 조작인데 결과가 안 보이면 맞출 수가 없다.
//   ② 이 칸들만 메뉴를 안 닫는 예외라, 같은 메뉴 안에 "한 번 누르면 끝나는 명령" 과
//      "여러 번 눌러 맞추는 조작" 이 등급이 다른 채로 붙어 있었다.
// 팝업으로 떼면 둘 다 사라진다 — 반투명이라 개체가 비쳐 보이고, 메뉴 닫힘 규칙과 얽히지 않는다.
//
// ── 닫히는 조건 ─────────────────────────────────────────────────────────────────────
// **아무 키나 한 번** 누르면 닫힌다(지시). 이상해 보이지만 근거가 있다: 이 패드는 애초에
// **키보드가 없는 기기**를 위한 물건이다(태블릿). 키가 눌렸다는 것은 키보드가 있다는 뜻이고,
// 그 사람에게는 방향키·Q·E 라는 더 빠른 길이 이미 있다. 그래서 키를 **막지 않는다** —
// 전파를 그대로 두므로 `ArrowRight` 한 번이 *패드를 닫으면서 동시에 개체를 옮긴다.*
//
// 그 대가로 이 패드 안에서는 Tab·Enter 가 안 통한다. 접근성 손실이 아닌 이유가 위와 같다:
// 키보드로 할 수 있는 일이 줄지 않는다(§7.5 의 요건은 "키보드로 같은 일을 할 수 있는가" 이고,
// 그 답은 이 패드 없이도 참이다).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../i18n/useT.ts';
import { IconUTurn } from '../../ui/icons.tsx';

// ⚠️ 2026-09-14 — `canNudge`·`canRotate` 는 **이 파일에서 나갔다**(`nudgeCaps.ts`). 판정이 화면
// 부품 안에 살던 동안 키보드가 그것을 안 읽어, 패드는 획을 돌릴 수 있는데 Q·E 는 못 돌리는
// 비대칭이 살아 있었다. 이름을 그대로 재수출하는 것은 바깥 호출자(개체 메뉴)를 안 건드리려는
// 것이고, **판정 자체는 이제 여기 없다**.
import { isId } from '../../core/ids.ts';
import { canRotate } from './nudgeCaps.ts';
export { canNudge, canRotate } from './nudgeCaps.ts';

/** 누르고 있으면 반복한다. 없으면 25px 을 옮기는 데 열 번을 눌러야 하고, 그건 정밀 조작을
 *  주려다 반복 조작을 새로 만드는 것이다. 700ms 병합(COALESCE_TYPES)이 있으므로 이 반복은
 *  되돌리기 한 칸으로 합쳐진다. */
const REPEAT_DELAY_MS = 380;
const REPEAT_MS = 70;

const PAD_BTN: React.CSSProperties = {
  minWidth: 'var(--hit)',
  minHeight: 'var(--hit)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--border)',
  borderRadius: 9,
  // 칸 자체도 반투명이다 — 패널만 비치고 칸이 꽉 차 있으면 정작 개체가 있는 가운데가 가려진다.
  background: 'color-mix(in srgb, var(--panel-2) 30%, transparent)',
  color: 'var(--text)',
  fontSize: '1.0625rem',
  lineHeight: 1,
  // 길게 눌러도 텍스트 선택·확대 제스처가 끼어들지 않게(터치 전용 기능이므로 특히 중요).
  touchAction: 'none',
  userSelect: 'none',
};

/** 방향판 한 칸 — 화면 방향(단위 아님, 부호만 본다). 가운데 칸은 'flip'(180°). */
export type HeadingCmd = { kind: 'face'; sx: number; sy: number } | { kind: 'flip' };

/** 방향판의 아홉 칸, 3×3 읽는 순서. 화살표는 **화면** 방향이다 — 코트가 돌아가 있으면(세로 창) 받는 쪽이
 *  판 좌표로 바꾼다(EditorStage, 이동 칸과 같은 screenDeltaToWorld). */
type HeadingKey = 'upLeft' | 'up' | 'upRight' | 'left' | 'flip' | 'right' | 'downLeft' | 'down' | 'downRight';
const HEADING_CELLS: readonly { key: HeadingKey; glyph: ReactNode; cmd: HeadingCmd }[] = [
  { key: 'upLeft', glyph: '↖', cmd: { kind: 'face', sx: -1, sy: -1 } },
  { key: 'up', glyph: '↑', cmd: { kind: 'face', sx: 0, sy: -1 } },
  { key: 'upRight', glyph: '↗', cmd: { kind: 'face', sx: 1, sy: -1 } },
  { key: 'left', glyph: '←', cmd: { kind: 'face', sx: -1, sy: 0 } },
  // 글자 "180°" 대신 U턴 그림(2026-11-16 기현님 지시 "직관적인 아이콘으로")
  { key: 'flip', glyph: <IconUTurn size={20} />, cmd: { kind: 'flip' } },
  { key: 'right', glyph: '→', cmd: { kind: 'face', sx: 1, sy: 0 } },
  { key: 'downLeft', glyph: '↙', cmd: { kind: 'face', sx: -1, sy: 1 } },
  { key: 'down', glyph: '↓', cmd: { kind: 'face', sx: 0, sy: 1 } },
  { key: 'downRight', glyph: '↘', cmd: { kind: 'face', sx: 1, sy: 1 } },
];

function NudgeButton({
  label,
  glyph,
  onFire,
  testId,
  repeat = true,
}: {
  label: string;
  glyph: ReactNode;
  onFire(): void;
  testId: string;
  /** 누르고 있으면 반복할지. 방향판은 **한 번**이다 — 180° 가 반복되면 누르는 동안 빙글빙글 돈다. */
  repeat?: boolean;
}) {
  const fireRef = useRef(onFire);
  fireRef.current = onFire;
  const timers = useRef<{ delay?: number; rep?: number }>({});
  const stop = useCallback(() => {
    if (timers.current.delay !== undefined) window.clearTimeout(timers.current.delay);
    if (timers.current.rep !== undefined) window.clearInterval(timers.current.rep);
    timers.current = {};
  }, []);
  // 손을 뗀 신호를 못 받고 언마운트되면(패드가 닫히면) 인터벌이 계속 돌아 개체가 혼자 간다.
  useEffect(() => stop, [stop]);
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        // 위쪽(패널·포털 조상)의 pointerdown 처리기에 이 누름이 "바깥을 눌렀다" 로 읽히지
        // 않게 막는다. ⚠️ 바깥 덮개 때문이 **아니다** — 덮개는 이 패널의 조상이 아니라
        // 형제라(둘 다 포털의 직계) 애초에 여기로 안 온다. 2026-09-02 첫 주석이 그렇게
        // 적혀 있었는데, 돌연변이 시험에서 패널에 닫기를 달아 보니 이 줄이 그걸 막고 있어서
        // 근거가 틀렸다는 것이 드러났다.
        e.stopPropagation();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        fireRef.current();
        if (!repeat) return;
        timers.current.delay = window.setTimeout(() => {
          timers.current.rep = window.setInterval(() => fireRef.current(), REPEAT_MS);
        }, REPEAT_DELAY_MS);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      style={PAD_BTN}
    >
      <span aria-hidden style={{ display: 'flex' }}>
        {glyph}
      </span>
    </button>
  );
}

export interface NudgePadTarget {
  /** 조정할 개체들. 개체 메뉴의 `ids` 를 그대로 물려받는다. */
  ids: string[];
  /** 화면 좌표(clientX/Y) — 패드가 뜰 자리. 메뉴가 떴던 자리와 같다. */
  x: number;
  y: number;
}

export interface NudgePadProps {
  target: NudgePadTarget | null;
  onClose(): void;
  /** 미세 이동 — **단위 벡터**를 보낸다(-1·0·1). 걸음 크기는 부르는 쪽(EditorStage)이 키보드와
   *  같은 상수로 곱한다. `dTheta` 는 회전 방향이고, `canRotate` 가 거짓이면 언제나 0 이다. */
  onNudge(ids: string[], dx: number, dy: number, dTheta: number): void;
  /** 방향판(휠체어 하나일 때만 뜬다) — 화면 방향을 보게 돌리기 또는 180°. 없으면 방향판을 안 그린다. */
  onHeading?(ids: string[], cmd: HeadingCmd): void;
  /** 심플 모드(휠체어 = 원, 2026-11-19 기현님 지시 *"미세 조정 패널에서도 상하좌우 이동만 되고 방향 관련을 숨겨"*) — 원에는 방향이
   *  없어 방향판·180°·회전 칸이 다 빠지고 ▲◀▼▶ 넷만 남는다. 판정은 nudgeCaps `canRotate` 하나다(키보드 Q·E·숫자키와 같은 답). */
  chairDisc?: boolean;
}

export function NudgePad({ target, onClose, onNudge, onHeading, chairDisc = false }: NudgePadProps) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // 자리 계산은 **페인트 전**이라야 한다(개체 메뉴와 같은 규율) — useEffect 로 미루면 한
  // 프레임 동안 잘린 자리에 그려졌다가 튀고, 그리로 향하던 조준이 통째로 빗나간다.
  useLayoutEffect(() => {
    if (!target) {
      setPos(null);
      return;
    }
    const el = panelRef.current;
    const w = el?.offsetWidth ?? 160;
    const h = el?.offsetHeight ?? 160;
    const pad = 8;
    const left = target.x + w + pad > window.innerWidth ? Math.max(pad, target.x - w) : target.x;
    const top = target.y + h + pad > window.innerHeight ? Math.max(pad, target.y - h) : target.y;
    setPos({ left, top });
  }, [target]);

  useEffect(() => {
    if (!target) return;
    // **아무 키나** 닫는다(머리말). 전파를 막지 않으므로 그 키의 원래 동작은 그대로 난다 —
    // 방향키 한 번이 패드를 닫으면서 개체도 옮긴다.
    const onKey = (): void => onClose();
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [target, onClose]);

  if (!target) return null;

  const rot = canRotate(target.ids, chairDisc);
  // 방향판은 휠체어 하나일 때만(2026-11-16 기현님 지시 "휠체어의 미세 조종 패널 위에 8방향 설정과 중앙은 180도 회전").
  // 방향이 뜻을 갖는 캐스트는 휠체어뿐이고(nudgeCaps), 여럿이면 회전 칸과 같은 이유로 축이 하나로 안 정해진다.
  const heading = onHeading !== undefined && rot && isId(target.ids[0]!, 'ch');

  return createPortal(
    <>
      {/* 바깥을 덮는 판 — 누르면 닫힌다. 투명이지만 **포인터를 받는다**: 안 두면 패드를
          닫으려던 탭이 코트에 닿아 개체를 하나 더 놓거나 선택을 바꾼다. */}
      <div
        onPointerDown={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
        style={{ position: 'fixed', inset: 0, zIndex: 60 }}
      />
      <div
        ref={panelRef}
        role="group"
        data-testid="nudge-pad"
        aria-label={t('editor.nudgePad.ariaLabel')}
        style={{
          position: 'fixed',
          left: pos?.left ?? target.x,
          top: pos?.top ?? target.y,
          zIndex: 61,
          display: 'grid',
          // 휠체어 하나면 위에 방향판 3×3 + 구분선이 붙는다(2026-11-16 기현님 지시 — 방향은 칸 수를 줄일 수 없다).
          // 이동판은 **3열 × 2행**(기현 지시 2026-09-02). 한 번 십자꼴(3×3)로 폈다가 되돌린 것이다:
          // 같은 여섯 칸을 담는데 빈 칸 셋 때문에 판이 한 줄만큼 커졌고, 이 팝업은 코트 위에
          // 뜨므로 큰 만큼 그대로 가림이다 — 반투명으로 벌어 놓은 것을 크기로 도로 까먹는다.
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          padding: 8,
          borderRadius: 14,
          border: '1px solid var(--border-strong)',
          // ★ 반투명이 이 팝업의 존재 이유다(기현 지시) — 조정하는 동안 **개체가 비쳐 보여야**
          //   2.5px 을 맞출 수 있다. 패널 전체에 opacity 를 걸지 않는 이유: 그러면 화살표
          //   글리프까지 흐려져 코트 무늬와 섞인다. 배경만 섞고 글자는 불투명하게 둔다.
          //   72% → 45% 로 더 옅게(2026-09-02 기현 지시) — 첫 값은 개체가 비치긴 해도 색이
          //   눌려서, 팀 색이 다른 칩 둘을 나란히 맞출 때 어느 쪽이 어느 팀인지 흐릿했다.
          background: 'color-mix(in srgb, var(--panel) 45%, transparent)',
          boxShadow: '0 12px 28px rgba(0,0,0,.45)',
          // 자리를 아직 못 쟀으면 그리지 않는다(위 useLayoutEffect 의 첫 통과).
          visibility: pos ? 'visible' : 'hidden',
        }}
      >
        {heading && (
          <>
            {HEADING_CELLS.map((c) => (
              <NudgeButton
                key={c.key}
                testId={`nudge-face-${c.key}`}
                label={t(`editor.nudgePad.face.${c.key}`)}
                glyph={c.glyph}
                repeat={false}
                onFire={() => onHeading(target.ids, c.cmd)}
              />
            ))}
            {/* 방향판과 이동판 사이 한 줄 — 같은 생김의 칸이 3행 이어지면 어디까지가 "보게 하기" 인지 안 보인다 */}
            <div aria-hidden style={{ gridColumn: '1 / -1', height: 1, background: 'var(--border)', margin: '2px 0' }} />
          </>
        )}
        {rot ? (
          <NudgeButton testId="nudge-rotateLeft" label={t('editor.objectMenu.rotateLeft')} glyph="↺" onFire={() => onNudge(target.ids, 0, 0, -1)} />
        ) : (
          <span aria-hidden />
        )}
        <NudgeButton testId="nudge-up" label={t('editor.objectMenu.nudgeUp')} glyph="▲" onFire={() => onNudge(target.ids, 0, -1, 0)} />
        {rot ? (
          <NudgeButton testId="nudge-rotateRight" label={t('editor.objectMenu.rotateRight')} glyph="↻" onFire={() => onNudge(target.ids, 0, 0, 1)} />
        ) : (
          <span aria-hidden />
        )}
        <NudgeButton testId="nudge-left" label={t('editor.objectMenu.nudgeLeft')} glyph="◀" onFire={() => onNudge(target.ids, -1, 0, 0)} />
        <NudgeButton testId="nudge-down" label={t('editor.objectMenu.nudgeDown')} glyph="▼" onFire={() => onNudge(target.ids, 0, 1, 0)} />
        <NudgeButton testId="nudge-right" label={t('editor.objectMenu.nudgeRight')} glyph="▶" onFire={() => onNudge(target.ids, 1, 0, 0)} />
      </div>
    </>,
    document.body,
  );
}
