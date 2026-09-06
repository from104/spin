#!/usr/bin/env node
//
// SEO C2 — **정적 HTML 굽기 + robots.txt · sitemap.xml** (2026-09-02)
//
// ── 무엇을 하는가 ────────────────────────────────────────────────────────────────────
// `vite build` 가 만든 `dist/index.html` 을 틀로 삼아, 언어 × 페이지마다 하나씩 굽는다
// (3 × 13 = 39장 — 홈 + 규칙 카드 홈 + 주제 9 + 방침·약관 2). 각 페이지에는
//   · 그 페이지의 `<title>` · `<meta description>` · canonical · hreflang · OG
//   · 크롤러가 읽을 **본문 텍스트**(`#root` 안)
//   · JSON-LD 구조화 데이터
// 가 들어간다.
//
// ── 왜 `#root` 안에 넣는가 ───────────────────────────────────────────────────────────
// `createRoot(...).render()` 는 컨테이너의 기존 자식을 **지우고** 그린다(hydrate 가 아니다).
// 그래서 크롤러와 JS 가 꺼진 사람은 본문을 보고, 앱이 뜨는 순간 React 가 그 자리를 가져간다.
// 하이드레이션 불일치 경고가 원리적으로 생기지 않는 게 이 방식의 값이다.
//
// ── 왜 별도 SSR 빌드를 거치는가 ──────────────────────────────────────────────────────
// 본문의 출처는 `src/features/rules/ruleTopics.ts` — 화면이 쓰는 바로 그 데이터다(두 벌을
// 만들면 한쪽만 고쳐지고, 그때 검색 결과에 옛 문장이 남는다). 노드는 TS 를 못 읽으므로
// `vite build --ssr` 로 한 번 굽고(`.seo-build/`) 그 결과를 import 한다. tsx·esbuild 같은
// 새 의존성을 안 들이려고 **이미 있는 vite** 를 쓴다.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');

// 2026-09-06: 데스크톱(Tauri) 빌드는 프리렌더를 굽지 않는다. 검색엔진이 볼 일이 없고, 품은
// index.html 의 프리렌더 글이 앱 로더 앞에 잠깐 비치는 부작용만 남기 때문이다. Tauri CLI 가
// beforeBuildCommand 에 TAURI_ENV_PLATFORM 을 심는다(vite.config.ts 의 envPrefix 와 같은 신호).
// 이 덕에 데스크톱 dist 에는 .seo-prerender 가 아예 없어 첫 부팅은 항상 배경색 → 로더다.
if (process.env.TAURI_ENV_PLATFORM !== undefined) {
  console.log('프리렌더 건너뜀 — 데스크톱 빌드(TAURI_ENV_PLATFORM)');
  process.exit(0);
}

const { prerenderPages, SITE_ORIGIN } = await import(join(ROOT, '.seo-build', 'prerenderData.js'));

const template = await readFile(join(DIST, 'index.html'), 'utf-8');

/** 틀에서 갈아 끼울 구간. `index.html` 의 `<!-- SEO:START -->` ~ `<!-- SEO:END -->` 다. */
const SEO_BLOCK = /<!-- SEO:START[\s\S]*?<!-- SEO:END -->/;
if (!SEO_BLOCK.test(template)) {
  // 조용히 넘어가면 canonical 이 두 벌 실린 33장이 그대로 배포된다. 그건 SEO 를 안 한 것보다
  // 나쁘다 — 그래서 빌드를 세운다.
  throw new Error('dist/index.html 에서 <!-- SEO:START --> ~ <!-- SEO:END --> 를 못 찾았습니다.');
}

/** 틀에서 언어·제목·설명을 갈아 끼우고 머리에 SEO 태그를, `#root` 에 본문을 넣는다.
 *  정규식으로 HTML 을 만지는 것이 일반적으로는 나쁜 생각이지만, 여기서 다루는 것은 우리가
 *  직접 쓴 `index.html` 하나이고 그 모양은 이 저장소가 통제한다 — 임의의 HTML 이 아니다. */
