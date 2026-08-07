// 좌표계·단위 변환. §2.1~2.2. 월드 = SVG user unit(px). 1 m = 25 px.
export const PX_PER_M = 25;
export const M_PER_PX = 1 / PX_PER_M; // 0.04
export const mToPx = (m: number): number => m * PX_PER_M;
export const pxToM = (px: number): number => px * M_PER_PX;
export const kmhToPxPerS = (kmh: number): number => (kmh / 3.6) * PX_PER_M;
export const pxPerSToKmh = (v: number): number => (v / PX_PER_M) * 3.6;

/** matter.js 의 속도 단위는 px/s 가 아니라 px per Body._baseDelta(16.667 ms) 다.
 *  실측: setVelocity(b,{x:5,y:0}) -> 300.00 px/s.  setVelocity(b,{x:300}) -> 18,000 px/s. */
export const MATTER_BASE_DELTA_MS = 1000 / 60; // 16.6666667
export const pxPerSToMatterV = (v: number): number => v / 60;
export const matterVToPxPerS = (v: number): number => v * 60;

export interface Vec2 {
  x: number;
  y: number;
}
