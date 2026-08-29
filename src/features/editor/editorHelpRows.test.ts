// 3.9 [E-4] — 도움말 **내용**의 계약. 2026-08-20(§0.5 Phase 5) 이전에는 `HelpModal.tsx` 를
// 렌더해 DOM 으로 이 계약을 쟀다 — 그 컴포넌트가 은퇴하며(HelpCenter 로 일원화) 표를 만드는
// 함수(editorHelpRows.ts) 자체를 직접 부르는 쪽으로 옮겼다. 렌더가 빠져 더 빠르고, 마크업이
// 바뀌어도(HelpCenter 가 이 표를 어떻게 그리든) 안 깨진다 — 정본은 늘 이 함수들이었다.
//
// 못박는 것은 여전히 둘이다:
//   1) 첫 줄들은 단축키가 아니라 **놓기·옮기기 8줄**이다 — 실사용자가 앱을 닫는 이유는
//      단축키를 몰라서가 아니라 칩을 어떻게 놓는지 몰라서다.
//   2) 문구가 **현행 코드와 같은 말을 한다** — 틀린 도움말은 없느니만 못하다. 문구가 참조하는
//      경계값(DEFAULT_ZONES)을 함께 단언해, 코드가 움직이면 이 파일이 먼저 빨간불이 된다.
import { describe, expect, it } from 'vitest';
import { translate } from '../../i18n/useT.ts';
import { DEFAULT_ZONES } from '../../core/constants.ts';
import { editorBasicsRows, editorShortcutRows, editorToolRows } from './editorHelpRows.ts';

const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate('ko', key, params);

describe('3.9 첫 섹션 — 어떻게 놓는가 / 어떻게 옮기는가', () => {
  it('놓기·옮기기·선택/해제 9줄이 이 순서다 — 단축키 표가 아니다', () => {
    // 2026-08-16 §6.10a — '여러 개 놓기' 가 둘째 줄로 들어왔다. 도구 고정은 "같은 것을 한 번
    // 더" 라 눌러 보기 전에는 알 수 없는 조작이라, 단축키 표가 아니라 **여기** 있어야 한다.
    // 2026-08-16 §6.10b — 뒤에 둘이 더 붙었다. '여러 개 고르기'/'여럿 옮기기' 는 선택 쪽
    // 조작이라 '선택·해제' 뒤에 선다: 먼저 하나를 고를 줄 알아야 여럿이 말이 된다.
    // 2026-08-16 §6.10c — '치우기' 가 맨 끝에 붙었다. 트레이로 끌어다 놓는 손짓은 **화면
    // 어디에도 안 적혀 있고** 단축키도 아니라, 첫 섹션이 아니면 알 길이 없는 조작이다.
    // 2026-08-17 — '메모 쓰기' 가 '치우기' 앞에 붙었다. 글 칸을 여는 손짓 셋(놓자마자 열림·
    // 더블클릭·긴 누름 메뉴) 중 **화면에 적힌 것이 하나도 없어서**, 여기가 아니면 알 길이 없다.
    const terms = editorBasicsRows(t).map(([term]) => term);
    // 2026-08-29 — '미세 조정' 이 '여럿 옮기기' 뒤에 붙었다. 옮기기 세 줄이 굵은 것에서 가는
    // 것 순으로 이어진다(잡아 끌기 → 여럿 → 마지막 몇 px). '옮기기' 에 이어 붙이지 못한
    // 이유는 아래 '한 문장' 계약이다 — 4존 운동학은 한 문장이어야 한다.
    expect(terms).toEqual(['놓기', '여러 개 놓기', '옮기기', '선택·해제', '여러 개 고르기', '여럿 옮기기', '미세 조정', '메모 쓰기', '치우기']);
  });

  // ★ 2026-08-16 — `Delete` 는 전역과 개체 **두 층**에 같은 id 로 서 있다(기현 지시: 하나든
  //   여럿이든 Delete). 표는 층을 모르므로 그대로 두면 같은 키가 두 줄이 되고, 읽는 사람은
  //   둘이 다른 일을 한다고 읽는다. `editorHelpRows.ts` 의 dedupe 가 접는 것이 이 계약이다.
  it('같은 키가 두 줄로 나오지 않는다 — Delete', () => {
    const rows = editorShortcutRows('drill', t, 'ko');
    expect(rows.filter(([key]) => key === 'Delete')).toHaveLength(1);
  });

  it('도구는 **어느 키가 무엇인지**를 적는다 — 글자마다 한 줄 (2026-08-16 기현 지시)', () => {
    // 옛 계약: *"도구 9종은 한 줄로 접힌다"* — `V L O T R B C P N` 한 줄에 설명은 '도구 선택'.
    // 짧았지만 질문에 답을 안 했다: 콘이 어느 글자인지 알려면 아홉 개를 세어 짝지어야 했다.
    const rows = editorToolRows('ko');
    expect(rows.find(([key]) => key === 'V L O T R B C P N'), '아직 접혀 있다').toBeUndefined();
    for (const [key, tool] of [
      ['V', '선택 도구'],
      ['C', '콘 도구'],
      ['N', '메모 도구'],
    ] as const) {
      const row = rows.find(([k]) => k === key);
      expect(row?.[1], `${key} 옆에 ${tool} 가 없다`).toBe(tool);
    }
  });

  it('4존 운동학이 **한 문장**이다 — 뒤 절반 이동 · 앞 절반 제자리 회전 · 차체 밖 견인', () => {
    const move = editorBasicsRows(t).find(([term]) => term === '옮기기')!;
    const line = move[1];
    for (const word of ['뒤 절반', '그대로 이동', '앞 절반', '제자리 회전', '차체 밖', '견인']) {
      expect(line, word).toContain(word);
    }
    // "한 문장으로" 가 명세다(§7 3.9) — 마침표가 하나면 문장도 하나다.
    expect(line.match(/\./g), '한 문장이어야 한다').toHaveLength(1);
  });

  it('그 문장의 출처가 아직 사실이다 — DEFAULT_ZONES 가 반반 + 차체 밖 견인', () => {
    // 도움말은 코드를 못 본다. 이 단언이 둘을 묶는다: 경계를 다시 옮기면(반반이 아니게 되면)
    // 여기가 깨지고, 고치는 사람은 editorBasicsRows 의 '뒤 절반/앞 절반' 문구도 함께 고쳐야 한다.
    expect(DEFAULT_ZONES.sSpinMin).toBe(1 / 2);
    expect(DEFAULT_ZONES.sTowRearMax).toBe(0); // 차체 안 견인 없음 — 견인은 차체 밖 가이드뿐
    expect(DEFAULT_ZONES.sTowFrontMin).toBe(1);
  });
});