function render(page) {
  const canonical = `${SITE_ORIGIN}${page.url}`;
  const head = [
    `<meta name="description" content="${attr(page.description)}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    ...page.alternates.map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${a.url}" />`),
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="SPIN" />`,
    `<meta property="og:title" content="${attr(page.title)}" />`,
    `<meta property="og:description" content="${attr(page.description)}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${SITE_ORIGIN}/icon-512.png" />`,
    `<meta property="og:locale" content="${page.ogLocale}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<script type="application/ld+json">${JSON.stringify(page.jsonLd)}</script>`,
  ].join('\n    ');

  let html = template;
  html = html.replace('<html lang="ko">', `<html lang="${page.htmlLang}">`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeText(page.title)}</title>`);
  // 틀이 들고 있는 뿌리용 SEO 태그를 **덮어쓰지 않고 걷어낸 뒤** 이 페이지의 것을 넣는다.
  // 덧붙이기만 하면 페이지마다 canonical 이 둘이 되고, 서로 다른 주소를 가리키는 canonical
  // 두 개는 구글이 둘 다 버린다 — 첫 구현이 실제로 그랬다(2026-09-02, 출력을 보고 잡았다).
  html = html.replace(SEO_BLOCK, `${head}\n    <!-- SEO:END -->`);
  // 부팅 로더의 면제 판정(src/app/loader/prerenderLanding.ts)이 이 종류를 읽는다. 홈은 h1 한 줄과
  // 링크뿐이라 "이미 읽을 것을 보고 있다" 에 해당하지 않는다. ⚠️ 2026-09-05 까지는 종류 없이
  // `.seo-prerender` 만 봤고 홈도 프리렌더라 **배포본의 모든 첫 방문이 면제**됐다 — 0.6.3 로더가
  // spin.atit.app 에서 한 번도 안 뜬 이유. 개발 서버는 프리렌더를 안 돌려 거기서만 보였다.
  // 종류는 이 스크립트의 주소 규칙(pageUrl)에서 나온다: `/rules/` 아래가 규칙 글이다.
  // 2026-09-06: 방침·약관도 "이미 읽을 것을 보고 있는" 글이다(PLAN-LEGAL-PAGES 결정 5).
  // 주소는 항상 슬래시로 끝나므로(pageUrl) `/privacy/`·`/ja/terms/` 가 모두 걸리고, 홈
  // (`/`·`/en/`)은 안 걸린다.
  const seoPage = /\/rules\//.test(page.url) ? 'rules' : /\/(privacy|terms)\//.test(page.url) ? 'legal' : 'home';
  html = html.replace(
    '<div id="root"></div>',
    `<div id="root"><div class="seo-prerender" data-seo-page="${seoPage}">\n${page.body}\n</div></div>`,
  );
  return html;
}

function attr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function escapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** `/ja/rules/two-on-one` → `dist/ja/rules/two-on-one/index.html`.
 *  디렉터리 + index.html 꼴이라 아파치가 확장자 없는 주소를 그대로 서빙한다. */
function fileFor(url) {
  const clean = url.replace(/^\/+/, '').replace(/\/+$/, '');
  return clean === '' ? join(DIST, 'index.html') : join(DIST, clean, 'index.html');
}

const pages = prerenderPages();

for (const page of pages) {
  const file = fileFor(page.url);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, render(page), 'utf-8');
}

// ── sitemap.xml ──────────────────────────────────────────────────────────────────────
// 언어판을 서로 `xhtml:link` 로 묶어 준다 — 이게 있어야 구글이 셋을 **중복이 아니라 번역**으로
// 읽는다. 없으면 셋 중 하나만 남기고 나머지를 버린다.
const urlset = pages
  .map((p) => {
    const alts = p.alternates
      .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.url}" />`)
      .join('\n');
    return `  <url>\n    <loc>${SITE_ORIGIN}${p.url}</loc>\n${alts}\n  </url>`;
  })
  .join('\n');

await writeFile(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urlset}\n</urlset>\n`,
  'utf-8',
);

console.log(`프리렌더 ${pages.length}장 + sitemap.xml → dist/`);
for (const p of pages) console.log(`  ${p.url}`);
