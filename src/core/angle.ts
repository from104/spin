// 각도 유틸. §2.3. 각도 0 = +x, 양수 = 화면상 시계방향 (SVG y-down, matter 부호와 일치).
export const TAU = Math.PI * 2;
export const DEG = 180 / Math.PI;
export const RAD = Math.PI / 180;

/** [-π, π) 로 정규화. 실측 확인: wrapPi(Math.PI) === -Math.PI */
export function wrapPi(a: number): number {
  let x = (a + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
}
export const shortestDelta = (from: number, to: number): number => wrapPi(to - from);
export const lerpAngle = (a: number, b: number, t: number): number => a + shortestDelta(a, b) * t;

/** 저장용: rad(연속) -> deg, [-180,180), 0.1° 반올림 */
export const radToStoredDeg = (rad: number): number => Math.round(wrapPi(rad) * DEG * 10) / 10;
/** 로드용: deg -> rad. 저장값이 랩돼 있으므로 그대로 통과 */
export const storedDegToRad = (deg: number): number => deg * RAD;

/** 90° 원호를 3차 Hermite 로 근사할 때 오차를 최소화하는 접선 계수.
 *  K(φ) = 2·tan(φ/4)/sin(φ/2).  검산: 0°→1, 30°→1.017332, 60°→1.071797,
 *  90°→1.171573, 120°→1.333333, 180°→2.
 *  실측(R=100, 90°): K=1.171573 → 최대 반경오차 0.027 px / K=0.55 → 15.539 px */
export function arcTangentK(dTheta: number): number {
  const p = Math.abs(dTheta);
  if (p < 1e-4) return 1;
  return (2 * Math.tan(p / 4)) / Math.sin(p / 2);
}
