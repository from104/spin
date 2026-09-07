// 도움말 콘텐츠 모델 — docs/PLAN-HELP-OVERHAUL.md 결정 1·2·3, 타입은 §2.3 그대로.
//
// 왜 존재하나. 이전 도움말은 i18n 평면 사전의 `{term, desc}` 한 줄 항목 94개였다(F5). 한 줄
// 사전에는 소제목·번호 순서·글머리·키캡을 담을 자리가 없어서 "기능 하나를 처음 배우는 사람에게
// 설명" 이 물리적으로 불가능했고, 로케일 셋이 사전 안에서 조용히 갈라져도 아무도 몰랐다.
// 그래서 규칙 화면이 먼저 간 길(`features/rules/ruleTopics.ts` + `.en/.ja` — 로케일별 파일 +
// `kind` 블록 유니온)을 그대로 따른다: 이 파일은 **타입과 고르는 함수만** 두고, 본문은
// `helpContent.ko.ts` / `.en.ts` / `.ja.ts` 세 파일이 각각 통째로 쥔다.
//
// 무엇을 하면 안 되나.
//  · **블록 종류를 늘리지 않는다.** 여섯(p·h·steps·list·tip·keys)은 초보자 설명서에 필요한
//    최소 집합이고, 늘리는 순간 렌더러·번역·계약 테스트가 함께 늘어난다. 표현이 모자라면
//    문장을 고쳐 쓴다.
//  · **`keys` 블록에 행을 직접 적지 않는다.** `scope` 만 적고 표는 keymap 에서 파생한다 —
//    손으로 적은 단축키 표는 정본이 바뀐 날 조용히 거짓말이 된다(2026-08-16 교훈,
//    `core/keymap.ts` 머리말).
//  · 인라인 서식은 `**굵게**` 와 `` `키` `` 둘뿐이다. 마크다운 파서를 들이지 않는다 —
//    HelpCenter 가 문자열을 split 해 React 노드로 만든다(HTML 주입 경로가 없다).
//  · 로케일 파일 하나가 다른 둘의 re-export 가 되면 안 된다. 그러면 "번역이 아직 없다" 가
//    화면에서 구별되지 않고, `helpContent.test.ts` 의 id 집합 대조도 자동으로 통과해 버린다.
import type { Locale } from '../../i18n/locale.ts';
import type { HelpSectionKey } from './helpSections.ts';
import { HELP_KO } from './helpContent.ko.ts';
import { HELP_EN } from './helpContent.en.ts';
import { HELP_JA } from './helpContent.ja.ts';

/** `**굵게**` 와 `` `키` `` 만 해석되는 문자열. 그 밖의 기호는 글자 그대로 나온다. */
export type HelpInline = string;

/** `keys` 블록이 고르는 표 — 어느 것이든 정본은 `core/keymap.ts` 다. */
export type HelpKeyScope = 'editor' | 'object' | 'board' | 'present' | 'tools';

export const HELP_KEY_SCOPES: readonly HelpKeyScope[] = ['editor', 'object', 'board', 'present', 'tools'];

export type HelpBlock =
  | { kind: 'p'; text: HelpInline }
  | { kind: 'h'; text: string }
  | { kind: 'steps'; items: readonly HelpInline[] }
  | { kind: 'list'; items: readonly HelpInline[] }
  | { kind: 'tip'; tone: 'tip' | 'warn'; text: HelpInline }
  | { kind: 'keys'; scope: HelpKeyScope };

/** 기능 하나 = 주제 하나. `id` 는 `섹션.주제`(§2.1) 이고 **3로케일이 같은 집합**을 가진다 —
 *  화면의 `<article id>` 와 목차 링크가 이 값으로 묶이므로 번역할 때 바꾸면 안 된다. */
export interface HelpTopic {
  id: string;
  title: string;
  blocks: readonly HelpBlock[];
}

export interface HelpSectionContent {
  key: HelpSectionKey;
  intro?: HelpInline;
  topics: readonly HelpTopic[];
}

export type HelpContent = Record<HelpSectionKey, HelpSectionContent>;

const BY_LOCALE: Record<Locale, HelpContent> = { ko: HELP_KO, en: HELP_EN, ja: HELP_JA };

/** 화면이 지금 로케일의 본문을 고른다. 없는 로케일은 타입상 없다(`Locale` 이 셋뿐). */
export function helpContentFor(locale: Locale): HelpContent {
  return BY_LOCALE[locale];
}
