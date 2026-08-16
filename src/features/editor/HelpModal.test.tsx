// 3.9 [E-4] — 도움말 **내용**의 계약. 완료 판정의 배선(버튼·포커스 복귀)은
// EditorWorkspace.help.test.tsx 가 실조립으로 보고, 여기서는 두 가지를 못박는다:
//   1) 첫 섹션은 단축키가 아니라 **놓기·옮기기 3줄**이다 — 실사용자가 앱을 닫는 이유는
//      단축키를 몰라서가 아니라 칩을 어떻게 놓는지 몰라서다.
//   2) 문구가 **현행 코드와 같은 말을 한다** — 틀린 도움말은 없느니만 못하다. 문구가 참조하는
//      경계값(DEFAULT_ZONES)을 함께 단언해, 코드가 움직이면 이 파일이 먼저 빨간불이 된다.
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { HelpModal } from './HelpModal.tsx';
import { DEFAULT_ZONES } from '../../core/constants.ts';

function openHelp() {
  render(<HelpModal open={true} onClose={() => {}} />);
  return screen.getByRole('dialog', { name: '도움말' });
}

describe('3.9 첫 섹션 — 어떻게 놓는가 / 어떻게 옮기는가', () => {
  it('첫 <dl> 이 놓기·옮기기·선택/해제 3줄이다 — 단축키 표가 아니다', () => {
    const dialog = openHelp();
    const firstDl = dialog.querySelector('dl')!;
    const dts = [...firstDl.querySelectorAll('dt')].map((d) => d.textContent);
    // 정확 일치 — 순서까지. 단축키 표가 첫 자리로 오면 첫 dt 가 'V L O …' 이 되어 여기서 깨진다.
    expect(dts).toEqual(['놓기', '옮기기', '선택·해제']);
  });

  it('단축키 표는 그 **뒤에** 그대로 있다 — 첫 섹션이 단축키를 밀어냈을 뿐 지운 게 아니다', () => {
    const dialog = openHelp();
    const heading = within(dialog).getByRole('heading', { name: '키보드 단축키' });
    const firstDl = dialog.querySelector('dl')!;
    // compareDocumentPosition: FOLLOWING(4) = heading 이 첫 dl 보다 뒤다.
    expect(firstDl.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('도구는 **어느 키가 무엇인지**를 적는다 — 글자마다 한 줄 (2026-08-16 기현 지시)', () => {
    // 옛 계약: *"도구 9종은 한 줄로 접힌다"* — `V L O T R B C P N` 한 줄에 설명은 '도구 선택'.
    // 짧았지만 질문에 답을 안 했다: 콘이 어느 글자인지 알려면 아홉 개를 세어 짝지어야 했다.
    const dialog = openHelp();
    expect(within(dialog).queryByText('V L O T R B C P N'), '아직 접혀 있다').toBeNull();

    // 짝이 **같은 줄**에 있어야 한다 — 세어서 맞추게 하면 접어 둔 것과 다를 바 없다.
    for (const [key, tool] of [
      ['V', '선택 도구'],
      ['C', '콘 도구'],
      ['N', '메모 도구'],
    ] as const) {
      const dt = within(dialog).getByText(key);
      expect(dt.nextElementSibling?.textContent, `${key} 옆에 ${tool} 가 없다`).toBe(tool);
    }
    // 도구는 일반 단축키 표와 **다른 구역**이다 — 섞으면 표가 도구 목록으로 읽힌다.
    expect(within(dialog).getByRole('heading', { name: '도구' })).toBeInTheDocument();
  });

  it('4존 운동학이 **한 문장**이다 — 뒤 절반 이동 · 앞 절반 제자리 회전 · 차체 밖 견인', () => {
    const dialog = openHelp();
    const line = within(dialog).getByText(/뒤 절반/).textContent!;
    for (const word of ['뒤 절반', '그대로 이동', '앞 절반', '제자리 회전', '차체 밖', '견인']) {
      expect(line, word).toContain(word);
    }
    // "한 문장으로" 가 명세다(§7 3.9) — 마침표가 하나면 문장도 하나다.
    expect(line.match(/\./g), '한 문장이어야 한다').toHaveLength(1);
  });

  it('그 문장의 출처가 아직 사실이다 — DEFAULT_ZONES 가 반반 + 차체 밖 견인', () => {
    // 도움말은 코드를 못 본다. 이 단언이 둘을 묶는다: 경계를 다시 옮기면(반반이 아니게 되면)
    // 여기가 깨지고, 고치는 사람은 HelpModal 의 '뒤 절반/앞 절반' 문구도 함께 고쳐야 한다.
    expect(DEFAULT_ZONES.sSpinMin).toBe(1 / 2);
    expect(DEFAULT_ZONES.sTowRearMax).toBe(0); // 차체 안 견인 없음 — 견인은 차체 밖 가이드뿐
    expect(DEFAULT_ZONES.sTowFrontMin).toBe(1);
  });
});

describe('3.9 단축키 표 현행화 — 1차·2차에서 들어간 조작이 다 적혀 있다', () => {
  it.each([
    ['Ctrl/⌘+방향키', '판 이동(팬)'], // §4.4 P2-1
    ['Space (스텝 사진)', '스텝 집기/놓기 — ←/→ 로 자리를 옮기고 Esc 로 되돌림'], // §4.4 P2-3
    ['방향키(배치 도구·코트 포커스)', '격자 커서 이동, Enter 로 배치'], // §7.5d
    ['Esc', '선택 해제 — 열린 창이 있으면 그 창만 닫힘'], // [A-3]
    ['Shift+?', '이 도움말'],
  ])('%s → %s', (key, desc) => {
    const dialog = openHelp();
    const dt = within(dialog).getByText(key);
    expect(dt.nextElementSibling?.textContent).toBe(desc);
  });

  it('개편으로 사라진 키가 표에 남아 있지 않다 (대조군)', () => {
    // 2026-08-16 전면 개편. 위 it 들은 "새 줄이 있다" 만 보므로, 옛 줄이 나란히 남아 있어도
    // 통과한다 — 이 대조군이 그 절반을 막는다. **없는 키를 적어두면 코치는 자기가 잘못
    // 눌렀다고 생각한다**(이 파일 머리말의 그 사고와 같은 부류).
    const dialog = openHelp();
    for (const gone of ['1–8 / V R P B C A T E', 'G / Z', 'Alt+←/→', 'Shift+방향키(화살표)', '[ / ] (화살표)']) {
      expect(within(dialog).queryByText(gone), `${gone} 가 아직 표에 있다`).toBeNull();
    }
    // 숫자키로 도구를 여는 줄이 통째로 없다.
    expect(dialog.textContent).not.toMatch(/1–8|1-8/);
  });

  it('낡은 문구는 지워졌다 — Esc 는 이제 "포커스 복귀" 가 아니라 선택 해제다(대조군)', () => {
    // 틀린 도움말을 고쳤다는 단언. 위 it 들은 "새 줄이 있다" 만 보므로, 옛 줄이 나란히
    // 남아 있어도 통과한다 — 이 대조군이 그 절반을 막는다.
    const dialog = openHelp();
    expect(within(dialog).queryByText(/코트로 포커스 복귀/)).toBeNull();
    // 옛 'Alt+Delete' 행 — 전역에는 그런 단축키가 없다(개체 포커스 Delete + Alt 는 범위 수식).
    expect(within(dialog).queryByText('Alt+Delete')).toBeNull();
  });
});
