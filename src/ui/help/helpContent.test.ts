// 도움말 콘텐츠 계약 — PLAN-HELP-OVERHAUL 결정 3.
//
// 왜 있나. 옛 도움말에는 콘텐츠를 지키는 것이 하나도 없었고, 그 사이 en/ja 가 ko 와 갈라진 채
// 몇 달을 갔다([보드 설정] 개편이 ko 에만 반영, F5). 로케일 셋을 사람이 눈으로 맞추는 것은
// 이미 실패한 방법이므로 기계가 잰다.
//
// **무엇을 재지 않는가가 더 중요하다.** 주제 목록(§2.1)을 이 파일에 베껴 와 대조하지 않는다 —
// 검사표에 손으로 적은 데이터를 넣으면 그 파일이 다음 드리프트의 발원지가 된다(AGENTS §3).
// 여기서 재는 것은 **로케일 사이의 일치**와 **빈 껍데기가 아님** 뿐이고, "어떤 주제가 있어야
// 하는가" 의 정본은 계획서 §2.1 과 `helpContent.ko.ts` 다.
//
// 실패 메시지는 로케일·주제 id 를 실어 보낸다 — "세 로케일 어딘가가 다르다" 만으로는 어느
// 파일을 열지 알 수 없다.
import { describe, expect, it } from 'vitest';
import { HELP_KEY_SCOPES, helpContentFor } from './helpContent.ts';
import type { HelpBlock } from './helpContent.ts';
import { HELP_SECTION_ORDER } from './helpSections.ts';
import { SUPPORTED_LOCALES } from '../../i18n/locale.ts';

type Loc = (typeof SUPPORTED_LOCALES)[number];

/** 로케일 하나의 주제 id 를 섹션 순서대로 편 것. 집합이 아니라 **순서까지** 본다 — 목차가
 *  로케일마다 다른 순서로 서면 같은 화면을 두고 대화가 안 된다. */
function topicIds(locale: Loc): readonly string[] {
  const content = helpContentFor(locale);
  return HELP_SECTION_ORDER.flatMap((key) => content[key].topics.map((t) => t.id));
}

function inlineTexts(block: HelpBlock): readonly string[] {
  switch (block.kind) {
    case 'p':
    case 'h':
    case 'tip':
      return [block.text];
    case 'steps':
    case 'list':
      return block.items;
    // keys 는 문장이 없다 — 표는 keymap 에서 파생된다.
    case 'keys':
      return [];
  }
}

describe('도움말 콘텐츠', () => {
  it('세 로케일의 주제 id 가 순서까지 같다', () => {
    const ko = topicIds('ko');
    expect(topicIds('en')).toEqual(ko);
    expect(topicIds('ja')).toEqual(ko);
  });

  it('섹션마다 주제가 하나 이상 있다', () => {
    const empty = SUPPORTED_LOCALES.flatMap((locale) => HELP_SECTION_ORDER.filter((key) => helpContentFor(locale)[key].topics.length === 0).map((key) => `${locale}/${key}`));
    expect(empty).toEqual([]);
  });

  it('주제마다 블록이 하나 이상 있고 제목이 비어 있지 않다', () => {
    const bad: string[] = [];
    for (const locale of SUPPORTED_LOCALES) {
      const content = helpContentFor(locale);
      for (const key of HELP_SECTION_ORDER) {
        for (const topic of content[key].topics) {
          if (topic.blocks.length === 0) bad.push(`${locale}/${topic.id}: 블록 0`);
          if (topic.title.trim() === '') bad.push(`${locale}/${topic.id}: 제목 빔`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('p·h·steps·list·tip 의 문장이 비어 있지 않다', () => {
    const bad: string[] = [];
    for (const locale of SUPPORTED_LOCALES) {
      const content = helpContentFor(locale);
      for (const key of HELP_SECTION_ORDER) {
        for (const topic of content[key].topics) {
          for (const block of topic.blocks) {
            if (inlineTexts(block).some((text) => text.trim() === '')) bad.push(`${locale}/${topic.id}: ${block.kind}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('keys 블록의 scope 는 표를 만들 수 있는 값뿐이다', () => {
    const bad: string[] = [];
    for (const locale of SUPPORTED_LOCALES) {
      const content = helpContentFor(locale);
      for (const key of HELP_SECTION_ORDER) {
        for (const topic of content[key].topics) {
          for (const block of topic.blocks) {
            if (block.kind === 'keys' && !HELP_KEY_SCOPES.includes(block.scope)) bad.push(`${locale}/${topic.id}: ${block.scope}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