describe('3.9 단축키 표 현행화 — 1차·2차에서 들어간 조작이 다 적혀 있다', () => {
  it.each([
    ['Ctrl/⌘+←→↑↓', '판 이동(팬)'], // §4.4 P2-1 — label 의 "방향키" 는 화면에선 기호로 나온다(keymapLabel)
    ['Space (스텝 사진)', '스텝 집기/놓기 — ←/→ 로 자리를 옮기고 Esc 로 되돌림'], // §4.4 P2-3
    ['방향키(배치 도구·코트 포커스)', '격자 커서 이동, Enter 로 배치'], // §7.5d
    ['Esc', '선택 해제 — 열린 창이 있으면 그 창만 닫힘'], // [A-3]
    ['Shift+?', '이 도움말'],
  ])('%s → %s', (key, desc) => {
    const rows = editorShortcutRows('drill', t, 'ko');
    const row = rows.find(([k]) => k === key);
    expect(row?.[1]).toBe(desc);
  });

  it('개편으로 사라진 키가 표에 남아 있지 않다 (대조군)', () => {
    // 2026-08-16 전면 개편. 위 it 들은 "새 줄이 있다" 만 보므로, 옛 줄이 나란히 남아 있어도
    // 통과한다 — 이 대조군이 그 절반을 막는다. **없는 키를 적어두면 코치는 자기가 잘못
    // 눌렀다고 생각한다**(이 파일 머리말의 그 사고와 같은 부류).
    const rows = editorShortcutRows('drill', t, 'ko');
    const keys = rows.map(([k]) => k);
    for (const gone of ['1–8 / V R P B C A T E', 'G / Z', 'Alt+←/→', 'Shift+방향키(화살표)', '[ / ] (화살표)']) {
      expect(keys, `${gone} 가 아직 표에 있다`).not.toContain(gone);
    }
    // 숫자키로 도구를 여는 줄이 통째로 없다.
    expect(keys.join(' ')).not.toMatch(/1–8|1-8/);
  });

  it('낡은 문구는 지워졌다 — Esc 는 이제 "포커스 복귀" 가 아니라 선택 해제다(대조군)', () => {
    // 틀린 도움말을 고쳤다는 단언. 위 it 들은 "새 줄이 있다" 만 보므로, 옛 줄이 나란히
    // 남아 있어도 통과한다 — 이 대조군이 그 절반을 막는다.
    const rows = editorShortcutRows('drill', t, 'ko');
    const descs = rows.map(([, d]) => d).join(' ');
    expect(descs).not.toMatch(/코트로 포커스 복귀/);
    // 옛 'Alt+Delete' 행 — 전역에는 그런 단축키가 없다(개체 포커스 Delete + Alt 는 범위 수식).
    expect(rows.map(([k]) => k)).not.toContain('Alt+Delete');
  });
});
