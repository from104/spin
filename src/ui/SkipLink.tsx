// §7.5a 화면 골격 — 본문으로 건너뛰기 링크. main 화면은 `<main id="main" tabIndex={-1}>` 로 받는다.
export function SkipLink() {
  return (
    <a className="skip-link" href="#main">
      본문으로 건너뛰기
    </a>
  );
}
