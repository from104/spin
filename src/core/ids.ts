// §3.1 ID. 접두사 기반 브랜드 문자열 타입 + 생성기.
export type IdPrefix = 'dr' | 'se' | 'st' | 'ch' | 'bl' | 'cn' | 'ar' | 'nt' | 'sh' | 'it' | 'ph' | 'pl' | 'fh';
export type Id<P extends IdPrefix> = `${P}_${string}`;
export type DrillId = Id<'dr'>;
export type SessionId = Id<'se'>;
export type StepId = Id<'st'>;
export type ChairId = Id<'ch'>;
export type BallId = Id<'bl'>;
export type ConeId = Id<'cn'>;
export type ArrowId = Id<'ar'>;
export type NoteId = Id<'nt'>;
/** 작도 도형(타원·정삼각형·직사각형) — 2026-08-14. */
export type ShapeId = Id<'sh'>;
export type ItemId = Id<'it'>;
/** 세션 구획(phase) — Session v2 (2026-08-18 구조 개편). */
export type PhaseId = Id<'ph'>;
/** 로스터 선수 — 구조 개편 3차. */
export type PlayerId = Id<'pl'>;
/** 자유 그리기 획(freehand) — 2026-09-03. 접두가 'st'(스텝)·'sh'(도형)와 겹치지 않게 'fh' 다.
 *  ⚠️ **`CastId` 에 넣지 않는다** — 획은 화살표·메모·도형과 같은 부류로 스텝이 통째로 소유하고,
 *  cast(정의 + 스텝별 좌표)라는 두 겹 구조를 갖지 않는다. */
export type StrokeId = Id<'fh'>;
export type CastId = ChairId | BallId | ConeId;

const base36 = (n: number, width: number): string => n.toString(36).padStart(width, '0');

/** crypto.randomUUID 미사용 근거: 사설 IP http(체육관 LAN)가 secure context 가 아니라는 점뿐.
 *  crypto.getRandomValues 는 insecure context 에서도 동작하므로 이 폴백은 유효하다. */
const randBase36 = (width: number): string => {
  const max = 36 ** width;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return base36(buf[0] % max, width);
};

// 같은 생성기(모듈) 안에서 동일 ms 안에 뽑는 시퀀스. 1296(=36^2)개까지 무충돌.
let lastTimeMs = -1;
let seq = 0;

/** 17자: 접두(2) + '_' + time36(8) + seq36(2) + rand36(4) */
export function newId<P extends IdPrefix>(prefix: P): Id<P> {
  const now = Date.now();
  if (now === lastTimeMs) {
    seq = (seq + 1) % 1296;
  } else {
    lastTimeMs = now;
    seq = 0;
  }
  const time36 = base36(now, 8);
  const seq36 = base36(seq, 2);
  const rand36 = randBase36(4);
  return `${prefix}_${time36}${seq36}${rand36}` as Id<P>;
}

/** 길이를 하드코딩하지 않는다. 2059년 시계·RTC 고장 기기의 id 도 받아들여야 한다. */
export function isId<P extends IdPrefix>(v: unknown, p: P): v is Id<P> {
  return (
    typeof v === 'string' &&
    v.length >= 4 &&
    v.length <= 64 &&
    v.startsWith(p + '_') &&
    /^[0-9a-z_]+$/.test(v)
  );
}
