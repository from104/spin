// §7.5a 화면 골격 — 본문으로 건너뛰기 링크. main 화면은 `<main id="main" tabIndex={-1}>` 로 받는다.
//
// ⚠️ C4(해시 라우터, 2026-08-18) — **기본 앵커 점프를 막고 프로그램으로 포커스한다.**
// 해시 라우터에서 주소의 해시(#/drills 등)가 곧 화면이라, `href="#main"` 기본 동작이 해시를
// 갈아치우면 라우터가 'main' 을 경로로 읽어 **화면이 전술판으로 튄다.** href 는 남긴다 —
// 링크 role·"어디로 가는가" 노출은 접근성 계약이고, 이동 자체만 preventDefault 로 대신한다.
export function SkipLink() {
  return (
    <a
      className="skip-link"
      href="#main"
      onClick={(e) => {
        e.preventDefault();
        document.getElementById('main')?.focus();
      }}
    >
      본문으로 건너뛰기
    </a>
  );
}
