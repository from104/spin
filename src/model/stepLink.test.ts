// 연결 방식(딜레이 연결·딜레이 없는 연결·끊김)의 읽기·쓰기·순환 — PLAN-STEP-LINK 결정 1·6.
//
// 여기서 보는 것은 **두 개의 예외 키와 세 상태 사이의 번역**이다. 이 번역이 한쪽으로 어긋나면
// 편집기는 셋을 보여 주는데 저장·재생은 둘만 아는 상태가 되고, 그 어긋남은 화면에 안 보인다.
import { describe, expect, it } from 'vitest';
import { nextStepLink, stepLink, stepLinkPatch } from './stepLink.ts';

describe('stepLink — 저장 키 → 연결 방식', () => {
  it('키가 없으면 delay, seamless 면 seamless, cut 이면 cut', () => {
    expect(stepLink({})).toBe('delay');
    expect(stepLink({ seamless: true })).toBe('seamless');
    expect(stepLink({ cut: true })).toBe('cut');
  });

  it('둘 다 실린 (정화 안 된) 스텝은 cut 으로 읽는다 — 읽기 규칙이 하나여야 재생과 UI 가 안 갈린다', () => {
    expect(stepLink({ cut: true, seamless: true })).toBe('cut');
  });
});

describe('stepLinkPatch — 연결 방식 → STEP_META 패치', () => {
  it('delay 는 두 키를 **다 지우라고** 보낸다(false = 키 삭제 명령)', () => {
    expect(stepLinkPatch('delay')).toEqual({ cut: false, seamless: false });
  });

  it('seamless·cut 은 자기 키만 켜고 나머지 키를 지운다 — 안 지우면 배타가 깨진다', () => {
    expect(stepLinkPatch('seamless')).toEqual({ cut: false, seamless: true });
    expect(stepLinkPatch('cut')).toEqual({ cut: true, seamless: false });
  });
});

describe('nextStepLink — 3상태 순환', () => {
  it('delay → seamless → cut → delay 로 돌고, 세 번이면 제자리다', () => {
    expect(nextStepLink('delay')).toBe('seamless');
    expect(nextStepLink('seamless')).toBe('cut');
    expect(nextStepLink('cut')).toBe('delay');
    expect(nextStepLink(nextStepLink(nextStepLink('delay')))).toBe('delay');
  });
});
