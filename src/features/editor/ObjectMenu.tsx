// 개체 팝업 메뉴 — 오른쪽 클릭 / 긴 터치 (기현 지시 2026-08-14).
//
// *"모든 오브젝트에 오른쪽 클릭 또는 긴 터치(모바일, 태블릿) 누르면 잠김, 무시(흐리게,
// 상호작용안함, 칩들의 한해서), 삭제 메뉴가 팝업으로 떠서 동작하게."*
//
// ── 왜 `Modal` 이 아니라 이 파일인가 ─────────────────────────────────────────────────
// 이 저장소의 팝오버는 지금까지 전부 `ui/Modal` 이었다([보기]·[코트]·[내보내기]). 그것들은
// **화면 가운데** 뜨는 것이 맞았다 — 어느 버튼에서 열었든 내용이 같기 때문이다.
// 개체 메뉴는 다르다: *"이 콘"* 을 눌러 연 메뉴가 화면 반대편에 뜨면 어느 개체의 메뉴인지
// 사라진다. 그래서 **누른 자리**에 뜬다. Modal 이 주던 것 중 필요한 둘(Esc·바깥 클릭 닫기)은
// 여기서 직접 단다.
//
// ── 자리 잡기 ────────────────────────────────────────────────────────────────────────
// 포인터 위치에 그대로 띄우면 화면 오른쪽·아래 가장자리에서 메뉴가 잘린다. 넘치면 반대편으로
// 뒤집는다 — 자리를 옮기는 것이 아니라 **뒤집는 것**이라, 메뉴 모서리 하나는 언제나 손끝에 붙어 있다.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LOCK_TINT_COLOR } from '../../core/colors.ts';
import { isId } from '../../core/ids.ts';
import { removalLabel, returnsToTray } from './removal.ts';
import { canNudge } from './NudgePad.tsx';
import { useT } from '../../i18n/useT.ts';
import { useLocale } from '../../i18n/useLocale.ts';
import type { DictKey } from '../../i18n/ko.ts';

/** [복제] 를 낼 것인가 — **도형·메모·화살표**다(기현 지시 2026-08-18: *"보드의 작도 객체,
 *  메모 객체에 오른쪽 버튼 메뉴에 복제 기능을 넣자"*, 화살표는 같은 날 후속 지적 *"화살표에는
 *  왜 복제 메뉴가 안 뜨나?"* 로 합류 — 처음에 뺀 근거가 원리 아니라 지시문의 열거였다).
 *  필드가 아니라 `ids` 에서 계산한다 — '빼기냐 삭제냐' 와 같은 규율이다(값과 이름을 둘 다
 *  실으면 어긋날 수 있다).
 *
 *  칩·공·콘이 빠지는 이유: 정원이 cast(트레이 상자)에 있어 "하나 더" 는 배치가 아니라 **정의
 *  추가**다 — 같은 말로 다른 조작을 묶으면 무엇이 늘어나는지 누르기 전에 알 수 없다. 손으로
 *  그린 셋(도형·메모·화살표)은 전부 스텝 배열이라 그 문제가 없다. 섞인 무리(칩 포함)에서는
 *  통째로 안 낸다 — 항목이 있는데 절반에만 먹는 것보다 없는 편이 정직하다. */
// export 인 이유(2026-08-18): Ctrl/⌘+D 의 1·2층 갈림(useEditorKeyboard)이 같은 판정을
// 써야 "메뉴에는 뜨는데 키는 스텝을 복제하는" 어긋남이 없다.
export const canDuplicate = (ids: readonly string[]): boolean =>
  ids.every((id) => isId(id, 'sh') || isId(id, 'nt') || isId(id, 'ar'));

/** 여럿일 때만 개수를 낸다 — 하나짜리에 *"1개 잠금"* 은 셀 것이 없는데 세는 말이다.
 *  마지막 항목(빼기/삭제)만은 `removalLabel` 이 따로 만든다: 거기서는 개수가 두 갈래로
 *  갈릴 수 있어(빼기 2 · 삭제 1) 이 함수로는 모자라기 때문이다. */
