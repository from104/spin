// §6.9 재생 — render-stage(§8 소유)의 ChairChip/BallDot/ConeMark 는 opacity 를 지원하지 않는다
// (편집기에는 등장/퇴장 페이드가 필요 없어서다). 그 파일들을 고칠 권한은 없으므로(§8), 대신
// 그 컴포넌트를 감싸는 바깥 `<g>` 하나를 present 가 직접 소유하고 이 writer 로 opacity 만
// 60fps DOM 직접기록한다 — `src/render/transformWriter.ts` 의 구현 요건(§6.2)과 동일한 이유로
// (React state 로 만들면 매 프레임 리렌더가 상위로 번진다) 여기도 클로저 지역 함수 + 숫자
// 우선비교 + register 시 즉시 기록을 그대로 따른다.
export interface OpacityWriter {
  register(id: string, el: SVGElement | null): void;
  write(id: string, opacity: number): void;
  clear(): void;
}

const EPS = 0.01;

export function createOpacityWriter(): OpacityWriter {
  const els = new Map<string, SVGElement>();
  const prev = new Map<string, number>();
  const last = new Map<string, number>();

  function register(id: string, el: SVGElement | null): void {
    if (!el) {
      els.delete(id);
      return;
    }
    els.set(id, el);
    const o = last.get(id);
    if (o !== undefined) {
      el.style.opacity = String(o);
      prev.set(id, o);
    }
  }

  function write(id: string, opacity: number): void {
    last.set(id, opacity);
    const p = prev.get(id);
    if (p !== undefined && Math.abs(p - opacity) < EPS) return;
    prev.set(id, opacity);
    const el = els.get(id);
    if (el) el.style.opacity = String(opacity);
  }

  function clear(): void {
    els.clear();
    prev.clear();
    last.clear();
  }

  return { register, write, clear };
}
