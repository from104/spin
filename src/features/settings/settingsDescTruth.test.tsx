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
import { ko } from '../../i18n/ko.ts';

const KO_TEXT = Object.values(ko).join('\n');
const BOARD = readFileSync('src/features/board/BoardScreen.tsx', 'utf-8');

describe("C2 종결 — '기본 코트 모드'·'기본 포메이션' 설정 자체를 폐기했다 (2026-08-21 기현 지시)", () => {
  // 6차 검증(2026-08-13)이 문구를, 설정 화면 감사(2026-08-21)가 '항상 묻기' 선택지를
  // 고쳤지만, 같은 날 최종 결정은 **두 행 자체의 폐기**다: 포메이션은 코치 재량이라 앱이
  // 기본값을 정하지 않고, 시작 코트는 전술판 스냅샷이 스스로 기억해 그 설정이 기기당 최초
  // 1회만 읽히는 유령이었다. 여기는 그 폐기가 반쪽으로 돌아오지 않게 못박는다.
  it('사전에서 두 행의 키와 옛 거짓 문구가 모두 사라졌다', () => {
    // 대조군: 사전 자체가 비어 있지 않다(사전이 깨지면 아래 없음 단언들이 전부 무의미해진다).
    expect(Object.keys(ko).length).toBeGreaterThan(10);
    for (const k of ['courtModeTitle', 'courtModeDesc', 'courtModeAsk', 'formationTitle', 'formationDesc']) {
      expect(`settings.team.${k}` in ko).toBe(false);
    }
    expect(KO_TEXT.includes('코트 선택 화면')).toBe(false);
    expect(KO_TEXT.includes('선택은 매번 확인')).toBe(false);
  });

  it('소비처도 함께 끊었다 — 전술판은 스냅샷이 없으면 풀 코트 고정으로 뜬다', () => {
    // 주석의 폐기 기록에는 식별자가 남아 있으므로 **소비 표현식**의 부재를 단언한다.
    expect(BOARD).not.toContain('prefs.defaultCourtMode ??');
    expect(BOARD).not.toContain('formation: prefs.defaultFormation');
    expect(BOARD).toContain("mode ?? 'full'");
  });

  it('대조군 — 이 검사에 이빨이 있다: 소비처 문자열을 틀리게 적으면 잡힌다', () => {
    expect(BOARD).not.toContain("mode ?? 'half'");
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
