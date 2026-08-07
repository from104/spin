// §7.5e — 라이브 리전은 명령형이다 (React state 금지).
// {announcement} state 로 만들면 400ms 스로틀 갱신마다 앱 전체가 리렌더되어 드래그 중
// 롱태스크가 끼어들고 → 프레임 드랍 → dt 급증으로 연쇄된다.
export const liveRegion = {
  el: null as HTMLElement | null,
  seq: 0,
  say(text: string) {
    if (!this.el) return;
    // 중복 문구도 재낭독되도록 매번 널 폭 공백을 토글해 textContent 를 실제로 바꾼다.
    this.el.textContent = this.seq++ % 2 ? text : text + '​';
  },
};

export const LiveRegion = () => (
  <div
    aria-live="polite"
    aria-atomic="true"
    className="sr-only"
    ref={(el) => {
      liveRegion.el = el;
    }}
  />
);
