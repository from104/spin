// 6차 검증 — **설정 설명문이 사실인가.** 6.2 는 접근성 섹션만 훑었고, 미배송 감사가 [재생]·
// [팀] 섹션에서 거짓 문구 둘을 더 찾았다(C1 · C2). 여기는 그 둘을 **동작과 짝지어** 못박는다.
//
// ⚠️ 이 파일의 규율: *"문자열이 존재한다"* 로 끝내지 않는다. 그 방식은 이 저장소에서 가장
// 헛통과하기 쉬운 부류다 — 문구가 거짓이어도 문자열은 멀쩡히 존재하기 때문이다. 그래서 각
// it 은 **문구가 주장하는 동작을 코드에서 확인**하고, 옛 거짓 문구가 돌아오면 빨개지게 둔다.
//
// i18n C3 — 문구가 SettingsScreen.tsx 의 JSX 리터럴에서 i18n/ko.ts 사전으로 옮겨갔다. 대조는
// 이제 `desc="..."` 정규식이 아니라 `ko` 사전 값을 직접 본다 — SettingsScreen.tsx 자체는
// `t('key')` 호출만 남아 문구 텍스트가 더 이상 그 파일에 없다.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeDefaultPrefs } from '../../storage/prefs.ts';
import { ko } from '../../i18n/ko.ts';

const KO_TEXT = Object.values(ko).join('\n');
const BOARD = readFileSync('src/features/board/BoardScreen.tsx', 'utf-8');

describe("C2 — '기본 코트 모드' 문구가 실제 소비처와 맞다", () => {
  it('옛 거짓 문구(코트 선택 화면 / 새 드릴)가 사전에서 사라졌다', () => {
    // ① CourtPicker 는 은퇴했으므로 '코트 선택 화면' 은 없는 화면을 가리킨다.
    // 대조군: 사전 자체가 비어 있지 않다(사전이 깨지면 아래 없음 단언들이 전부 무의미해진다).
    expect(Object.keys(ko).length).toBeGreaterThan(10);
    expect(KO_TEXT.includes('코트 선택 화면')).toBe(false);
    expect(KO_TEXT.includes('선택은 매번 확인')).toBe(false);
  });

  it('새 문구가 주장하는 소비처가 실재한다 — 전술판이 이 값으로 코트를 정한다', () => {
    // 문구: "[보드] 전술판이 뜰 때의 코트입니다".
    expect(ko['settings.team.courtModeDesc']).toContain('[보드] 전술판이 뜰 때의 코트입니다');
    expect(BOARD).toContain("prefs.defaultCourtMode ?? 'full'");
  });

  it("'항상 묻기' 라는 이름의 선택지를 없앴다 — 실제로는 아무것도 묻지 않았기 때문(2026-08-21 재검증)", () => {
    // 예전엔 화면에 '항상 묻기' 선택지가 있었지만 골라도 아무것도 묻지 않고 조용히 풀 코트로
    // 접혔다(BoardScreen 의 `?? 'full'`). 존재하지 않는 동작에 이름을 붙여 보여주는 것 자체가
    // 거짓이라 선택지를 지웠다 — 저장값이 비어 있을 때(신규 사용자·옛 저장본)의 fallback 은
    // 그대로 'full' 이다, 이제 그 사실을 화면이 선택지로 주장하지 않을 뿐이다.
    expect('settings.team.courtModeAsk' in ko).toBe(false);
    expect(ko['settings.team.courtModeDesc']).not.toContain('항상 묻기');
    expect(makeDefaultPrefs().defaultCourtMode).toBeNull();
    expect(BOARD).toContain("prefs.defaultCourtMode ?? 'full'");
  });

  it('대조군 — 이 검사에 이빨이 있다: 소비처 문자열을 틀리게 적으면 잡힌다', () => {
    expect(BOARD).not.toContain("prefs.defaultCourtMode ?? 'half'");
  });
});

describe("C1 — '마지막 스텝에서 반복' 문구가 이제 사실이다", () => {
  it('문구는 그대로 두되, 그 주장이 참이 되도록 배선이 생겼다', () => {
    // 문구: "끝나면 처음 스텝으로 되돌아갑니다". 2026-08-13 이전에는 거짓이었다 —
    // prefs.loop 를 읽는 프로덕션 소비처가 이 토글 자기 자신 1곳뿐이었다.
    expect(ko['settings.playback.loopDesc']).toBe('끝나면 처음 스텝으로 되돌아갑니다');
    // 실제 배선의 단언은 store/playback/playbackLoopPref.test.tsx 가 전담한다(세 화면 열거 +
    // 시연 화면 실렌더). 여기서는 **문구와 그 파일이 짝이라는 사실**만 남긴다.
    const wiring = readFileSync('src/store/playback/playbackLoopPref.test.tsx', 'utf-8');
    expect(wiring).toContain('initialLoop={prefs.loop}');
  });
});

describe("C3 — '팀 색상' 문구가 스냅샷 의미를 숨기지 않는가 (보고만, 조치 아님)", () => {
  it('⚠️ 알려진 반쪽 진실 — drill.teams 는 생성 시점 스냅샷이라 기존 판에는 안 닿는다', () => {
    // 설정 행은 *"코트 위 칩에 적용됩니다"* 라고 적는데, 이미 만든 드릴·저장된 전술판은
    // 자기 `teams` 스냅샷을 쓴다(drill.ts 의 teams 필드 · BoardScreen 이 loadBoard 로 복원).
    // 즉 "**새로** 만드는 판에 적용됩니다" 가 정확하다. 문구를 고치는 것은 제품 판단이라
    // 6차 검증은 **사실만 못박고** 7차 표에 행을 남긴다 — 이 it 이 그 사실의 기록이다.
    expect(readFileSync('src/model/drill.ts', 'utf-8')).toContain('teams');
    expect(BOARD).toContain('teams: prefs.teams');
    expect(BOARD).toContain('loadBoard()');
    // 문구는 아직 옛 상태다(고치는 날 이 줄이 빨개져 이 주석을 다시 읽게 한다).
    expect(ko['settings.team.homeColorDesc']).toBe('코트 위 칩에 적용됩니다');
  });
});
