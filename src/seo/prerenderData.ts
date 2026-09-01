// SEO C2 — **프리렌더가 구울 페이지 목록의 단일 출처** (2026-09-02).
//
// 왜 이 파일이 필요한가: 앱은 클라이언트에서 그려진다. 구글은 JS 를 실행하긴 하지만 그건
// **2차 크롤**이고, 밀리고 자주 건너뛴다. 규칙 해설은 앱 상태와 아무 상관 없는 고정 텍스트라
// 빌드 때 정적 HTML 로 구워 두면 그 불확실성이 통째로 사라진다.
//
// **본문을 여기서 새로 쓰지 않는다.** `ruleTopicsFor(locale)` 이 화면에 그리는 바로 그 데이터를
// 읽어서 문단으로 편다 — 두 벌을 만들면 한쪽만 고쳐지고, 그때 검색 결과에는 옛 문장이 남는다.
//
// 이 모듈은 **React 를 안 쓴다**(순수 데이터 → 문자열). scripts/prerender.mjs 가 SSR 빌드로
// 한 번 굽고 노드에서 부른다.
import { SUPPORTED_LOCALES } from '../i18n/locale.ts';
import type { Locale } from '../i18n/locale.ts';
import { misconductCardsFor, ruleTopicsFor } from '../features/rules/ruleTopics.ts';
import { ruleContentFor } from '../features/rules/ruleContent.ts';

export const SITE_ORIGIN = 'https://spin.atit.app';

/** 언어별 사이트 문구. `manifest.webmanifest` 의 한국어 설명과 **같은 뜻**을 유지한다.
 *  여기 있는 이유: 앱 UI 문구가 아니라 검색 결과·공유 카드에만 쓰이는 글이라, i18n 사전에
 *  넣으면 화면 어디에도 안 뜨는 키가 세 벌 늘어난다. */
interface SiteText {
  /** `<html lang>` 과 `hreflang` 에 그대로 들어간다. */
  readonly htmlLang: string;
  readonly ogLocale: string;
  readonly siteTitle: string;
  readonly siteDescription: string;
  readonly rulesTitle: string;
  readonly rulesDescription: string;
  /** 프리렌더 본문 아래에 붙는 "앱으로" 링크 글. */
  readonly openApp: string;
  readonly rulesHome: string;
}

const SITE: Record<Locale, SiteText> = {
  ko: {
    htmlLang: 'ko',
    ogLocale: 'ko_KR',
    siteTitle: 'SPIN — 파워체어 풋볼 드릴 플래너',
    siteDescription:
      '파워체어 풋볼(전동휠체어 축구) 전용 전술판. 드릴을 만들어 팀 앞에서 시연하고, 경기 규칙을 그림과 시연 장면으로 배웁니다. 설치도 가입도 없이 브라우저에서 바로 열립니다.',
    rulesTitle: '파워체어 풋볼 규칙 — 카드 아홉 장으로',
    rulesDescription:
      '파워체어 풋볼 경기 규칙을 아홉 개 주제로 나눠 그림과 시연 장면으로 설명합니다. 코트와 장비, 게임의 목적, 2대1, 골 에어리어 3인, 반칙과 재개, 18개조 규칙 부록까지.',
    openApp: '전술판 열기',
    rulesHome: '규칙 카드 전체 보기',
  },
  en: {
    htmlLang: 'en',
    ogLocale: 'en_US',
    siteTitle: 'SPIN — Powerchair Football Drill Planner',
    siteDescription:
      'A tactic board built for powerchair football. Draw drills, present them to your team, and learn the Laws of the Game through diagrams and animated scenes. Runs in the browser — no install, no sign-up.',
    rulesTitle: 'Powerchair Football Rules — in Nine Cards',
    rulesDescription:
      'The Laws of powerchair football explained in nine topics, with diagrams and animated scenes: the court and equipment, the object of the game, 2-on-1, three in the goal area, fouls and restarts, plus the full 18-Law appendix.',
    openApp: 'Open the tactic board',
    rulesHome: 'See all rule cards',
  },
  ja: {
    htmlLang: 'ja',
    ogLocale: 'ja_JP',
    siteTitle: 'SPIN — 電動車椅子サッカーの作戦盤',
    siteDescription:
      'パワーチェアーサッカー（電動車椅子サッカー）専用の作戦盤。ドリルを作ってチームの前で見せられます。競技規則は図解とアニメーションで学べます。インストールも登録も不要、ブラウザだけで動きます。',
    rulesTitle: 'パワーチェアーサッカーのルール — 9枚のカードで',
    rulesDescription:
      'パワーチェアーサッカーの競技規則を9つのテーマに分け、図解とアニメーションで説明します。コートと用具、ゲームの目的、2対1、ゴールエリア3人、反則と再開、18条の付録まで。',
    openApp: '作戦盤を開く',
    rulesHome: 'ルールカードを全部見る',
  },
};

