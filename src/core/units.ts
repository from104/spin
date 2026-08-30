// 좌표계·단위 변환. §2.1~2.2. 월드 = SVG user unit(px). 1 m = 25 px.
export const PX_PER_M = 25;
export const mToPx = (m: number): number => m * PX_PER_M;
export const kmhToPxPerS = (kmh: number): number => (kmh / 3.6) * PX_PER_M;

// 2026-08-31 위생 청소로 뺀 역방향 3형제 — 호출자가 하나도 없었다. 되살릴 일이 생기면 한 줄이다:
//   M_PER_PX = 1 / PX_PER_M (0.04) · pxToM = px * M_PER_PX · pxPerSToKmh = (v / PX_PER_M) * 3.6
// 계약이 아니라 편의 함수였다 — 실제 코드는 전부 정방향(m·km/h → px)으로만 흐른다.

/** matter.js 의 속도 단위는 px/s 가 아니라 px per Body._baseDelta(**16.667 ms** = 1000/60) 다.
 *  그래서 두 변환이 60 을 쓴다. 실측: setVelocity(b,{x:5,y:0}) -> 300.00 px/s.
 *  setVelocity(b,{x:300}) -> 18,000 px/s. (그 값을 담고만 있던 `MATTER_BASE_DELTA_MS` 상수는
 *  읽는 이가 없어 2026-08-31 에 뺐다 — 근거는 이 주석에 남는다.) */
export const pxPerSToMatterV = (v: number): number => v / 60;
export const matterVToPxPerS = (v: number): number => v * 60;

export interface Vec2 {
  x: number;
  y: number;
}
