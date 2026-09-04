// i18n C6/C7 — core/keymap.ts 의 KeyDef.desc(한국어)를 화면 언어로 옮긴다. keymap.ts 자체는
// 건드리지 않는다 — 그 파일은 keymap.contract.test.ts 로 촘촘히 묶인 단축키 배선의 정본이지
// 도움말 문구 저장소가 아니고, 문구 번역 때문에 그 계약을 건드릴 이유가 없다. 이 표는 사전이
// 아니라 "원문 → 번역" 대조표라 키가 한국어 원문 그대로다 — 원문이 바뀌면 조용히 원문으로
// 되돌아간다(아래 폴백), 컴파일 에러가 아니다. 사용처가 늘 때(예: 편집기 쪽 단축키 도움말)
// 항목을 더 채운다.
//
// 범위: C6 이 scope:'present'(HelpOverlay.tsx)를 채웠고, C7 이 scope:'global'·'object'와
// 도구 9종의 "{도구} 도구" 합성 문자열(HelpModal.tsx)을 더했다.
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
    // ── C7 — 도구 9종("{도구} 도구") ──
    '선택 도구': 'Select tool',
    '선 도구': 'Line tool',
    '자유 그리기 도구': 'Freehand tool',
    '원 도구': 'Circle tool',
    '삼각 도구': 'Triangle tool',
    '사각 도구': 'Square tool',
    '공 도구': 'Ball tool',
    '콘 도구': 'Cone tool',
    '선수 도구': 'Player tool',
    '메모 도구': 'Note tool',
    '지우기 도구': 'Erase tool',
    // ── C7 — scope:'global' ──
    '콘 색 바꾸기(주황 ↔ 파랑)': 'Change cone color (orange ↔ blue)',
    '실행 취소': 'Undo',
    '다시 실행': 'Redo',
    저장: 'Save',
    '선택한 개체 복제(도형·메모·화살표)': 'Duplicate selected objects (shapes, notes, arrows)',
    '현재 스텝 복제(개체 선택이 없을 때)': 'Duplicate current step (when nothing is selected)',
    '격자 표시': 'Show grid',
    '골 지역 가이드': 'Goal-area guide',
    확대: 'Zoom in',
    축소: 'Zoom out',
    '배율 100%': 'Zoom 100%',
    '판 이동(팬)': 'Pan the board',
    '선택 해제 — 열린 창이 있으면 그 창만 닫힘': 'Clear selection — if a window is open, closes just that window',
    '전부 선택(잠긴 것 제외)': 'Select all (except locked)',
    '고른 개체 지우기 — 하나든 여럿이든': 'Delete selected objects — one or many',
    '이 도움말': 'This help',
    // ── C7 — scope:'object' ──
    '개체 이동 — Shift 는 큰 걸음': 'Move object — hold Shift for large steps',
    '개체 회전 — Shift 는 큰 걸음': 'Rotate object — hold Shift for large steps',
    '이전 개체로': 'To previous object',
    '다음 개체로': 'To next object',
    '이전 개체를 선택에 더하며 이동': 'Add previous object to selection and move',
    '다음 개체를 선택에 더하며 이동': 'Add next object to selection and move',
    '선택 / 해제': 'Select / deselect',
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
    // ── C7 — 道具9種("{道具} 도구") ──
    '선택 도구': '選択ツール',
    '선 도구': '線ツール',
    '자유 그리기 도구': 'フリーハンドツール',
    '원 도구': '円ツール',
    '삼각 도구': '三角ツール',
    '사각 도구': '四角ツール',
    '공 도구': 'ボールツール',
    '콘 도구': 'コーンツール',
    '선수 도구': '選手ツール',
    '메모 도구': 'メモツール',
    '지우기 도구': '消去ツール',
    // ── C7 — scope:'global' ──
    '콘 색 바꾸기(주황 ↔ 파랑)': 'コーンの色を変更（オレンジ↔青）',
    '실행 취소': '元に戻す',
    '다시 실행': 'やり直す',
    저장: '保存',
    '선택한 개체 복제(도형·메모·화살표)': '選択したオブジェクトを複製（図形・メモ・矢印）',
    '현재 스텝 복제(개체 선택이 없을 때)': '現在のステップを複製（何も選択していないとき）',
    '격자 표시': 'グリッド表示',
    '골 지역 가이드': 'ゴールエリアガイド',
    확대: '拡大',
    축소: '縮小',
    '배율 100%': 'ズーム100%',
    '판 이동(팬)': '盤を移動（パン）',
    '선택 해제 — 열린 창이 있으면 그 창만 닫힘': '選択解除 — 開いているウィンドウがあればそれだけ閉じる',
    '전부 선택(잠긴 것 제외)': 'すべて選択（ロック済みを除く）',
    '고른 개체 지우기 — 하나든 여럿이든': '選択したオブジェクトを削除 — 単数でも複数でも',
    '이 도움말': 'このヘルプ',
    // ── C7 — scope:'object' ──
    '개체 이동 — Shift 는 큰 걸음': 'オブジェクト移動 — Shiftで大きく移動',
    '개체 회전 — Shift 는 큰 걸음': 'オブジェクト回転 — Shiftで大きく回転',
    '이전 개체로': '前のオブジェクトへ',
    '다음 개체로': '次のオブジェクトへ',
    '이전 개체를 선택에 더하며 이동': '前のオブジェクトを選択に追加して移動',
    '다음 개체를 선택에 더하며 이동': '次のオブジェクトを選択に追加して移動',
    '선택 / 해제': '選択 / 解除',
  },
};

export function translateKeymapDesc(desc: string, locale: Locale): string {
  if (locale === 'ko') return desc;
  return TRANSLATIONS[locale][desc] ?? desc;
}

/** keymap.ts 의 label 은 대부분 이미 언어 중립적이다(Ctrl·Shift·PageUp 같은 키 이름, 또는
 *  present.next/prev 처럼 이미 화살표 기호 `→ ↓`) — 그런데 view.pan·obj.move 딱 둘만
 *  "방향키" 라는 한국어 낱말을 그대로 쓴다. desc 와 달리 로케일별 번역 사전을 두지 않는다 —
 *  번역할 말이 아니라 기호로 바꾸면 끝나는 문제라서, 그 한 낱말만 화살표 기호로 바꾼다
 *  (언어를 안 타므로 locale 인자가 없다). */
export function keymapLabel(label: string): string {
  return label.replace('방향키', '←→↑↓');
}
