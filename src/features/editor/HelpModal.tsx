// §7.5f "Shift+? 도움말 오버레이(role=dialog, 포커스 트랩, Esc)" — ui-kit 의 Modal 을 그대로 쓴다.
//
// 3.9 [E-4] — 첫 섹션은 단축키가 아니라 **놓기·옮기기**다. 실사용자가 앱을 닫는 이유는
// 단축키를 몰라서가 아니라 칩을 어떻게 놓는지 몰라서였다("선수 배치·이동을 못 하겠다",
// useTrayDrag.ts 머리 주석의 그 피드백). 단축키 표는 그 다음이다.
//
// ⚠️ 여기 적힌 문장은 전부 **현행 코드가 출처다** — 틀린 도움말은 없느니만 못하다.
//   놓기      → useTrayDrag.ts(끌어다 놓기, 탭 폴백)
//   옮기기    → core/constants.ts DEFAULT_ZONES(뒤 절반 translate · 앞 절반 spin ·
//               차체 밖 towRear/towFront 는 ZoneHandles 의 앞뒤 가이드)
//   선택·해제 → physics/hitTest.ts forgivingRadius(2단 히트, 선택 도구 한정 44/56 CSS px)
//               + useEditorPointer.ts tapDeselectRef(재탭 해제) + useEditorKeyboard.ts(Esc)
// 동작을 바꿨으면 이 문구도 함께 고쳐라 — 그 대조가 이 파일 테스트의 존재 이유다.
import { Fragment } from 'react';
import type { RefObject } from 'react';
import { Modal } from '../../ui/Modal.tsx';

export interface HelpModalProps {
  open: boolean;
  onClose(): void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** 어느 화면의 도움말인가(2026-08-15 보드 단축키 정리).
   *
   *  ⚠️ **틀린 도움말은 없느니만 못하다**(이 파일 머리말). 전술판은 스텝이 없는 1장짜리라
   *  스텝 관련 키 넷이 **눌러도 아무 일도 안 난다** — 그런데 표에는 넷 다 적혀 있었다.
   *  코치는 키가 고장난 줄 알거나 자기가 잘못 눌렀다고 생각한다. 그래서 표를 화면마다 가른다. */
  mode?: 'board' | 'drill';
}

/** 첫 섹션 3줄 — "어떻게 놓는가 / 어떻게 옮기는가". 4존 운동학은 **한 문장**이다(§7 3.9). */
const BASICS: ReadonlyArray<[string, string]> = [
  ['놓기', '트레이의 선수·공·콘을 코트로 끌어다 놓습니다. 도구를 고른 뒤 코트를 탭해도 됩니다.'],
  ['옮기기', '휠체어는 잡는 곳이 곧 동작입니다 — 뒤 절반을 잡으면 그대로 이동, 앞 절반은 제자리 회전, 차체 밖 앞뒤 손잡이는 줄로 끄는 견인입니다.'],
  ['선택·해제', '선택 도구는 조금 빗나가게 눌러도 가장 가까운 개체가 잡히고, 선택된 개체를 그 자리에서 다시 탭하거나 Esc 를 누르면 풀립니다.'],
];

/** 스텝(시간축)이 있어야 뜻이 있는 키. **전술판에서는 전부 무동작이다** — 그쪽은 1장짜리라
 *  다음 스텝도, 복제할 스텝도, 재생할 구간도 없다(useStepPlayback 은 steps<2 면 즉시 멈춘다).
 *  지어낸 목록이 아니라 실제로 죽어 있는 배선을 그대로 적은 것이다:
 *    · Ctrl/⌘+D → EditorWorkspace 가 전술판에서 `() => {}` 를 넘긴다
 *    · ←/→      → `gotoStep` 이 다음 스텝을 못 찾아 dispatch 자체를 안 한다
 *    · Space    → `useStepPlayback` 이 steps.length < 2 에서 곧바로 pause() 한다 */
const STEP_SHORTCUTS: ReadonlyArray<[string, string]> = [
  ['Ctrl/⌘+D', '현재 스텝 복제'],
  ['← →', '이전/다음 스텝(개체 미선택 시)'],
  ['Space', '재생 / 일시정지'],
  ['Space (스텝 사진)', '스텝 집기/놓기 — ←/→ 로 자리를 옮기고 Esc 로 되돌림'],
];

