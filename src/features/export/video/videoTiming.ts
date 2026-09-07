// 영상(MP4) 내보내기의 **시간 계산**. 순수 함수만 있다(DOM·인코더·캔버스 없음).
// 정본 docs/PLAN-VIDEO-EXPORT.md 결정 4(타이밍)·6(비트레이트)·11(순수 로직 분리).
//
// 왜 encodeDrillVideo.ts 에서 떼어 놓나: 그쪽은 jsdom 이 볼 수 없어(캔버스도 VideoEncoder 도
// 없다) 테스트를 붙이지 않는다. 프레임 수를 하나 틀리면 마지막 정지 포즈가 통째로 빠지고,
// 그건 실기에서도 "끝이 좀 짧네" 로만 보여 놓치기 쉽다 — 그래서 셀 수 있는 것만 여기로 뺀다.

/** 초당 프레임 수. 고정이다(배속·루프는 파일에 의미가 없다 — 결정 4).
 *  30 은 seamless 로 이어 붙인 스텝 체인이 끊겨 보이지 않는 최저선이다. */
export const VIDEO_FPS = 30;

/** 비트레이트 계수(bit / (px·프레임)). 단색 그래픽 기준이라 사진보다 훨씬 낮게 잡는다 —
 *  720p ≈ 1.9 Mbps, 1080p ≈ 4.4 Mbps. 실기에서 흐리면 **이 값만** 올린다(결정 6). */
export const VIDEO_BITRATE_COEF = 0.07;

/** 프레임이 찍히는 시각(ms) 목록. `t_i = i·1000/fps`, 개수 `N = ceil(total·fps/1000) + 1`.
 *
 *  `+1` 이 하는 일: 마지막 프레임을 **t = total 이후**로 보내 드릴의 마지막 정지 포즈를 한 장
 *  담는다. 이 한 장이 없으면 영상이 마지막 동작이 끝나기 직전에 잘린다. 그 프레임의 시각은
 *  total 을 넘길 수 있는데, `sampleDrill` 이 `loop:false` 에서 total 로 잘라 주므로(playback.ts)
 *  여기서 따로 자르지 않는다 — **간격이 고르지 않은 타임스탬프는 인코더가 싫어한다.**
 *
 *  totalMs 가 0 이하면(스텝 0개) 프레임 한 장([0])이다 — 빈 파일보다 낫다. */
export function videoFrameTimes(totalMs: number, fps: number): number[] {
  const n = Math.max(0, Math.ceil((Math.max(0, totalMs) * fps) / 1000)) + 1;
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = (i * 1000) / fps;
  return out;
}

/** 목표 비트레이트(bps). 화소 수·프레임 수에 비례한다 — 해상도를 올리면 자동으로 따라 오른다. */
export function videoBitrate(w: number, h: number, fps: number): number {
  return Math.round(w * h * fps * VIDEO_BITRATE_COEF);
}
