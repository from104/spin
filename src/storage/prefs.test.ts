// §10.6 prefs. localStorage 는 jsdom 환경에서 기본 제공된다.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PREFS_KEY,
  makeDefaultPrefs,
  loadPrefs,
  savePrefs,
  patchPrefs,
  validatePrefs,
  resolvePhysics,
  prunePhysics,
  resetPrefs,
  bumperKmhMax,
} from './prefs.ts';

beforeEach(() => {
  localStorage.clear();
});

describe('makeDefaultPrefs', () => {
  it('호출마다 독립된 객체를 만든다(공유 유출 방지)', () => {
    const a = makeDefaultPrefs();
    const b = makeDefaultPrefs();
    a.teams.home.color = '#000000';
    expect(b.teams.home.color).not.toBe('#000000');
  });
});

describe('validatePrefs', () => {
  it('playbackSpeed 1.5 는 1 로 떨어진다', () => {
    const { value } = validatePrefs({ playbackSpeed: 1.5 });
    expect(value.playbackSpeed).toBe(1);
  });
  it('playbackSpeed 0.5/2 는 그대로 통과한다', () => {
    expect(validatePrefs({ playbackSpeed: 0.5 }).value.playbackSpeed).toBe(0.5);
    expect(validatePrefs({ playbackSpeed: 2 }).value.playbackSpeed).toBe(2);
  });
  it("theme:'purple' 은 'dark' 로 떨어진다", () => {
    const { value } = validatePrefs({ theme: 'purple' });
    expect(value.theme).toBe('dark');
  });
  it("theme:'light' 는 유지된다", () => {
    expect(validatePrefs({ theme: 'light' }).value.theme).toBe('light');
  });
  it('boolean 필드는 잘못된 타입이면 기본값으로 떨어진다', () => {
    const { value } = validatePrefs({ loop: 'yes', showGrid: 1 });
    expect(value.loop).toBe(makeDefaultPrefs().loop);
    expect(value.showGrid).toBe(makeDefaultPrefs().showGrid);
  });
  it('알 수 없는 defaultCourtMode/defaultFormation 은 안전한 기본값으로 떨어진다', () => {
    const { value } = validatePrefs({ defaultCourtMode: 'bogus', defaultFormation: 'bogus' });
    expect(value.defaultCourtMode).toBeNull();
    expect(value.defaultFormation).toBe('1-2-1');
  });
  it('teams 의 색이 hex 형식이 아니면 DEFAULT_TEAMS 값으로 떨어진다', () => {
    const { value } = validatePrefs({ teams: { home: { color: 'not-a-color' }, away: {} } });
    expect(value.teams.home.color).toBe(makeDefaultPrefs().teams.home.color);
  });
  it('teams 의 유효한 hex 색은 통과한다', () => {
    const { value } = validatePrefs({ teams: { home: { color: '#123abc', label: '홈', gkColor: '#ffffff' }, away: {} } });
    expect(value.teams.home.color).toBe('#123abc');
  });
  it('객체가 아니면 완전한 기본값을 돌려준다', () => {
    expect(validatePrefs(null).value).toEqual(makeDefaultPrefs());
    expect(validatePrefs('garbage').value).toEqual(makeDefaultPrefs());
    expect(validatePrefs([1, 2, 3]).value).toEqual(makeDefaultPrefs());
  });
});

