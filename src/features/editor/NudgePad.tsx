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
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isId } from '../../core/ids.ts';
import { useT } from '../../i18n/useT.ts';

/** 미세 조정이 **먹는** 개체인가. `EditorStage.nudge` 가 실제로 다루는 종류와 같아야 한다 —
 *  도형(`sh`)은 거기서도 빠져 있어 여기서도 뺀다(있는데 안 먹는 칸을 내지 않는다).
 *  export 인 이유: 개체 메뉴가 [미세 조정] 칸을 낼지 말지 **같은 판정**으로 정해야 한다. */
export const canNudge = (ids: readonly string[]): boolean =>
  ids.length > 0 && ids.every((id) => isId(id, 'ch') || isId(id, 'bl') || isId(id, 'cn') || isId(id, 'nt') || isId(id, 'ar'));

/** 회전은 **휠체어 하나일 때만**이다. 무리의 회전축이 무엇인지 답이 하나로 안 나오고
 *  (EditorStage 의 `nudge` 주석), 키보드의 Q·E 도 `isId(id,'ch')` 에서만 먹는다 — 방향을
 *  가진 개체가 휠체어뿐이라서다. 공·콘에 회전 칸을 내면 눌러도 아무 일이 없다. */
export const canRotate = (ids: readonly string[]): boolean => ids.length === 1 && isId(ids[0]!, 'ch');

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

function NudgeButton({ label, glyph, onFire }: { label: string; glyph: string; onFire(): void }) {
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
        timers.current.delay = window.setTimeout(() => {
          timers.current.rep = window.setInterval(() => fireRef.current(), REPEAT_MS);
        }, REPEAT_DELAY_MS);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      style={PAD_BTN}
    >
      <span aria-hidden>{glyph}</span>
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
}

export function NudgePad({ target, onClose, onNudge }: NudgePadProps) {
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

  const rot = canRotate(target.ids);

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
        aria-label={t('editor.nudgePad.ariaLabel')}
        style={{
          position: 'fixed',
          left: pos?.left ?? target.x,
          top: pos?.top ?? target.y,
          zIndex: 61,
          display: 'grid',
          // **3열 × 2행**(기현 지시 2026-09-02). 한 번 십자꼴(3×3)로 폈다가 되돌린 것이다:
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
        {rot ? (
          <NudgeButton label={t('editor.objectMenu.rotateLeft')} glyph="↺" onFire={() => onNudge(target.ids, 0, 0, -1)} />
        ) : (
          <span aria-hidden />
        )}
        <NudgeButton label={t('editor.objectMenu.nudgeUp')} glyph="▲" onFire={() => onNudge(target.ids, 0, -1, 0)} />
        {rot ? (
          <NudgeButton label={t('editor.objectMenu.rotateRight')} glyph="↻" onFire={() => onNudge(target.ids, 0, 0, 1)} />
        ) : (
          <span aria-hidden />
        )}
        <NudgeButton label={t('editor.objectMenu.nudgeLeft')} glyph="◀" onFire={() => onNudge(target.ids, -1, 0, 0)} />
        <NudgeButton label={t('editor.objectMenu.nudgeDown')} glyph="▼" onFire={() => onNudge(target.ids, 0, 1, 0)} />
        <NudgeButton label={t('editor.objectMenu.nudgeRight')} glyph="▶" onFire={() => onNudge(target.ids, 1, 0, 0)} />
      </div>
    </>,
    document.body,
  );
}