/** 한국어는 뿌리, 나머지는 접두사 — `localePrefix.ts` 의 규칙과 **같은 뜻**이어야 한다.
 *  (저쪽은 런타임에 주소를 읽고, 이쪽은 빌드 때 주소를 만든다.) */
function prefixOf(locale: Locale): string {
  return locale === 'ko' ? '' : `/${locale}`;
}

/** 프리렌더 주소는 **항상 슬래시로 끝난다.**
 *
 *  구운 결과가 `dist/rules/two-on-one/index.html` 이라 아파치에게 그 주소는 디렉터리다.
 *  슬래시 없이 요청하면 mod_dir 이 슬래시 붙은 주소로 **301** 을 보낸다(DirectorySlash 기본값).
 *  그러면 우리가 적은 canonical(슬래시 없음)과 크롤러가 최종적으로 도착한 주소(슬래시 있음)가
 *  달라지고, 구글은 자기가 도착한 쪽을 택한다 — canonical 이 무시된다는 뜻이다.
 *
 *  그래서 canonical·hreflang·사이트맵·프리렌더 본문의 링크를 **전부** 슬래시 형태로 맞춘다.
 *  앱 안에서 `navigate()` 가 만드는 주소는 슬래시가 없지만 그쪽은 서버를 안 거치므로 상관없고,
 *  주소창을 복사해 붙여 넣는 경우에만 301 한 번을 탄다. */
function pageUrl(prefix: string, path: string): string {
  return `${prefix}${path}/`.replace(/\/{2,}/g, '/');
}

export interface PrerenderPage {
  /** 원점 뒤의 절대 경로. `/ja/rules/two-on-one` 처럼. */
  readonly url: string;
  readonly locale: Locale;
  readonly htmlLang: string;
  readonly ogLocale: string;
  readonly title: string;
  readonly description: string;
  /** `#root` 안에 들어갈 크롤러용 본문. 이스케이프까지 끝난 HTML 이다. */
  readonly body: string;
  /** JSON-LD 객체(문자열화 전). */
  readonly jsonLd: unknown;
  /** 같은 내용의 다른 언어판 — `hreflang` 을 만든다. */
  readonly alternates: readonly { readonly hreflang: string; readonly url: string }[];
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 규칙 주제 하나를 문단으로 편다. 화면에 **글로 뜨는 블록만** 가져온다 — 도해·장면은 그림이라
 *  텍스트가 없고, `scene-slot` 은 화면에도 안 뜨는 자리표시자다(그걸 실으면 검색 결과에
 *  "준비 중" 이 노출된다). 실려 나가는 것과 화면에 보이는 것이 어긋나면 그게 곧 클로킹이다. */
function topicBody(locale: Locale, topicKey: string): { title: string; tagline: string; html: string; text: string } {
  const topic = ruleTopicsFor(locale).find((t) => t.key === topicKey);
  if (!topic) throw new Error(`알 수 없는 규칙 주제: ${locale}/${topicKey}`);
  const parts: string[] = [];
  const plain: string[] = [];
  for (const block of topic.blocks) {
    if (block.kind === 'prose') {
      if (block.heading) parts.push(`<h2>${esc(block.heading)}</h2>`);
      for (const p of block.body) {
        parts.push(`<p>${esc(p)}</p>`);
        plain.push(p);
      }
    } else if (block.kind === 'card-list') {
      // 경고·퇴장 카드 목록. 화면에서는 배지 달린 목록이고, 여기서는 <ul> 이다. 블록 자체는
      // 데이터를 안 들고 있다(`{ kind:'card-list' }` 뿐) — 화면과 같은 출처에서 꺼낸다.
      parts.push('<ul>');
      for (const c of misconductCardsFor(locale)) {
        parts.push(`<li>${esc(c.text)}</li>`);
        plain.push(c.text);
      }
      parts.push('</ul>');
    } else if (block.kind === 'law-index') {
      // 18개조 부록. 조문 제목과 요약은 검색에서 가장 많이 찾는 글이라 반드시 싣는다.
      for (const law of ruleContentFor(locale)) {
        parts.push(`<h3>${esc(law.title)}</h3>`);
        for (const s of law.summary) {
          parts.push(`<p>${esc(s)}</p>`);
          plain.push(s);
        }
      }
    }
    // `figure`·`scene` 은 그림이라 글이 없고, `scene-slot` 은 화면에도 안 뜨는 자리표시자다
    // (실으면 검색 결과에 "준비 중" 이 노출된다). `restart-table` 은 격자 비교표라 줄글로
    // 펴면 뜻이 무너진다 — 그 내용은 재개 주제의 산문이 이미 말로 설명하고 있다.
  }
  return { title: topic.title, tagline: topic.tagline, html: parts.join('\n'), text: plain.join(' ') };
}

/** 설명문은 160자 근처에서 자른다 — 그 뒤는 검색 결과에 안 보인다. 문장 중간에서 끊기지
 *  않도록 마지막 문장 끝을 찾고, 못 찾으면 그냥 자르고 말줄임을 붙인다. */
function clip(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('다. '), cut.lastIndexOf('。'));
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}

