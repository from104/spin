// §6.8 자유 전술판 스냅샷 — 되살리기·pristine 게이트·손상 내성.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDrill } from '../model/defaults.ts';
import { BOARD_KEY, clearBoard, loadBoard, saveBoard } from './board.ts';

beforeEach(() => {
  localStorage.clear();
});

describe('전술판 스냅샷 왕복', () => {
  it('저장한 판이 그대로 되살아난다', () => {
    const d = createDrill({ courtMode: 'half', formation: '1-2-1' });
    expect(saveBoard(d, true)).toBe(true);

    const back = loadBoard();
    expect(back).not.toBeNull();
    expect(back!.drill.id).toBe(d.id);
    expect(back!.drill.courtMode).toBe('half');
    expect(back!.pristine).toBe(true);
  });

  it('pristine=false 가 보존된다 — 이게 코트 전환 게이트의 저장분', () => {
    saveBoard(createDrill({ courtMode: 'full' }), false);
    expect(loadBoard()!.pristine).toBe(false);
  });

  it('저장된 적이 없으면 null', () => {
    expect(loadBoard()).toBeNull();
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

describe('pristine 없음은 false 로 본다 (안전한 쪽)', () => {
  it('필드가 아예 없으면 false — true 로 보면 편집된 판에서 코트 전환이 열려 배치가 날아간다', () => {
    const d = createDrill({ courtMode: 'full' });
    localStorage.setItem(BOARD_KEY, JSON.stringify({ schemaVersion: 1, drill: d }));
    expect(loadBoard()!.pristine).toBe(false);
  });

  it('true 가 아닌 아무 값이어도 false', () => {
    const d = createDrill({ courtMode: 'full' });
    localStorage.setItem(BOARD_KEY, JSON.stringify({ schemaVersion: 1, pristine: 'yes', drill: d }));
    expect(loadBoard()!.pristine).toBe(false);
  });
});

describe('저장 실패가 앱을 죽이지 않는다', () => {
  it('QuotaExceededError 를 삼키고 false 를 돌려준다', () => {
    // Safari 프라이빗 모드. 드래그 정착 콜백 안에서 던지면 에러 바운더리까지 올라가 판이 날아간다.
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => saveBoard(createDrill({ courtMode: 'full' }), true)).not.toThrow();
    expect(saveBoard(createDrill({ courtMode: 'full' }), true)).toBe(false);
    spy.mockRestore();
  });

  it('clearBoard 도 던지지 않는다', () => {
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => clearBoard()).not.toThrow();
    spy.mockRestore();
  });
});

describe('clearBoard', () => {
  it('지우면 다시 null', () => {
    saveBoard(createDrill({ courtMode: 'full' }), true);
    clearBoard();
    expect(loadBoard()).toBeNull();
  });
});
