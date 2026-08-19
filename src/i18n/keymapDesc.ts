// i18n C6 — core/keymap.ts 의 KeyDef.desc(한국어)를 화면 언어로 옮긴다. keymap.ts 자체는
// 건드리지 않는다 — 그 파일은 keymap.contract.test.ts 로 촘촘히 묶인 단축키 배선의 정본이지
// 도움말 문구 저장소가 아니고, 문구 번역 때문에 그 계약을 건드릴 이유가 없다. 이 표는 사전이
// 아니라 "원문 → 번역" 대조표라 키가 한국어 원문 그대로다 — 원문이 바뀌면 조용히 원문으로
// 되돌아간다(아래 폴백), 컴파일 에러가 아니다. 사용처가 늘 때(예: 편집기 쪽 단축키 도움말)
// 항목을 더 채운다.
//
// 범위: 지금 실제로 쓰는 곳(scope:'present', HelpOverlay.tsx)만 채웠다.
import type { Locale } from './locale.ts';

const TRANSLATIONS: Record<'en' | 'ja', Record<string, string>> = {
  en: {
    '다음 스텝': 'Next step',
    '이전 스텝': 'Previous step',
    '재생 / 일시정지': 'Play / pause',
    '처음 스텝': 'First step',
    '마지막 스텝': 'Last step',
    '다음 드릴': 'Next drill',
    '이전 드릴': 'Previous drill',
    전체화면: 'Fullscreen',
    '반복 재생': 'Loop playback',
    '화면 끄기': 'Blackout',
    '시연 종료': 'Exit presentation',
    도움말: 'Help',
  },
  ja: {
    '다음 스텝': '次のステップ',
    '이전 스텝': '前のステップ',
    '재생 / 일시정지': '再生 / 一時停止',
    '처음 스텝': '最初のステップ',
    '마지막 스텝': '最後のステップ',
    '다음 드릴': '次のドリル',
    '이전 드릴': '前のドリル',
    전체화면: '全画面表示',
    '반복 재생': 'ループ再生',
    '화면 끄기': '画面を消す',
    '시연 종료': 'プレゼン終了',
    도움말: 'ヘルプ',
  },
};

export function translateKeymapDesc(desc: string, locale: Locale): string {
  if (locale === 'ko') return desc;
  return TRANSLATIONS[locale][desc] ?? desc;
}