function countedLabel(ids: readonly string[], singularKey: DictKey, countKey: DictKey, t: ReturnType<typeof useT>): string {
  return ids.length > 1 ? t(countKey, { n: ids.length }) : t(singularKey);
}

export interface ObjectMenuTarget {
  /** 메뉴가 **손댈 개체들**(§6.10b). 대개 하나지만, 짚은 것이 이미 고른 여럿 중 하나면 그
   *  여럿 전부다.
   *
   *  개편 전에는 `id: string` 하나였고, 그래서 터치에서 여럿을 골라 봐야 **할 수 있는 일이
   *  하나도 없었다** — 다중 선택에 걸리는 조작이 지우기 단축키 하나뿐인데 손가락에는 키가
   *  없기 때문이다. 이 필드가 그 막다른 길을 연다. */
  ids: string[];
  /** 화면 좌표(clientX/Y). 메뉴가 뜰 자리다. */
  x: number;
  y: number;
  /** **전부** 잠겨 있는가 — 메뉴 글자가 '잠금'/'잠금 해제' 로 갈린다. 섞여 있으면 false 라
   *  '잠금' 이 뜨고, 누르면 전부 잠긴다: 반쯤 잠긴 무리를 한 번에 가지런히 하는 쪽이
   *  "어떤 건 잠기고 어떤 건 풀리는" 결과보다 예측된다. */
  locked: boolean;
  /** 전부 무시 중인가. `canIgnore` 가 false 면 안 쓴다. */
  ignored: boolean;
  /** '무시' 항목을 낼 것인가 — **전부 휠체어일 때만** true 다(기현 지시). 섞였으면 안 낸다:
   *  항목이 있는데 절반에만 먹는 것보다 없는 편이 정직하다(아래 같은 규율). */
  canIgnore: boolean;
  // ⚠️ '빼기냐 삭제냐' 는 **필드가 아니다** — `ids` 에서 계산한다(2026-08-16). 값과 이름을
  //    둘 다 실어 보내면 둘이 어긋날 수 있고, 실제로 어긋났다: 명단은 칩인데 플래그는 '삭제'
  //    인 대상이 만들어져 아이콘과 글자가 서로 다른 말을 했다. 판정은 `removal.ts` 하나다
  //    (근거 — 다시 꺼낼 자리가 있는가 — 도 거기 적혀 있다). 여럿이면 **전부** 트레이로
  //    돌아가는가가 아이콘을 정하고, 섞인 경우의 말은 `removalLabel` 이 만든다.
  /** [수정] 을 낼 대상의 id — 지금은 **메모 하나일 때만** 이다(기현 지시 2026-08-17).
   *  낼 것이 없으면 `null`.
   *
   *  왜 메모뿐인가: '수정' 이 열 것이 있는 개체가 메모밖에 없다. 다른 개체의 속성(팀 색·등번호·
   *  화살표 머리)은 저마다 다른 화면에서 손대고, 메뉴 항목 하나에 그 전부를 묶으면 "무엇이
   *  열릴지" 를 누르기 전에 알 수 없다. 여럿을 골랐을 때 안 내는 이유는 `selectSame` 과 같다 —
   *  다섯 개의 글을 한 칸에 넣을 방법이 없다. */
  editable: string | null;
  /** "같은 것 전부 고르기" 항목(§6.10b). 낼 것이 없으면 `null`.
   *  **하나짜리 메뉴에서만** 뜬다 — 이미 여럿을 골라 둔 사람에게 '같은 종류' 가 무엇인지
   *  되묻지 않기 위해서다(짚은 것 기준인지 고른 것들 기준인지 답이 하나로 안 나온다). */
  selectSame: { label: string; ids: string[] } | null;
}

