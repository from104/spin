// videoTiming — 프레임 시각·개수와 비트레이트. 지우면 새는 버그:
//  ① `+1` 이 빠지면 마지막 정지 포즈가 통째로 빠져 영상이 동작 끝나기 직전에 잘린다(실기에서
//     "끝이 좀 짧네" 로만 보인다 — 인코딩은 성공하므로 아무 경고도 없다).
//  ② 간격이 고르지 않으면(예: 마지막을 total 로 자르면) 인코더가 프레임 시각을 의심한다.
//  ③ 비트레이트가 화소 수에 안 매달리면 1080p 가 720p 와 같은 비트로 나가 뭉개진다.
import { describe, it, expect } from 'vitest';
import { VIDEO_FPS, videoBitrate, videoFrameTimes } from './videoTiming.ts';

describe('videoFrameTimes — 마지막 정지 포즈 한 장을 반드시 남긴다', () => {
  it('개수는 ceil(total·fps/1000) + 1 이고 마지막 시각이 총 길이를 넘어선다', () => {
    const times = videoFrameTimes(1000, 30);
    expect(times.length).toBe(31); // 30 + 1
    expect(times[times.length - 1]).toBeGreaterThanOrEqual(1000);
  });

  it('딱 떨어지지 않는 길이도 올림한다 — 마지막 동작이 잘리지 않는다', () => {
    // 1500 + 600 처럼 딱 떨어지지 않는 총 길이가 실제 드릴에서는 보통이다.
    // 60.99 → 올림 61 + 정지 포즈 1 = 62. 공식을 다시 적지 않고 숫자로 둔다 — 공식을 베끼면
    // 구현과 같이 틀려도 초록이다(2026-09-08 검수).
    expect(videoFrameTimes(2033, 30).length).toBe(62);
    expect(videoFrameTimes(1, 30).length).toBe(2);
  });

  it('간격이 고르다 — 1/fps 초씩', () => {
    const times = videoFrameTimes(500, 30);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]! - times[i - 1]!).toBeCloseTo(1000 / 30, 9);
    }
  });

  it('스텝이 없어(길이 0) 도 한 장은 나온다 — 빈 파일보다 낫다', () => {
    expect(videoFrameTimes(0, VIDEO_FPS)).toEqual([0]);
    expect(videoFrameTimes(-5, VIDEO_FPS)).toEqual([0]);
  });
});

describe('videoBitrate', () => {
  it('화소 수·프레임 수에 비례한다 — 해상도를 올리면 따라 오른다', () => {
    const p720 = videoBitrate(1280, 720, 30);
    const p1080 = videoBitrate(1920, 1080, 30);
    expect(p1080 / p720).toBeCloseTo((1920 * 1080) / (1280 * 720), 6);
    // 720p 는 2 Mbps 언저리, 1080p 는 5 Mbps 언저리 — 단색 그래픽 기준(결정 6).
    expect(p720).toBeGreaterThan(1_500_000);
    expect(p720).toBeLessThan(2_500_000);
    expect(p1080).toBeGreaterThan(3_500_000);
    expect(p1080).toBeLessThan(5_500_000);
  });
});