describe('resolvePhysics', () => {
  it('역전된 zones 는 정렬·클램프된다', () => {
    const prefs = makeDefaultPrefs();
    prefs.physics = { zones: { sTowRearMax: 0.5, sSpinMin: 0.1, sTowFrontMin: 0.05, grabPadPx: 10 } };
    const p = resolvePhysics(prefs);
    expect(p.zones.sTowRearMax).toBeLessThanOrEqual(0.18);
    expect(p.zones.sSpinMin).toBeGreaterThan(p.zones.sTowRearMax);
    expect(p.zones.sTowFrontMin).toBeGreaterThan(p.zones.sSpinMin);
  });
  it('linearKmh: 0 은 하한 4 로 클램프된다', () => {
    const prefs = makeDefaultPrefs();
    prefs.physics = { linearKmh: 0 };
    expect(resolvePhysics(prefs).linearKmh).toBe(4);
  });
  it('bumperKmh 는 linearKmh 에 연동된 상한을 넘지 않는다', () => {
    const prefs = makeDefaultPrefs();
    prefs.physics = { linearKmh: 4, bumperKmh: 999 };
    const p = resolvePhysics(prefs);
    expect(p.bumperKmh).toBeLessThanOrEqual(bumperKmhMax(4));
    expect(p.bumperKmh).toBeLessThanOrEqual(36);
  });
  it('한 항목만 override 해도 zones 의 나머지는 DEFAULT_ZONES 를 따라간다', () => {
    const prefs = makeDefaultPrefs();
    prefs.physics = { zones: { sTowRearMax: 0.15 } };
    const p = resolvePhysics(prefs);
    expect(p.zones.sTowRearMax).toBe(0.15);
    expect(p.zones.sSpinMin).toBe(0.32); // DEFAULT_ZONES.sSpinMin
    expect(p.zones.sTowFrontMin).toBe(0.85);
    expect(p.zones.grabPadPx).toBe(10);
  });
});

describe('prunePhysics', () => {
  it('기본값과 같은 항목은 걷어낸다', () => {
    const pruned = prunePhysics({
      zones: { sTowRearMax: 0.12, sSpinMin: 0.32, sTowFrontMin: 0.85, grabPadPx: 10 },
      linearKmh: 10,
      bumperKmh: 30,
      editorSpeedMultiplier: 1,
    });
    expect(pruned).toEqual({});
  });
  it('기본값과 다른 항목만 남긴다', () => {
    const pruned = prunePhysics({
      zones: { sTowRearMax: 0.16, sSpinMin: 0.32, sTowFrontMin: 0.85, grabPadPx: 10 },
      linearKmh: 12,
      bumperKmh: 30,
      editorSpeedMultiplier: 1,
    });
    expect(pruned).toEqual({ zones: { sTowRearMax: 0.16 }, linearKmh: 12 });
  });
});

describe('savePrefs', () => {
  it('setItem 이 던지면 삼키고 false 를 반환한다', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    try {
      expect(savePrefs(makeDefaultPrefs())).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
  it('정상 상황에서는 true 를 반환하고 저장한다', () => {
    expect(savePrefs(makeDefaultPrefs())).toBe(true);
    expect(localStorage.getItem(PREFS_KEY)).not.toBeNull();
  });
});

describe('loadPrefs / patchPrefs / resetPrefs', () => {
  it('저장된 값이 없으면 기본값을 돌려준다', () => {
    expect(loadPrefs()).toEqual(makeDefaultPrefs());
  });
  it('손상된 JSON 이 있어도 throw 하지 않고 기본값으로 떨어진다', () => {
    localStorage.setItem(PREFS_KEY, '{not-json');
    expect(loadPrefs()).toEqual(makeDefaultPrefs());
  });
  it('too-new schemaVersion 은 완전히 기본값으로 되돌린다', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ schemaVersion: 999, theme: 'light' }));
    expect(loadPrefs().theme).toBe('dark'); // 구조를 신뢰할 수 없어 theme 도 기본값
  });
  it('patchPrefs 는 저장하고 병합된 값을 돌려준다', () => {
    const { prefs, persisted } = patchPrefs({ loop: true });
    expect(persisted).toBe(true);
    expect(prefs.loop).toBe(true);
    expect(loadPrefs().loop).toBe(true);
  });
  it('resetPrefs 이후 loadPrefs 는 기본값', () => {
    savePrefs({ ...makeDefaultPrefs(), loop: true });
    resetPrefs();
    expect(loadPrefs().loop).toBe(false);
  });
});
