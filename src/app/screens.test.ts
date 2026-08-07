// §6.8 화면 상수. 5개 화면 키가 어긋나면(오타·누락) 레일·헤더·라이브 리전 발표가 전부 깨진다.
import { describe, expect, it } from 'vitest';
import { SCREEN_NAV_LABELS, SCREEN_ORDER, SCREEN_SUBTITLES, SCREEN_TITLES } from './screens.ts';
import type { Screen } from './screens.ts';

const EXPECTED: readonly Screen[] = ['home', 'library', 'editor', 'present', 'settings'];

describe('screens', () => {
  it('SCREEN_ORDER 는 계약서 5화면(§6.8)과 순서까지 정확히 같다', () => {
    expect(SCREEN_ORDER).toEqual(EXPECTED);
  });

  it('SCREEN_TITLES/SCREEN_SUBTITLES/SCREEN_NAV_LABELS 는 5화면 전부에 빈 문자열이 아닌 값을 갖는다', () => {
    for (const s of EXPECTED) {
      expect(SCREEN_TITLES[s]).toBeTruthy();
      expect(SCREEN_NAV_LABELS[s]).toBeTruthy();
      // editor 는 드릴 로드 전 부제가 없다(화면이 useAppHeader 로 직접 채운다) — 그 외엔 채워둔다.
      if (s !== 'editor') expect(SCREEN_SUBTITLES[s]).toBeTruthy();
    }
  });
});
