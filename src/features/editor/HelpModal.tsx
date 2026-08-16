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
import { helpRows, toolHelpRows } from '../../core/keymap.ts';
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
  [
    '놓기',
    '트레이의 선수·공·콘을 코트로 끌어다 놓습니다. 도구를 고른 뒤 코트를 탭해도 됩니다. 하나 놓으면 선택 도구로 돌아가고 방금 놓은 것이 선택되어 있어 바로 자리를 고칠 수 있습니다.',
  ],
  [
    '여러 개 놓기',
    '같은 도구를 한 번 더 누르면 고정되어 연속으로 놓입니다. 도구 칸에 핀 표시가 켜지고, 놓기가 아닌 다른 동작을 하면 바로 풀립니다.',
  ],
  ['옮기기', '휠체어는 잡는 곳이 곧 동작입니다 — 뒤 절반을 잡으면 그대로 이동, 앞 절반은 제자리 회전, 차체 밖 앞뒤 손잡이는 줄로 끄는 견인입니다.'],
  ['선택·해제', '선택 도구는 조금 빗나가게 눌러도 가장 가까운 개체가 잡히고, 선택된 개체를 그 자리에서 다시 탭하거나 Esc 를 누르면 풀립니다.'],
];

/** 전역 키맵에 없는 줄 — **컴포넌트 자기 것**이거나 아예 키가 아니다. 표를 읽는 이유는
 *  "무엇을 할 수 있는가" 이므로 같은 자리에 둔다: 휠 줌은 버튼에도 단축키에도 안 보여
 *  아는 사람만 아는 기능이 되기 쉽고, 배치 커서·스텝 사진은 그 요소에 포커스가 있을 때만
 *  사는 지역 키라 전역 표에 넣으면 "아무 때나 눌러도 된다" 로 읽힌다. */
function extraRows(steps: boolean): ReadonlyArray<[string, string]> {
  return [
    ['코트 위에서 마우스 휠', '커서 자리를 붙든 채 확대 / 축소'],
    ['방향키(배치 도구·코트 포커스)', '격자 커서 이동, Enter 로 배치'],
    // §4.4 P2-3 스텝 사진 재배열(TransportBar). 전술판에는 스텝 자체가 없다.
    ...(steps
      ? ([['Space (스텝 사진)', '스텝 집기/놓기 — ←/→ 로 자리를 옮기고 Esc 로 되돌림']] as [string, string][])
      : []),
  ];
}

export function HelpModal({ open, onClose, returnFocusRef, mode = 'drill' }: HelpModalProps) {
  // 2026-08-16 — 이 목록은 **손으로 적지 않는다**. `core/keymap.ts` 가 정본이고 여기는
  // 그 표를 읽는다. 개편 전에는 배선과 따로 적혀 있어서, 전술판에서 죽어 있는 스텝 키 넷이
  // 표에는 살아 있는 것처럼 적히는 사고가 났다(이 파일 머리말의 그 사고).
  const steps = mode === 'drill';
  const rows: ReadonlyArray<[string, string]> = [
    ...helpRows('global', { steps }),
    ...helpRows('object', { steps }),
    ...extraRows(steps),
  ].map((r) =>
    // 전술판의 Ctrl/⌘+S 는 드릴 자동저장이 아니라 **스냅샷을 지금 저장**이다
    // (BoardScreen.saveNow). 같은 키에 다른 일이면 표도 다르게 적는다.
    !steps && r[0] === 'Ctrl/⌘+S' ? (['Ctrl/⌘+S', '지금 판 저장'] as [string, string]) : r,
  );
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
      {/* 도구는 **자기 구역**이다(2026-08-16 기현 지시로 아홉 줄이 됐다 — keymap 의 toolHelpRows).
          한 줄로 접어 두면 "콘이 어느 글자인가" 에 답을 안 하고, 아래 표에 섞으면 표가 도구
          목록으로 읽힌다. 소제목으로 가르면 둘 다 안 생긴다. */}
      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '1rem 0 0.5rem' }}>도구</h3>
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 10, columnGap: 16, fontSize: '0.8125rem' }}>
        {toolHelpRows().map(([key, desc]) => (
          <Fragment key={key}>
            <dt style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: 'var(--accent-text)', whiteSpace: 'nowrap' }}>{key}</dt>
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
