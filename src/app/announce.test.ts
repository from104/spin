// §7.6 / 계획서 2.4 — 라이브 리전 발표문.
//
// 이 단언들이 붙잡는 결함: 개명 전에는 화면 키 하나로 발표문을 만들어서, 자유 전술판을 열든
// 드릴을 열든 **똑같이 "전술판 화면"** 이라고만 읽혔다. 눈으로는 헤더 제목이 다르니 아무도
// 눈치채지 못하고, 화면 리더를 쓰는 코치만 방금 무엇이 열렸는지 알 수 없었다.
//
// i18n C2 — announceFor 에 locale 인자가 늘었다(필수, 기본값 없음). 여기서는 전부 'ko' 를
// 명시로 넘긴다 — 다국어 자체(영어/일본어 문구가 맞는지)는 i18n/useT.test.tsx·locale.test.ts
// 가 사전 값 단위로 보고, 여기는 여전히 "어느 화면이든 서로 다른 문장이 나온다" 는 배선을 본다.
import { describe, expect, it } from 'vitest';
import { announceFor } from './announce.ts';
import type { PresentTarget, StageTarget } from './AppShell.tsx';
import type { DrillId, SessionId } from '../core/ids.ts';

const BOARD: StageTarget = { kind: 'board' };
const DRILL: StageTarget = { kind: 'drill', drillId: 'dr_1' as DrillId };
const P_DRILL: PresentTarget = { kind: 'drill', drillId: 'dr_1' as DrillId };
const P_SESSION: PresentTarget = { kind: 'session', sessionId: 'se_1' as SessionId };

const titleOf = (t: StageTarget | PresentTarget) => {
  if (t.kind === 'drill') return t.drillId === 'dr_1' ? '측면 돌파 2대1' : undefined;
  if (t.kind === 'session') return t.sessionId === 'se_1' ? '화요일 정기훈련' : undefined;
  return undefined;
};

describe('announceFor', () => {
  it('같은 board 화면이라도 자유판과 드릴 편집이 다르게 읽힌다', () => {
    const free = announceFor('board', BOARD, null, 'ko', { titleOf });
    const editing = announceFor('board', DRILL, null, 'ko', { titleOf });
    expect(free).toBe('자유 전술판');
    expect(editing).toBe('드릴 편집: 측면 돌파 2대1');
    // 개명 전 결함의 본체 — 화면 키가 같다고 같은 문장이 나오면 안 된다.
    expect(editing).not.toBe(free);
  });

  it('드릴을 열면 그 드릴 제목이 발표문에 들어간다', () => {
    expect(announceFor('board', DRILL, null, 'ko', { titleOf })).toContain('측면 돌파 2대1');
  });

  it('시연은 시연이라는 사실과 대상 제목을 함께 읽는다', () => {
    expect(announceFor('present', BOARD, P_DRILL, 'ko', { titleOf })).toBe('시연: 측면 돌파 2대1');
    expect(announceFor('present', BOARD, P_SESSION, 'ko', { titleOf })).toBe('시연: 화요일 정기훈련');
  });

  it('시연 대상이 없으면(레일·직접 진입) 빈 제목 대신 화면 이름만 읽는다', () => {
    expect(announceFor('present', BOARD, null, 'ko', { titleOf })).toBe('시연 모드');
  });

  it('제목을 못 찾으면 콜론 뒤를 비우지 않는다', () => {
    // 목록이 아직 안 읽혔거나 삭제된 드릴. "드릴 편집: " 로 끝나면 화면 리더가 빈 자리를 읽는다.
    const unknown: StageTarget = { kind: 'drill', drillId: 'dr_gone' as DrillId };
    expect(announceFor('board', unknown, null, 'ko', { titleOf })).toBe('드릴 편집');
    expect(announceFor('present', BOARD, { kind: 'drill', drillId: 'dr_gone' as DrillId }, 'ko', { titleOf })).toBe('시연 모드');
  });

  it('조회기를 아예 안 넘겨도 죽지 않는다 — locale 만 있는 4인자 호출도 그대로 동작한다', () => {
    expect(announceFor('board', DRILL, null, 'ko')).toBe('드릴 편집');
    expect(announceFor('board', BOARD, null, 'ko')).toBe('자유 전술판');
  });

  it('드릴 목록·세션 목록은 각자의 문장이다 (C5 — 탭 문구 은퇴)', () => {
    expect(announceFor('drills', BOARD, null, 'ko')).toBe('드릴 목록');
    expect(announceFor('sessions', BOARD, null, 'ko')).toBe('세션 목록');
  });

  it('설정은 설정이다', () => {
    expect(announceFor('settings', BOARD, null, 'ko')).toBe('설정');
  });

  it('네 화면 전부 빈 문자열을 만들지 않는다', () => {
    // 빈 문자열을 say() 하면 라이브 리전이 아무것도 발표하지 않는다 — 화면이 바뀌었는데
    // 조용한 것이 가장 나쁜 실패다.
    for (const s of ['board', 'drills', 'present', 'settings'] as const) {
      expect(announceFor(s, BOARD, null, 'ko')).toBeTruthy();
      expect(announceFor(s, DRILL, P_SESSION, 'ko', { titleOf })).toBeTruthy();
    }
  });

  it('세 언어 전부에서 빈 문자열을 만들지 않는다(i18n C2)', () => {
    for (const locale of ['ko', 'en', 'ja'] as const) {
      for (const s of ['board', 'drills', 'sessions', 'present', 'settings'] as const) {
        expect(announceFor(s, BOARD, null, locale)).toBeTruthy();
        expect(announceFor(s, DRILL, P_SESSION, locale, { titleOf })).toBeTruthy();
      }
    }
  });
});
