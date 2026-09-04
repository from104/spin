// §6.8 화면 상수. 화면 키가 어긋나면(오타·누락) 레일·헤더·라이브 리전 발표가 전부 깨진다.
import { describe, expect, it } from 'vitest';
import {
  RAIL_ITEMS,
  SCREEN_NAV_LABELS,
  SCREEN_ORDER,
  SCREEN_SUBTITLES,
  SCREEN_TITLES,
  SCREEN_TO_RAIL,
  railFor,
} from './screens.ts';
import type { Screen } from './screens.ts';
import { SUPPORTED_LOCALES } from '../i18n/locale.ts';

const EXPECTED: readonly Screen[] = ['board', 'drills', 'sessions', 'present', 'rules', 'settings'];

describe('screens', () => {
  it('SCREEN_ORDER 는 재편 후 6화면(§6.8, C5 세션 합류 + 2026-08-21 규칙 합류)과 순서까지 정확히 같다', () => {
    expect(SCREEN_ORDER).toEqual(EXPECTED);
  });

  it("'editor' 는 더 이상 화면 키가 아니다", () => {
    // 2026-08-09 재편: 자유 전술판과 드릴 편집은 둘 다 home 자리에 뜬다(AppShell 의 StageTarget).
    // 이 단언이 없으면 어디선가 go('editor') 를 되살렸을 때 SCREEN_SET 이 걸러 조용히 무시하고,
    // 화면이 안 바뀌는 이유를 찾기 어려워진다.
    expect(SCREEN_ORDER).not.toContain('editor');
  });

  it('화면 키는 6개다 — C5 에서 sessions 가, 2026-08-21 에 rules 가 합류했다', () => {
    // 옛 "키 4개 그대로" 단언의 후계. '화면 분리안'(board/edit 쪼개기) 금지는 위 'editor'
    // 단언이 계속 지킨다 — 이번 증가는 분리가 아니라 승격이다(세션 탭 → 1급 화면, 신규 규칙 화면).
    expect(SCREEN_ORDER).toHaveLength(6);
  });

  it('SCREEN_TITLES/SCREEN_NAV_LABELS 는 세 언어 × 6화면 전부에 빈 문자열이 아닌 값을 갖는다(i18n C2)', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const s of EXPECTED) {
        expect(SCREEN_TITLES[locale][s]).toBeTruthy();
        expect(SCREEN_NAV_LABELS[locale][s]).toBeTruthy();
        // board 는 전술판·드릴 편집이 useAppHeader 로 직접 부제를 채운다 — 그 외엔 정적으로 채워둔다.
        if (s !== 'board') expect(SCREEN_SUBTITLES[locale][s]).toBeTruthy();
      }
    }
  });
});

describe('레일 5단 (계획서 2.1 → C5 세션 합류 → 2026-08-21 규칙 합류)', () => {
  it('RAIL_ITEMS 는 5개다 — present 는 화면 키로 남되 레일에서 빠진다', () => {
    expect(RAIL_ITEMS).toEqual(['board', 'drills', 'sessions', 'rules', 'settings']);
    expect(RAIL_ITEMS).not.toContain('present');
    // 그러나 화면 키로는 살아 있다 — 레일에서 뺐다고 화면을 없앤 것이 아니다(§6.8 전체화면 계약).
    expect(SCREEN_ORDER).toContain('present');
  });

  it('시연 중 레일 활성은 [드릴] 이다 — 단 세션 시연은 railFor 가 [세션]으로 덮는다 (C5)', () => {
    expect(SCREEN_TO_RAIL.present).toBe('drills');
    expect(railFor('present', 'board', 'session')).toBe('sessions');
    expect(railFor('present', 'board', 'drill')).toBe('drills');
    expect(railFor('present', 'board', null)).toBe('drills');
  });

  it('SCREEN_TO_RAIL 은 6화면 전부를 RAIL_ITEMS 안의 항목으로 접는다', () => {
    // 빠진 화면이 있으면 그 화면에서 레일이 통째로 비활성이 되고(aria-current 없음),
    // RAIL_ITEMS 밖 값을 가리키면 어느 버튼에도 안 붙어 같은 증상이 된다.
    for (const s of SCREEN_ORDER) {
      expect(RAIL_ITEMS).toContain(SCREEN_TO_RAIL[s]);
    }
    expect(Object.keys(SCREEN_TO_RAIL).sort()).toEqual([...SCREEN_ORDER].sort());
  });

  it('레일 항목 자기 자신은 자기에게 매핑된다 — present 만 남의 자리를 빌린다', () => {
    for (const key of RAIL_ITEMS) {
      expect(SCREEN_TO_RAIL[key]).toBe(key);
    }
  });
});

describe('railFor — 화면 키만으로는 못 정하는 자리 (2026-08-14 기현님 지시)', () => {
  it('board 화면은 무엇이 떠 있느냐로 갈린다: 전술판이면 [보드], 드릴 편집이면 [드릴]', () => {
    expect(railFor('board', 'board')).toBe('board');
    expect(railFor('board', 'drill')).toBe('drills');
  });

  it('stageKind 를 안 주면 전술판으로 본다 — 레일을 홀로 렌더하는 곳의 기본값', () => {
    expect(railFor('board')).toBe('board');
  });

  it('나머지 화면은 stageKind 와 무관하다 — board 자리를 안 쓰기 때문', () => {
    for (const s of ['drills', 'present', 'rules', 'settings'] as const) {
      expect(railFor(s, 'drill')).toBe(SCREEN_TO_RAIL[s]);
      expect(railFor(s, 'board')).toBe(SCREEN_TO_RAIL[s]);
    }
  });

  it('어떤 조합에서도 RAIL_ITEMS 안의 항목을 돌려준다', () => {
    // 밖의 값을 돌려주면 어느 버튼에도 안 붙어 레일이 통째로 비활성으로 보인다.
    for (const s of SCREEN_ORDER) {
      for (const k of ['board', 'drill'] as const) expect(RAIL_ITEMS).toContain(railFor(s, k));
    }
  });
});

// 구 키 관용 표(LEGACY_SCREEN_KEYS)는 C4(react-router)에서 은퇴 — screens.ts 주석 참고.
