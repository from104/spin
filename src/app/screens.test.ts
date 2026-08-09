// §6.8 화면 상수. 4개 화면 키가 어긋나면(오타·누락) 레일·헤더·라이브 리전 발표가 전부 깨진다.
import { describe, expect, it } from 'vitest';
import { SCREEN_NAV_LABELS, SCREEN_ORDER, SCREEN_SUBTITLES, SCREEN_TITLES } from './screens.ts';
import type { Screen } from './screens.ts';

const EXPECTED: readonly Screen[] = ['home', 'library', 'present', 'settings'];

describe('screens', () => {
  it('SCREEN_ORDER 는 재편 후 4화면(§6.8)과 순서까지 정확히 같다', () => {
    expect(SCREEN_ORDER).toEqual(EXPECTED);
  });

  it("'editor' 는 더 이상 화면 키가 아니다", () => {
    // 2026-08-09 재편: 자유 전술판과 드릴 편집은 둘 다 home 자리에 뜬다(AppShell 의 StageTarget).
    // 이 단언이 없으면 어디선가 go('editor') 를 되살렸을 때 SCREEN_SET 이 걸러 조용히 무시하고,
    // 화면이 안 바뀌는 이유를 찾기 어려워진다.
    expect(SCREEN_ORDER).not.toContain('editor');
  });

  it('SCREEN_TITLES/SCREEN_NAV_LABELS 는 4화면 전부에 빈 문자열이 아닌 값을 갖는다', () => {
    for (const s of EXPECTED) {
      expect(SCREEN_TITLES[s]).toBeTruthy();
      expect(SCREEN_NAV_LABELS[s]).toBeTruthy();
      // home 은 전술판·드릴 편집이 useAppHeader 로 직접 부제를 채운다 — 그 외엔 정적으로 채워둔다.
      if (s !== 'home') expect(SCREEN_SUBTITLES[s]).toBeTruthy();
    }
  });
});
