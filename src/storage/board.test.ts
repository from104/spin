// §6.8 자유 전술판 스냅샷 — 되살리기·pristine 게이트·손상 내성.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDrill } from '../model/defaults.ts';
import { BOARD_KEY, loadBoard, saveBoard } from './board.ts';

beforeEach(() => {
  localStorage.clear();
});

describe('전술판 스냅샷 왕복', () => {
  it('저장한 판이 그대로 되살아난다', () => {
    const d = createDrill({ courtMode: 'half', formation: '1-2-1' });
    expect(saveBoard(d)).toBe(true);

    const back = loadBoard();
    expect(back).not.toBeNull();
    expect(back!.drill.id).toBe(d.id);
    expect(back!.drill.courtMode).toBe('half');
  });

  it('저장된 적이 없으면 null', () => {
    expect(loadBoard()).toBeNull();
  });

  it('구버전(v7) 스냅샷이 v8 로 마이그레이션되어 되살아난다 — 실패하면 사용자의 대문 판이 통째로 초기화된다', () => {
    // Drill v8(2026-08-18 분류 개편) 이전에 저장된 localStorage 스냅샷을 흉내 낸다.
    // loadBoard 가 migrateDoc(DRILL_MIGRATIONS) 를 태우므로 체인 등록만으로 살아나야 한다.
    const d = createDrill({ courtMode: 'full' });
    const legacy: Record<string, unknown> = {
      ...(d as unknown as Record<string, unknown>),
      schemaVersion: 7,
      category: '공격',
      reps: 3,
      sets: 2,
      intervalSec: 60,
    };
    delete legacy.drillType;
    localStorage.setItem(BOARD_KEY, JSON.stringify({ schemaVersion: 1, pristine: false, drill: legacy }));

    const back = loadBoard();
    expect(back).not.toBeNull();
    expect(back!.drill.drillType).toBe('tactical'); // '공격' 매핑
    expect(back!.drill.tags).toContain('공격'); // 원문 보존
    expect('reps' in back!.drill).toBe(false);
    expect(back!.drill.description).toContain('훈련량(구버전): 3회 × 2세트 · 인터벌 60초');
  });
});

describe('되살리기 실패는 조용히 null — 대문이 안 뜨는 것이 최악이다', () => {
  it('JSON 이 깨져 있으면 null', () => {
    localStorage.setItem(BOARD_KEY, '{이건 JSON 이 아니다');
    expect(loadBoard()).toBeNull();
  });

  it('드릴이 검증을 통과 못 하면 null', () => {
    localStorage.setItem(BOARD_KEY, JSON.stringify({ schemaVersion: 1, pristine: true, drill: { 헛것: 1 } }));
    expect(loadBoard()).toBeNull();
  });

  it('더 최신 스키마로 저장된 판은 되살리지 않는다', () => {
    const d = createDrill({ courtMode: 'full' });
    localStorage.setItem(
      BOARD_KEY,
      JSON.stringify({ schemaVersion: 1, pristine: true, drill: { ...d, schemaVersion: 999 } }),
    );
    expect(loadBoard()).toBeNull();
  });
});

// 2026-08-28 — `pristine` 필드가 은퇴하면서 그 판정을 못박던 describe 셋(보존·없음·비-true)이
// 함께 사라졌다. 게이트가 저장본이 아니라 **판 위 개체**를 세므로(EditorWorkspace) 스냅샷이
// 실을 값 자체가 없다. 옛 스냅샷에 남아 있는 pristine 은 그냥 무시된다 — 아래가 그 대조군이다.
describe('옛 스냅샷의 pristine 필드는 무시된다', () => {
  it('남아 있어도 판은 그대로 되살아난다', () => {
    const d = createDrill({ courtMode: 'half' });
    localStorage.setItem(BOARD_KEY, JSON.stringify({ schemaVersion: 1, pristine: false, drill: d }));
    expect(loadBoard()!.drill.courtMode).toBe('half');
  });
});

describe('저장 실패가 앱을 죽이지 않는다', () => {
  it('QuotaExceededError 를 삼키고 false 를 돌려준다', () => {
    // Safari 프라이빗 모드. 드래그 정착 콜백 안에서 던지면 에러 바운더리까지 올라가 판이 날아간다.
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => saveBoard(createDrill({ courtMode: 'full' }))).not.toThrow();
    expect(saveBoard(createDrill({ courtMode: 'full' }))).toBe(false);
    spy.mockRestore();
  });

});

// clearBoard 테스트 2건(프라이빗 모드에서 안 던진다 · 지우면 다시 null)은 그 함수와 함께
// 2026-08-31 에 폐기했다 — 호출자가 이 테스트뿐이었다(board.ts 의 그 자리 주석 참고).