export interface ObjectMenuProps {
  target: ObjectMenuTarget | null;
  onClose(): void;
  onToggleLock(ids: string[], next: boolean): void;
  onToggleIgnore(ids: string[], next: boolean): void;
  /** 개체를 판에서 뺀다. 실제 액션은 개체 종류에 따라 다르고(EditorStage 의 분기), 그
   *  차이가 사용자에게 보이는 자리가 `removal.ts` 다 — 거기 주석이 근거를 쥔다. */
  onRemove(ids: string[]): void;
  /** "같은 것 전부 고르기". `target.selectSame` 이 null 이면 호출되지 않는다. */
  onSelect(ids: string[]): void;
  /** 메모 글 고치기. `target.editable` 이 null 이면 호출되지 않는다. */
  onEdit(id: string): void;
  /** 도형·메모 복제(2026-08-18). 사본을 어디 놓는가는 부르는 쪽(EditorStage) 소관이다 —
   *  메뉴는 좌표계를 모른다. `canDuplicate` 가 거짓이면 호출되지 않는다. */
  onDuplicate(ids: string[]): void;
  /** [미세 조정] — 떠 있는 반투명 패드(`NudgePad`)를 연다. 메뉴는 그 패드를 그리지 않는다:
   *  **여러 번 눌러 맞추는 조작**이라 한 번 누르면 닫히는 메뉴 안에 있을 수 없고, 무엇보다
   *  불투명한 메뉴가 정작 움직이는 개체를 가린다(NudgePad 머리말에 근거).
   *  `canNudge` 가 거짓이거나 잠겨 있으면 칸을 안 내므로 호출되지 않는다. */
  onFineTune(ids: string[]): void;
}

const ITEM: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  minHeight: 'var(--hit)',
  padding: '0 12px',
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  fontSize: '0.8125rem',
  fontWeight: 600,
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

