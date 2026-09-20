// 엔진 고르기. 세 줄짜리 함수지만 세 줄 다 실기에서만 드러나는 것을 막는다:
// ① 순서가 뒤집히면 **모두가** 수십 배 느린 소프트웨어 길로 간다(빠른 기계에서는 티가 안 난다),
// ② 마지막 줄이 틀리면 못 굽는 기기가 내보내기를 눌러 놓고 오류만 본다.
import { describe, expect, it } from 'vitest';
import { chooseVideoEngine } from './videoEngine.ts';

describe('chooseVideoEngine', () => {
  it('내장 코덱이 있으면 wasm 이 있어도 내장을 쓴다 — 소프트웨어 인코딩은 수십 배 느리다', () => {
    expect(chooseVideoEngine({ webcodecsAvc: true, wasm: true })).toBe('webcodecs');
  });

  it('내장 코덱이 없으면 wasm 으로 내려간다 — WebKitGTK 에 GStreamer H.264 가 없는 기계가 이 길이다', () => {
    expect(chooseVideoEngine({ webcodecsAvc: false, wasm: true })).toBe('wasm');
  });

  it('둘 다 없으면 null — 시트가 항목을 비활성으로 보이는 유일한 근거다', () => {
    expect(chooseVideoEngine({ webcodecsAvc: false, wasm: false })).toBeNull();
  });
});