function alternatesFor(pathAfterPrefix: string): PrerenderPage['alternates'] {
  const list = SUPPORTED_LOCALES.map((l) => ({
    hreflang: SITE[l].htmlLang,
    url: `${SITE_ORIGIN}${pageUrl(prefixOf(l), pathAfterPrefix)}`,
  }));
  // x-default = 언어를 안 가리는 기본판. 뿌리(한국어)를 준다.
  return [...list, { hreflang: 'x-default', url: `${SITE_ORIGIN}${pageUrl('', pathAfterPrefix)}` }];
}

/** 구울 페이지 전부. 3언어 × (홈 + 규칙 카드 홈 + 주제 9개). */
export function prerenderPages(): PrerenderPage[] {
  const out: PrerenderPage[] = [];

  for (const locale of SUPPORTED_LOCALES) {
    const site = SITE[locale];
    const prefix = prefixOf(locale);
    const topics = ruleTopicsFor(locale);

    // ── 홈 ──────────────────────────────────────────────────────────────────
    out.push({
      url: pageUrl(prefix, ''),
      locale,
      htmlLang: site.htmlLang,
      ogLocale: site.ogLocale,
      title: site.siteTitle,
      description: site.siteDescription,
      body: [
        `<h1>${esc(site.siteTitle)}</h1>`,
        `<p>${esc(site.siteDescription)}</p>`,
        `<p><a href="${pageUrl(prefix, '/rules')}">${esc(site.rulesHome)}</a></p>`,
      ].join('\n'),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'SPIN',
        alternateName: site.siteTitle,
        description: site.siteDescription,
        url: `${SITE_ORIGIN}${pageUrl(prefix, '')}`,
        applicationCategory: 'SportsApplication',
        operatingSystem: 'Web',
        inLanguage: site.htmlLang,
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
      },
      alternates: alternatesFor('/'),
    });

    // ── 규칙 카드 홈 ────────────────────────────────────────────────────────
    out.push({
      url: pageUrl(prefix, '/rules'),
      locale,
      htmlLang: site.htmlLang,
      ogLocale: site.ogLocale,
      title: `${site.rulesTitle} · SPIN`,
      description: site.rulesDescription,
      body: [
        `<h1>${esc(site.rulesTitle)}</h1>`,
        `<p>${esc(site.rulesDescription)}</p>`,
        '<ul>',
        ...topics.map(
          (t) => `<li><a href="${pageUrl(prefix, `/rules/${t.key}`)}"><strong>${esc(t.title)}</strong></a> — ${esc(t.tagline)}</li>`,
        ),
        '</ul>',
        `<p><a href="${pageUrl(prefix, '')}">${esc(site.openApp)}</a></p>`,
      ].join('\n'),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: site.rulesTitle,
        description: site.rulesDescription,
        url: `${SITE_ORIGIN}${pageUrl(prefix, '/rules')}`,
        inLanguage: site.htmlLang,
        hasPart: topics.map((t) => ({
          '@type': 'Article',
          headline: t.title,
          url: `${SITE_ORIGIN}${pageUrl(prefix, `/rules/${t.key}`)}`,
        })),
      },
      alternates: alternatesFor('/rules'),
    });

    // ── 주제 상세 ───────────────────────────────────────────────────────────
    for (const topic of topics) {
      const { title, tagline, html, text } = topicBody(locale, topic.key);
      const path = `/rules/${topic.key}`;
      out.push({
        url: pageUrl(prefix, path),
        locale,
        htmlLang: site.htmlLang,
        ogLocale: site.ogLocale,
        title: `${title} · SPIN`,
        description: clip(`${tagline} ${text}`),
        body: [
          `<h1>${esc(title)}</h1>`,
          `<p>${esc(tagline)}</p>`,
          html,
          `<p><a href="${pageUrl(prefix, '/rules')}">${esc(site.rulesHome)}</a></p>`,
        ].join('\n'),
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: title,
          description: clip(`${tagline} ${text}`),
          url: `${SITE_ORIGIN}${pageUrl(prefix, path)}`,
          inLanguage: site.htmlLang,
          isPartOf: { '@type': 'CollectionPage', name: site.rulesTitle, url: `${SITE_ORIGIN}${pageUrl(prefix, '/rules')}` },
        },
        alternates: alternatesFor(path),
      });
    }
  }

  return out;
}