export function ObjectMenu({ target, onClose, onToggleLock, onToggleIgnore, onRemove, onSelect, onEdit, onDuplicate, onFineTune }: ObjectMenuProps) {
  const t = useT();
  const locale = useLocale();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // 열면 첫 항목에 선다 — 키보드로 연 사람(Shift+F10·메뉴 키)이 곧바로 고를 수 있어야 한다.
  useEffect(() => {
    if (target) firstRef.current?.focus({ preventScroll: true });
  }, [target]);

  // 자리 계산은 **페인트 전**이라야 한다. useEffect 로 미루면 한 프레임 동안 잘린 자리에
  // 그려졌다가 튄다 — 메뉴가 뜨자마자 움직이면 그리로 향하던 조준이 통째로 빗나간다.
  useLayoutEffect(() => {
    if (!target) {
      setPos(null);
      return;
    }
    const el = panelRef.current;
    const w = el?.offsetWidth ?? 180;
    const h = el?.offsetHeight ?? 140;
    const pad = 8;
    const left = target.x + w + pad > window.innerWidth ? Math.max(pad, target.x - w) : target.x;
    const top = target.y + h + pad > window.innerHeight ? Math.max(pad, target.y - h) : target.y;
    setPos({ left, top });
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    // 캡처로 잡는다 — 판의 전역 Esc(선택 해제)보다 **먼저** 와야 메뉴만 닫힌다
    // ([보기] 팝오버가 인스펙터보다 먼저 닫히는 것과 같은 등록 단계 규율이다).
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [target, onClose]);

  if (!target) return null;

  const dup = canDuplicate(target.ids);
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return createPortal(
    <>
      {/* 바깥을 덮는 판 — 클릭 한 번으로 닫힌다. 투명이지만 **포인터를 받는다**:
          안 두면 메뉴를 닫으려던 탭이 코트에 닿아 개체를 하나 더 놓는다. */}
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
        role="menu"
        aria-label={t('editor.objectMenu.ariaLabel')}
        style={{
          position: 'fixed',
          left: pos?.left ?? target.x,
          top: pos?.top ?? target.y,
          zIndex: 61,
          // 가장 긴 글자가 '잠금 해제' 다 — 아이콘·여백까지 담고도 남는 폭이면 충분하다.
          // 168 은 과했다(기현 2026-08-15). 메뉴는 코트 위에 뜨므로 넓을수록 판을 더 가린다.
          minWidth: 128,
          padding: '6px 0',
          borderRadius: 12,
          border: '1px solid var(--border-strong)',
          background: 'var(--panel)',
          boxShadow: '0 12px 28px rgba(0,0,0,.5)',
          // 자리를 아직 못 쟀으면 그리지 않는다(위 useLayoutEffect 의 첫 통과).
          visibility: pos ? 'visible' : 'hidden',
        }}
      >
        {/* [미세 조정] — 떠 있는 반투명 패드를 연다(2026-09-02 기현 지시로 메뉴 안의 3×3 판을
            이것으로 대체). **맨 위**인 이유는 예전 판과 같다: 맨 아래 [빼기]/[삭제] 바로 위에
            두면 자주 누르는 항목이 그 옆에 붙는다.
            ⚠️ 열자마자 서는 포커스(`firstRef`)는 여기로 **안 온다.** 키보드로 온 사람에게는
               방향키·QE 가 이미 있어 이 칸이 필요 없다(NudgePad 머리말의 그 근거). */}
        {!target.locked && canNudge(target.ids) && (
          <>
            <button type="button" role="menuitem" onClick={act(() => onFineTune(target.ids))} style={ITEM}>
              <span aria-hidden style={{ width: '1.125rem', textAlign: 'center', opacity: 0.7 }}>
                ✥
              </span>
              {t('editor.objectMenu.fineTune')}
            </button>
            <div aria-hidden style={{ height: 1, margin: '5px 10px', background: 'var(--border)' }} />
          </>
        )}

        {/* 고르기가 **맨 위**다. 아래 셋은 판을 바꾸는 조작이고 이것 하나만 아니다 — 다른
            등급의 항목을 아래 뭉치에 섞으면 실수로 누를 때 값이 다르다. 열자마자 포커스가
            여기 서는 것도 그래서 맞다(되돌릴 것이 없는 항목). */}
        {target.selectSame && (
          <>
            <button type="button" role="menuitem" ref={firstRef} onClick={act(() => onSelect(target.selectSame!.ids))} style={ITEM}>
              <span aria-hidden style={{ width: '1.125rem', textAlign: 'center', opacity: 0.7 }}>
                ⊞
              </span>
              {target.selectSame.label}
            </button>
            <div aria-hidden style={{ height: 1, margin: '5px 10px', background: 'var(--border)' }} />
          </>
        )}

        {/* [수정] — 지금은 메모 전용이다(기현 지시 2026-08-17). 판을 바꾸는 항목이라 고르기와
            갈라 아래 뭉치의 **맨 위**에 둔다. 잠긴 메모에서도 낸다: 잠김은 §6.10 에서 "이동만
            막힌 상태" 라 글까지 얼리면 없던 뜻이 하나 붙는다(그리고 푸는 문이 또 하나 좁아진다). */}
        {target.editable && (
          <button
            type="button"
            role="menuitem"
            ref={target.selectSame ? undefined : firstRef}
            onClick={act(() => onEdit(target.editable!))}
            style={ITEM}
          >
            <span aria-hidden style={{ width: '1.125rem', textAlign: 'center', opacity: 0.7 }}>
              ✎
            </span>
            {t('editor.objectMenu.edit')}
          </button>
        )}

        {/* [복제] — 도형·메모만(canDuplicate 주석). [수정]과 같은 "판을 바꾸는" 뭉치라 그 바로
            아래, 잠금 위다: 잠금·무시는 상태 스위치고 이 둘은 내용 조작이라 결이 다르다. */}
        {dup && (
          <button
            type="button"
            role="menuitem"
            ref={target.selectSame || target.editable ? undefined : firstRef}
            onClick={act(() => onDuplicate(target.ids))}
            style={ITEM}
          >
            <span aria-hidden style={{ width: '1.125rem', textAlign: 'center', opacity: 0.7 }}>
              ⧉
            </span>
            {countedLabel(target.ids, 'editor.objectMenu.duplicate', 'editor.objectMenu.duplicateCount', t)}
          </button>
        )}

        <button
          type="button"
          role="menuitem"
          // 위의 항목들이 **전부** 없을 때만 여기가 첫 칸이다 — ref 를 여럿에 달면 나중 것이 이긴다.
          ref={target.selectSame || target.editable || dup ? undefined : firstRef}
          onClick={act(() => onToggleLock(target.ids, !target.locked))}
          style={ITEM}
        >
          <span aria-hidden style={{ width: '1.125rem', textAlign: 'center', color: LOCK_TINT_COLOR }}>
            {target.locked ? '○' : '●'}
          </span>
          {target.locked
            ? countedLabel(target.ids, 'editor.objectMenu.unlock', 'editor.objectMenu.unlockCount', t)
            : countedLabel(target.ids, 'editor.objectMenu.lock', 'editor.objectMenu.lockCount', t)}
        </button>

        {/* 무시는 **휠체어만**이다(기현 지시). 다른 개체에서 이 자리를 비워 두지 않고 **아예
            안 내는** 이유: 항목이 있는데 눌러도 아무 일이 없는 것보다, 없는 편이 정직하다. */}
        {target.canIgnore && (
          <button type="button" role="menuitem" onClick={act(() => onToggleIgnore(target.ids, !target.ignored))} style={ITEM}>
            <span aria-hidden style={{ width: '1.125rem', textAlign: 'center', opacity: 0.5 }}>
              {target.ignored ? '◍' : '◌'}
            </span>
            {target.ignored
              ? countedLabel(target.ids, 'editor.objectMenu.unignore', 'editor.objectMenu.unignoreCount', t)
              : countedLabel(target.ids, 'editor.objectMenu.ignore', 'editor.objectMenu.ignoreCount', t)}
          </button>
        )}

        <div aria-hidden style={{ height: 1, margin: '5px 10px', background: 'var(--border)' }} />

        {/* 이 항목만 붉다 — **판 위의 것을 사라지게 하는 유일한 항목**이라 잠금·무시와 한
            덩어리로 읽히면 안 된다(같은 보라를 쓰면 세 항목이 한 뭉치가 되어 실수로 누르기
            쉬워진다). 2026-08-16 정정: 예전 근거는 *"되돌릴 수 없는 항목"* 이었는데 다시
            꺼낼 수 있는 개체에는 거짓이다. 색이 필요한 진짜 이유는 비가역성이 아니라
            **판에서 사라진다는 사실 자체**다 — 그래서 빼기·삭제 **둘 다** 붉다(기현 결정).
            (#d93a3a 는 빨강 팀 칩과 같은 값이다 — 여기는 메뉴 글자라 코트 위 개체와 섞이지 않는다.)

            말과 아이콘은 갈린다: `←` 빼기는 '판 밖으로 물린다', `✕` 삭제는 '없앤다'.
            어느 쪽이 참인지는 `returnsToTray` 가 정한다(그 필드 주석에 근거). */}
        <button type="button" role="menuitem" onClick={act(() => onRemove(target.ids))} style={{ ...ITEM, color: '#ff6b6b' }}>
          <span aria-hidden style={{ width: '1.125rem', textAlign: 'center' }}>
            {target.ids.every(returnsToTray) ? '←' : '✕'}
          </span>
          {removalLabel(target.ids, locale)}
        </button>
      </div>
    </>,
    document.body,
  );
}