const SHORTCUTS: ReadonlyArray<[string, string]> = [
  ['1–8 / V R P B C A T E', '도구 선택 — 지우개(E·8)만 항상 Alt 필요'],
  ['Ctrl/⌘+Z, Shift+Z', '실행 취소 / 다시 실행(Ctrl+Y)'],
  ['Ctrl/⌘+S', '저장'],
  ['G / Z', '격자 / 골 지역 가이드 토글'],
  ['Ctrl/⌘ +, −, 0', '스테이지 줌 인 / 아웃 / 초기화'],
  // 키가 아니지만 같은 표에 둔다 — 이 표를 읽는 이유는 "무엇을 할 수 있는가" 이고,
  // 휠 줌은 버튼에도 단축키에도 안 보여 아는 사람만 아는 기능이 되기 쉽다.
  ['코트 위에서 마우스 휠', '커서 자리를 붙든 채 확대 / 축소'],
  ['Ctrl/⌘+방향키', '판 이동(팬)'],
  ['방향키(개체 포커스)', '2.5px 이동, Shift = 25px'],
  ['[ / ]', '휠체어 5° 회전, Shift = 15°'],
  ['방향키(화살표)', '화살표 전체를 2.5px 이동'],
  ['Shift+방향키(화살표)', '조준점만 2.5px 이동(기본 = 끝점)'],
  ['[ / ] (화살표)', '조준점 전환 — 끝점 · 시작점 · 굽힘점'],
  ['방향키(배치 도구·코트 포커스)', '격자 커서 이동, Enter 로 배치'],
  ['Delete(개체 포커스)', '그 개체 삭제 — Alt = 이 스텝에서만'],
  ['Ctrl/⌘+Delete', '선택 삭제 — Alt = 이 스텝에서만'],
  ['Alt+←/→', '개체 순회'],
  ['Esc', '선택 해제 — 열린 창이 있으면 그 창만 닫힘'],
  ['Shift+?', '이 도움말'],
];

export function HelpModal({ open, onClose, returnFocusRef, mode = 'drill' }: HelpModalProps) {
  // 스텝 키는 **도구 키 바로 다음**에 끼운다(옛 자리 그대로) — 표를 읽는 사람이 옛 위치를
  // 기억하고 있을 수 있고, 전술판에서는 그 자리가 통째로 비는 것이 곧 "여기엔 없다" 는 말이다.
  const rows: ReadonlyArray<[string, string]> =
    mode === 'drill'
      ? [...SHORTCUTS.slice(0, 3), ...STEP_SHORTCUTS, ...SHORTCUTS.slice(3)]
      : // 전술판의 Ctrl/⌘+S 는 드릴 자동저장이 아니라 **스냅샷을 지금 저장**이다
        // (BoardScreen.saveNow). 같은 키에 다른 일이면 표도 다르게 적는다.
        SHORTCUTS.map((r) => (r[0] === 'Ctrl/⌘+S' ? (['Ctrl/⌘+S', '지금 판 저장'] as [string, string]) : r));
  return (
    <Modal open={open} onClose={onClose} titleId="editor-help-title" title="도움말" returnFocusRef={returnFocusRef}>
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 10, columnGap: 16, fontSize: '0.8125rem' }}>
        {BASICS.map(([key, desc]) => (
          <Fragment key={key}>
            <dt style={{ fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>{key}</dt>
            <dd style={{ color: 'var(--muted)' }}>{desc}</dd>
          </Fragment>
        ))}
      </dl>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '1rem 0 0.5rem' }}>키보드 단축키</h3>
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 10, columnGap: 16, fontSize: '0.8125rem' }}>
        {rows.map(([key, desc]) => (
          <Fragment key={key}>
            <dt style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--accent-text)', whiteSpace: 'nowrap' }}>{key}</dt>
            <dd style={{ color: 'var(--muted)' }}>{desc}</dd>
          </Fragment>
        ))}
      </dl>
    </Modal>
  );
}
