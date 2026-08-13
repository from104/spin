// 6차 검증 — **§3.4 선수 실명이 어느 출력 채널까지 갔는가.**
//
// 3.4 의 완료 판정은 *"인스펙터 [개체] 탭에서 이름 입력 → 트레이·**PDF**·시연 자막에 반영.
// **실제 세션 계획서는 "3번" 이 아니라 이름으로 읽힌다**"* 였다. 실측(2026-08-13)하니 그 중
// **PDF(종이) 절반이 배송되지 않았다**: `src/features/print/` 전체에서 이름 헬퍼
// (`model/chairLabel.ts` 의 `numberedName`·`chairName`·`hasChairName`)를 부르는 곳이 **0** 이고,
// `PrintCourt.tsx:151` 은 칩에 `{c.number}` 만 찍는다. PNG(`features/export/`)도 마찬가지다.
//
// 왜 아무도 못 봤나 — 이 재편의 헛통과 1형태("어느 축을 안 찔렀나") 그대로다. 이름은
// **쓰는 UI 도 있고 읽는 소비처도 있어서** 미배송 감사의 3열 대조(화이트리스트 / 렌더 소비처 /
// 넣는 UI)를 **전부 통과한다**. 빠진 것은 "읽는 소비처가 **다섯 화면 중 몇 개인가**" 였다.
// 이 저장소가 정한 화면 축은 편집 · 시연 · 인쇄 · PNG · 썸네일 다섯이고, 이름은 그 중 둘에만 있다.
//
// ⚠️ 이 파일은 **구멍을 현재 상태 그대로 못박는다**(5.6 이 밝은 차체 파선에 쓴 수법이고,
//    6.5 가 그것을 뒤집어 닫았다). 종이·PNG 에 이름을 태우는 날 아래 '아직 안 간다' 두 it 이
//    빨개진다 — 그때 지우지 말고 **방향을 뒤집어라**(숫자와 근거는 남긴다).
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { numberedName, chairName, hasChairName } from '../model/chairLabel.ts';

/** 이름 헬퍼를 부르는 비테스트 파일 전량. 채널별로 "이름이 흐르는가" 의 유일한 지표다. */
function filesCallingNameHelpers(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
        const s = readFileSync(p, 'utf-8');
        if (/\b(numberedName|chairName|hasChairName)\b/.test(s)) out.push(p);
      }
    }
  };
  walk(dir);
  return out.sort();
}

describe('대조군 — 이름 규칙 자체는 살아 있다(구멍이 "기능이 없어서" 가 아니다)', () => {
  it('numberedName 이 이름을 실제로 붙인다', () => {
    expect(numberedName('3', '김민수')).toContain('김민수');
    expect(numberedName('3', undefined)).not.toContain('undefined');
  });
  it('hasChairName / chairName 이 빈 이름을 걸러낸다', () => {
    const teams = {
      home: { label: '우리 팀', color: '#d93a3a', gkColor: '#f2c811' },
      away: { label: '상대', color: '#1f6bb8', gkColor: '#22a95b' },
    };
    expect(hasChairName({ name: '  ' })).toBe(false);
    expect(hasChairName({ name: '김민수' })).toBe(true);
    // 두 갈래를 **둘 다** 탄다 — 이름 있음(조기 반환) / 이름 없음(팀 라벨 폴백).
    expect(chairName({ team: 'home', number: '3', isGk: false, name: '김민수' }, teams)).toBe('김민수');
    expect(chairName({ team: 'home', number: '3', isGk: false }, teams)).toBe('우리 팀 3');
  });
});

describe('§3.4 이름이 실제로 흐르는 채널 — 전수 열거', () => {
  it('화면(편집기 트레이·인스펙터)과 시연 자막에는 간다', () => {
    const callers = filesCallingNameHelpers('src');
    expect(callers).toContain('src/features/editor/ToolRail.tsx'); // 트레이 손잡이
    expect(callers).toContain('src/features/editor/InspectorPanel.tsx'); // 이름 입력 + 표시
    expect(callers).toContain('src/features/present/PresentRunner.tsx'); // 시연 자막(명단)
  });

  it('⚠️ 아직 안 간다 — **인쇄(종이)** 채널에 이름 헬퍼 호출이 0이다', () => {
    // 재현: 인스펙터 [개체] 탭에서 3번 선수에 '김민수' 를 넣고 → [내보내기] → [인쇄]
    //       → 코트 위 칩은 여전히 '3' 이고, 드릴 시트·세션 계획서 어디에도 명단이 없다.
    // 근거: PrintCourt.tsx 가 칩에 `{c.number}` 만 찍는다(아래 대조군이 그 줄을 붙잡는다).
    const printCallers = filesCallingNameHelpers('src/features/print');
    expect(printCallers, '종이에 이름이 가기 시작했다면 이 it 을 뒤집어라').toEqual([]);
    expect(readFileSync('src/features/print/PrintCourt.tsx', 'utf-8')).toContain('{c.number}');
  });

  it('⚠️ 아직 안 간다 — **PNG** 채널에도 이름 헬퍼 호출이 0이다', () => {
    // PNG 는 `<text>` 를 한 개도 넣지 않고(A-9) 글자를 캔버스에서 그린다 — 그래서 이름을
    // 태우려면 `buildTextPlacements` 에 항목을 더해야 한다. 채널이 다르다는 사실 자체가
    // "한 곳만 고치면 된다" 가 아님을 말해 준다.
    expect(filesCallingNameHelpers('src/features/export'), 'PNG 에 이름이 가기 시작했다면 이 it 을 뒤집어라').toEqual([]);
  });

  it('대조군 — 이 검사에 이빨이 있다: 스캐너가 실제로 파일을 찾아낸다', () => {
    // 0개라서 통과 를 막는다. src 전역에서는 반드시 여러 개가 잡혀야 한다.
    expect(filesCallingNameHelpers('src').length).toBeGreaterThanOrEqual(3);
  });
});
