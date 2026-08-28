// 단축키 **정본**. 배선(디스패처)과 도움말이 둘 다 이 표에서 나온다.
//
// 2026-08-16 전면 개편(기현 지시). 이전에는 정의가 useEditorKeyboard·EditorStage·
// PresentRunner·toolDefs 네 곳에 흩어져 있었고, 도움말 표는 **손으로 따로 적은 목록**이라
// 배선과 따로 놀 수 있었다. 실제로 전술판에는 스텝 키 넷이 죽어 있는데 표에는 적혀 있었다.
// 표를 하나로 모으고 계약 테스트로 묶는다 — `keymap.contract.test.ts`.
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ `KeyboardEvent.code` 를 쓴다. `key` 가 아니다.
//
//   `key` 는 **입력기가 해석한 문자**라 한글 입력 상태에서 V 가 'ㅍ' 로 들어온다. 그래서
//   개편 전에는 한글 모드에서 문자 단축키가 **하나도 안 먹었다**(2026-08-16 확인: 전 코드에
//   `e.code` 사용처 0). `code` 는 물리 키 자리라 입력기·언어와 무관하게 같은 값이 온다.
//
//   대가: 비QWERTY 배열(드보락 등)에서는 자판에 인쇄된 글자와 어긋난다. 도움말에 적는 글자는
//   QWERTY 기준이라는 뜻이다. 한글 사용자가 상시로 겪던 고장을 없애는 값으로는 싸다.
// ─────────────────────────────────────────────────────────────────────────────
//
// 키를 고른 원칙(기현 지시):
//   1. `W A S D` 는 개체 이동, `Q E` 는 개체 회전으로 **고정**. 도구는 이 여섯을 못 쓴다.
//   2. 나머지 도구는 영어 이름 머릿글자. 막히면 다음 글자.
//   3. 보기 토글은 전부 `Alt+글자` — 도구 문자키와 영영 안 섞이고, 토글이 늘어도 자리가 남는다.
//
// 머릿글자 규칙이 막힌 곳과 처리:
//   · 선택(select)  s·e 는 개체 조작이 가져갔고 l·c·t 도 다른 도구가 씀 → `V`. 피그마·
//                   일러스트레이터·XD 가 전부 V 라 외부 관습을 근거로 삼은 **유일한 예외**다.
//   · 원(circle)    콘(cone)과 c 가 겹침 → 도형을 oval 로 보고 `O`. 둘 다 머릿글자로 산다.
//   · 지우개(erase) e·r·a·s 가 전부 막힘 → **도구를 없애고** Delete 로 일원화(2단계).
//
// WCAG 2.1.4 (Character Key Shortcuts, Level A) — DESIGN §7.5f 가 준수 필수로 못 박았다.
// 근거: 음성 인식 사용자가 발화하면 단일 문자키가 연쇄 발화한다. 이 표는 두 층으로 나눠 푼다.
//   · `scope: 'object'` 키(W A S D · Q E · [ ] · Delete) — **개체에 포커스가 있을 때만**
//     동작하므로 2.1.4 의 "Active only on focus" 예외에 해당한다. 설정과 무관하게 산다.
//   · `scope: 'global'` 의 도구 문자키 — 전역이라 예외가 없다. `letterKey: true` 로 표시해
//     두고 디스패처가 `a11y.singleKeyShortcuts` 게이트를 건다.
// 이 구분이 무너지면(예: 개체 키를 전역으로 올리면) 준수도 같이 무너진다.

/** 어느 층의 키인가.
 *  · `global`  — document 전역. 편집기·전술판에서 산다.
 *  · `object`  — 개체에 포커스가 있을 때만. WCAG 2.1.4 포커스 한정 예외의 근거다.
 *  · `present` — 시연 화면 전용. */
export type KeyScope = 'global' | 'object' | 'present';

/** Shift 의 취급.
 *  · `'no'`  — 눌려 있으면 매칭 안 된다(기본값).
 *  · `'yes'` — 눌려 있어야 한다.
 *  · `'any'` — 무관. Shift 가 **다른 동작**이 아니라 **정도**만 바꾸는 키에 쓴다 —
 *              이동·회전이 그렇다(기본 큰 걸음, Shift 면 정밀). 여기를 `'no'` 로 두면
 *              Shift 를 누른 순간 키가 통째로 안 잡혀 정밀 이동이 사라진다. */
export type ShiftRule = 'no' | 'yes' | 'any';

export interface KeyDef {
  /** 동작 식별자. 디스패처가 이것으로 분기한다. */
  readonly id: string;
  readonly scope: KeyScope;
  /** `KeyboardEvent.code` 목록. 하나라도 맞으면 매칭 — 별칭(방향키/숫자패드)을 담는다. */
  readonly codes: readonly string[];
  /** `KeyboardEvent.key` 로도 잡을 값. **구두점 전용 탈출구**다.
   *
   *  구두점은 자리가 배열마다 다르다 — `?` 는 US 에서 Shift+Slash 지만 독일어 자판에서는
   *  Shift+ß 다. 자리로 잡으면 그 사용자에게는 도움말이 영영 안 열린다. 게다가 구두점은
   *  한글 입력 상태에서도 그대로 들어오므로(문자키와 달리) key 로 잡아도 IME 에 안 물린다.
   *  그래서 **문자·숫자에는 절대 쓰지 않는다** — 그것이 이 개편의 요점이다. */
  readonly keys?: readonly string[];
  /** Ctrl 또는 ⌘. 지정 안 하면 **눌리지 않아야** 한다. */
  readonly mod?: boolean;
  /** Alt. 지정 안 하면 눌리지 않아야 한다. */
  readonly alt?: boolean;
  readonly shift?: ShiftRule;
  /** 도움말에 보일 키 표기. 사람이 읽는 문자열이라 `codes` 와 모양이 다를 수 있다. */
  readonly label: string;
  /** 도움말 설명. */
  readonly desc: string;
  /** 수식키 없는 단일 문자키인가 — WCAG 2.1.4 게이트 대상. `scope: 'object'` 는 포커스
   *  한정이라 문자키여도 표시하지 않는다. */
  readonly letterKey?: boolean;
  /** 스텝(시간축)이 있어야 뜻이 있는 키. 전술판은 1장짜리라 여기가 참인 키는 **눌러도
   *  아무 일도 안 난다** — 도움말에서 뺀다. 없는 키를 적어두면 코치는 키가 고장난 줄 안다. */
  readonly needsSteps?: boolean;
}

const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;

/** 도구 선택 키. `tool:<ToolId>` 규약 — `toolDefs` 가 이 접두어로 되짚는다.
 *  core 는 physics 를 모르므로(층 방향) ToolId 를 문자열로만 들고 있는다. */
export const TOOL_KEY_PREFIX = 'tool:';

const toolKey = (tool: string, code: string, letter: string, label: string): KeyDef => ({
  id: `${TOOL_KEY_PREFIX}${tool}`,
  scope: 'global',
  codes: [code],
  label: letter,
  desc: `${label} 도구`,
  letterKey: true,
});

export const KEYMAP: readonly KeyDef[] = [
  // ── 도구 ────────────────────────────────────────────────────────────────
  toolKey('select', 'KeyV', 'V', '선택'),
  toolKey('line', 'KeyL', 'L', '선'),
  toolKey('shapeEllipse', 'KeyO', 'O', '원'),
  toolKey('shapeTriangle', 'KeyT', 'T', '삼각'),
  toolKey('shapeRect', 'KeyR', 'R', '사각'),
  toolKey('ball', 'KeyB', 'B', '공'),
  toolKey('cone', 'KeyC', 'C', '콘'),
  toolKey('player', 'KeyP', 'P', '선수'),
  toolKey('note', 'KeyN', 'N', '메모'),
  // §6.10a — 콘 색 바꾸기가 `C` 재입력에서 **여기로 옮겨 왔다**(2026-08-16). 개편 전에는
  // "콘을 든 채 C 를 다시" 가 색 토글이었는데, 같은 날 *같은 도구를 한 번 더 = 연속 배치
  // 고정* 이 모든 도구의 규칙이 되면서 콘에서만 뜻이 달라졌다 — 마우스로 콘 상자를 두 번
  // 누르면 고정, 키보드로 C 를 두 번 누르면 색 토글. 도구마다 다른 규칙은 배울 수가 없다.
  // 색은 트레이에 상자가 색깔별로 따로 있으므로(마우스는 원래 그렇게 고른다) 키보드에도
  // 자기 키를 준다.
  {
    id: 'tool.coneColor',
    scope: 'global',
    codes: ['KeyC'],
    shift: 'yes',
    label: 'Shift+C',
    desc: '콘 색 바꾸기(주황 ↔ 파랑)',
  },

  // ── 편집 ────────────────────────────────────────────────────────────────
  { id: 'edit.undo', scope: 'global', codes: ['KeyZ'], mod: true, label: 'Ctrl/⌘+Z', desc: '실행 취소' },
  {
    id: 'edit.redo',
    scope: 'global',
    codes: ['KeyZ'],
    mod: true,
    shift: 'yes',
    label: 'Ctrl/⌘+Shift+Z',
    desc: '다시 실행',
  },
  { id: 'edit.redo', scope: 'global', codes: ['KeyY'], mod: true, label: 'Ctrl/⌘+Y', desc: '다시 실행' },
  // Shift 를 `'any'` 로 둔다 — 저장은 Shift 가 붙어도 저장이다. 손이 미끄러져 Shift 가
  // 걸린 채 눌렀을 때 **조용히 아무 일도 안 나는 것**이 가장 나쁘다.
  { id: 'edit.save', scope: 'global', codes: ['KeyS'], mod: true, shift: 'any', label: 'Ctrl/⌘+S', desc: '저장' },
  // 복제는 **한 키에 두 층**이다(기현 지시 2026-08-18 "복제 단축키 ctrl-d") — 복제 가능한
  // 선택(도형·메모·화살표, ObjectMenu 의 canDuplicate)이 있으면 그 개체들, 없으면 현재 스텝.
  // 갈림을 선택이 정하는 것은 Delete 와 같은 결이다("무엇을" 이 선택에서 오는 편집 조작).
  // PageUp/Dn 을 선택과 무관하게 만든 규율(아래)과 안 부딪힌다 — 그건 **이동** 키의 규율이다.
  // 두 정의가 **같은 id** 인 것이 계약이다(keymap.contract: 다른 id 가 같은 사건을 물면
  // "한 키가 두 동작" 으로 잡힌다 — 같은 id 복수 정의는 redo 의 Shift+Z/Y 같은 별칭).
  // 둘째 정의는 도움말 행 전용이다: 스텝 있는 화면에서 두 층이 두 줄로 다 보이고,
  // 전술판(needsSteps)에서는 개체 층만 남는다.
  {
    id: 'edit.duplicate',
    scope: 'global',
    codes: ['KeyD'],
    mod: true,
    label: 'Ctrl/⌘+D',
    desc: '선택한 개체 복제(도형·메모·화살표)',
  },
  {
    id: 'edit.duplicate',
    scope: 'global',
    codes: ['KeyD'],
    mod: true,
    label: 'Ctrl/⌘+D',
    desc: '현재 스텝 복제(개체 선택이 없을 때)',
    needsSteps: true,
  },

  // ── 시간축 ──────────────────────────────────────────────────────────────
  // 개편 전에는 `←/→` 였고 "개체가 선택되지 않았을 때만" 이라는 조건이 붙어 있었다. 방향키가
  // 개체 이동으로 남으면서 그 조건이 계속 필요해지므로, 스텝을 PageUp/Dn 으로 옮겨 **선택
  // 상태와 무관하게 항상 같은 일**을 하게 한다. 시연 화면이 이미 쓰던 키라 두 화면도 붙는다.
  { id: 'step.prev', scope: 'global', codes: ['PageUp'], label: 'PageUp', desc: '이전 스텝', needsSteps: true },
  { id: 'step.next', scope: 'global', codes: ['PageDown'], label: 'PageDown', desc: '다음 스텝', needsSteps: true },
  {
    id: 'play.toggle',
    scope: 'global',
    codes: ['Space'],
    label: 'Space',
    desc: '재생 / 일시정지',
    needsSteps: true,
  },

  // ── 보기 ────────────────────────────────────────────────────────────────
  // 토글은 **전부 Alt+글자**다. 개편 전에는 `G`·`Z` 단독이었는데, Z 는 Ctrl+Z(실행취소)와
  // 글자가 겹쳐 손이 헷갈렸고 토글이 늘 때마다 도구 문자키와 자리를 다퉜다. 계열을 가르면
  // 둘 다 사라진다 — Alt 는 토글, 맨 글자는 도구.
  { id: 'view.grid', scope: 'global', codes: ['KeyG'], alt: true, label: 'Alt+G', desc: '격자 표시' },
  { id: 'view.ruleZones', scope: 'global', codes: ['KeyZ'], alt: true, label: 'Alt+Z', desc: '골 지역 가이드' },
  // Ctrl+= 는 Shift 유무로 갈리지 않는다(= 와 + 가 같은 자리). `'any'` 로 둬야 둘 다 잡힌다.
  {
    id: 'view.zoomIn',
    scope: 'global',
    codes: ['Equal', 'NumpadAdd'],
    mod: true,
    shift: 'any',
    label: 'Ctrl/⌘ +',
    desc: '확대',
  },
  { id: 'view.zoomOut', scope: 'global', codes: ['Minus', 'NumpadSubtract'], mod: true, label: 'Ctrl/⌘ −', desc: '축소' },
  { id: 'view.zoomReset', scope: 'global', codes: ['Digit0', 'Numpad0'], mod: true, label: 'Ctrl/⌘ 0', desc: '배율 100%' },
  { id: 'view.pan', scope: 'global', codes: [...ARROWS], mod: true, label: 'Ctrl/⌘+방향키', desc: '판 이동(팬)' },

  // ── 전역 기타 ───────────────────────────────────────────────────────────
  { id: 'select.clear', scope: 'global', codes: ['Escape'], label: 'Esc', desc: '선택 해제 — 열린 창이 있으면 그 창만 닫힘' },
  // 세 앱(PPT·일러스트레이터·피그마)이 전부 같은 자리에 두는 키라 배울 것이 없다.
  // 잠긴 개체는 담지 않는다 — 덩어리로 집는 길은 전부 그 규칙을 따른다(selectSame.ts).
  { id: 'select.all', scope: 'global', codes: ['KeyA'], mod: true, label: 'Ctrl/⌘+A', desc: '전부 선택(잠긴 것 제외)' },
  // ★ 2026-08-16 기현 지시: *"객체 지우기는 하나건 여러 개건 Delete 키로 무조건 지우게 해."*
  //   개편 전에는 수식키로 규모를 갈랐다 — `Delete` 는 포커스 하나, `Ctrl+Delete` 는 선택
  //   전체. 그런데 **사용자에게 그 둘은 같은 일**이고, 규모는 자기가 이미 화면에서 정해 둔
  //   것이다(무엇이 파랗게 켜져 있는가). 손이 그것을 다시 수식키로 말할 이유가 없다.
  //   지금 이 정의는 **개체 층에도 같은 id 로 하나 더 있다**(아래) — 층이 둘인 것은
  //   포커스가 개체에 있을 때와 코트에 있을 때 둘 다 먹어야 하기 때문이고, **하는 일이
  //   같으므로** 겹쳐도 삼키는 것이 없다(`keymap.contract` 가 그 조건을 명시적으로 잰다).
  {
    id: 'erase.selection',
    scope: 'global',
    codes: ['Delete', 'Backspace'],
    label: 'Delete',
    desc: '고른 개체 지우기 — 하나든 여럿이든',
  },
  // `?` 는 US 배열에서 Shift+`/` 다. 다른 배열에서는 자리가 다르므로 **문자로도** 잡는다
  // (`keys` 필드 주석에 근거). 자리로만 잡으면 독일어 자판에서 도움말이 안 열린다.
  { id: 'help', scope: 'global', codes: ['Slash'], keys: ['?'], shift: 'yes', label: 'Shift+?', desc: '이 도움말' },

  // ── 개체(포커스 한정) ───────────────────────────────────────────────────
  // 여기서부터가 WCAG 2.1.4 "Active only on focus" 예외 구간이다. 이 키들은 개체에 포커스가
  // 있을 때만 산다 — 전역으로 올리면 예외가 깨지고 문자키 게이트가 필요해진다.
  //
  // Shift 는 **큰 걸음**이다(기본이 정밀 — 2026-08-28 기현 지시로 뒤집혔다: *"큰 움직임은
  // 마우스로, 미세 움직임은 키보드로"*). 2026-08-16 개편에서 화살표 개체에만 있던 세 번째
  // 뜻("조준점만 이동")을 걷어내며 Shift 의 뜻을 하나로 접은 것은 **그대로 남는다** —
  // 어디서나 '정도만 바꾼다' 이고, 이번에 바뀐 것은 어느 쪽이 기본이냐 하나다.
  {
    id: 'obj.move',
    scope: 'object',
    codes: ['KeyW', 'KeyA', 'KeyS', 'KeyD', ...ARROWS],
    shift: 'any',
    label: 'W A S D · 방향키',
    desc: '개체 이동 — Shift 는 큰 걸음',
  },
  {
    id: 'obj.rotate',
    scope: 'object',
    codes: ['KeyQ', 'KeyE'],
    shift: 'any',
    label: 'Q E',
    desc: '개체 회전 — Shift 는 큰 걸음',
  },
  // `[` `]` 는 QE 가 회전을, PageUp/Dn 이 스텝을 가져가면서 통째로 비었다. 가로로 나란한 한
  // 쌍이라 "이전/다음" 연상이 맞고, Alt 를 토글 전용으로 비워둘 수 있다.
  {
    id: 'obj.cyclePrev',
    scope: 'object',
    codes: ['BracketLeft'],
    label: '[',
    desc: '이전 개체로',
  },
  { id: 'obj.cycleNext', scope: 'object', codes: ['BracketRight'], label: ']', desc: '다음 개체로' },
  // Shift 를 쥐고 순회하면 **모으면서** 간다 — 파일 목록의 Shift+↓ 와 같은 관례다.
  // 마우스 없이 여럿을 고르는 길이 Enter 토글뿐이었는데, 그것만으로는 '훑어 모으기' 가 안 된다.
  { id: 'obj.cycleExtendPrev', scope: 'object', codes: ['BracketLeft'], shift: 'yes', label: 'Shift+[', desc: '이전 개체를 선택에 더하며 이동' },
  { id: 'obj.cycleExtendNext', scope: 'object', codes: ['BracketRight'], shift: 'yes', label: 'Shift+]', desc: '다음 개체를 선택에 더하며 이동' },
  { id: 'obj.toggleSelect', scope: 'object', codes: ['Enter'], label: 'Enter', desc: '선택 / 해제' },
  // 위 전역 정의와 **같은 id·같은 말**이다(별칭). 개체에 포커스가 있으면 EditorStage 가
  // stopPropagation 으로 먼저 먹으므로 이 줄이 없으면 그때 Delete 가 죽는다.
  {
    id: 'erase.selection',
    scope: 'object',
    codes: ['Delete', 'Backspace'],
    label: 'Delete',
    desc: '고른 개체 지우기 — 하나든 여럿이든',
  },

  // ── 시연 ────────────────────────────────────────────────────────────────
  // 편집기와 **같은 규칙**으로 맞췄다(2026-08-16). 개편 전에는 Space 가 여기서만 '다음 스텝'
  // 이었고 재생이 `P` 였는데, 편집기에서 P 는 선수 도구다. 같은 글자가 화면마다 다른 일을
  // 하면 두 화면 사이에서 손이 뒤집힌다.
  { id: 'present.next', scope: 'present', codes: ['PageDown', 'ArrowRight', 'ArrowDown'], label: 'PageDown · → ↓', desc: '다음 스텝' },
  { id: 'present.prev', scope: 'present', codes: ['PageUp', 'ArrowLeft', 'ArrowUp'], label: 'PageUp · ← ↑', desc: '이전 스텝' },
  { id: 'present.play', scope: 'present', codes: ['Space'], label: 'Space', desc: '재생 / 일시정지' },
  { id: 'present.first', scope: 'present', codes: ['Home'], label: 'Home', desc: '처음 스텝' },
  { id: 'present.last', scope: 'present', codes: ['End'], label: 'End', desc: '마지막 스텝' },
  { id: 'present.nextDrill', scope: 'present', codes: ['KeyN'], label: 'N', desc: '다음 드릴', letterKey: true },
  {
    id: 'present.prevDrill',
    scope: 'present',
    codes: ['KeyN'],
    shift: 'yes',
    label: 'Shift+N',
    desc: '이전 드릴',
  },
  { id: 'present.fullscreen', scope: 'present', codes: ['KeyF'], alt: true, label: 'Alt+F', desc: '전체화면' },
  { id: 'present.loop', scope: 'present', codes: ['KeyL'], alt: true, label: 'Alt+L', desc: '반복 재생' },
  { id: 'present.blackout', scope: 'present', codes: ['KeyB'], alt: true, label: 'Alt+B', desc: '화면 끄기' },
  { id: 'present.exit', scope: 'present', codes: ['Escape'], label: 'Esc', desc: '시연 종료' },
  { id: 'help', scope: 'present', codes: ['Slash'], keys: ['?'], shift: 'yes', label: 'Shift+?', desc: '도움말' },
];

/** 사건이 가리키는 물리 키. `code` 가 비어 있을 때만 `key` 로 물러선다.
 *
 *  왜 폴백이 필요한가 — **합성 사건은 code 를 안 싣는 경우가 있다**(테스트에서 만든
 *  `KeyboardEvent`, 일부 화면 키보드·매크로 장치). 그때 방향키·Esc·PageUp 처럼 code 와 key 가
 *  **같은 이름**인 키까지 죽는 것은 손해뿐이다.
 *
 *  ⚠️ 이 폴백은 문자키를 구제하지 **않는다**. 한글 모드의 'ㅍ' 는 'KeyV' 와 안 맞으므로 그대로
 *  아무 일도 안 난다 — 그것이 옳다. code 를 싣는 진짜 사건에서는 폴백 자체가 안 돈다. */
export function eventCode(e: { code?: string; key?: string }): string {
  if (e.code && e.code !== 'Unknown') return e.code;
  const k = e.key ?? '';
  return k === ' ' ? 'Space' : k; // Space 만 code 와 key 의 이름이 다르다
}

/** 눌린 키가 이 정의에 맞는가. 지정하지 않은 수식키는 **눌리지 않아야** 한다 —
 *  안 그러면 Ctrl+S(저장)가 S(개체 아래로)까지 같이 발화한다. */
export function matchesKey(def: KeyDef, e: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'> & { key?: string }): boolean {
  const byCode = def.codes.includes(eventCode(e));
  const byKey = def.keys !== undefined && e.key !== undefined && def.keys.includes(e.key);
  if (!byCode && !byKey) return false;
  if ((e.ctrlKey || e.metaKey) !== (def.mod ?? false)) return false;
  if (e.altKey !== (def.alt ?? false)) return false;
  switch (def.shift ?? 'no') {
    case 'no':
      return !e.shiftKey;
    case 'yes':
      return e.shiftKey;
    default:
      return true;
  }
}

/** 이 층에서 눌린 키에 해당하는 정의. 없으면 undefined.
 *  같은 id 가 여러 정의를 가질 수 있다(redo 의 Shift+Z 와 Y) — 먼저 맞는 것을 쓴다. */
export function lookupDef(
  scope: KeyScope,
  e: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'> & { key?: string },
): KeyDef | undefined {
  for (const def of KEYMAP) {
    if (def.scope !== scope) continue;
    if (matchesKey(def, e)) return def;
  }
  return undefined;
}

/** 이 층에서 눌린 키에 해당하는 동작 id. 없으면 undefined. */
export function lookupKey(
  scope: KeyScope,
  e: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'> & { key?: string },
): string | undefined {
  return lookupDef(scope, e)?.id;
}

/** 도움말 표에 실을 줄. `needsSteps` 인 키는 스텝이 없는 화면(전술판)에서 빠진다. */
export function helpRows(scope: KeyScope, opts: { steps: boolean }): ReadonlyArray<[string, string]> {
  const rows: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const def of KEYMAP) {
    if (def.scope !== scope) continue;
    if (def.needsSteps && !opts.steps) continue;
    // 도구 9종은 한 줄로 접는다 — 아홉 줄을 따로 세우면 표가 도구 목록이 되어버린다.
    if (def.id.startsWith(TOOL_KEY_PREFIX)) continue;
    const key = `${def.label} ${def.desc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push([def.label, def.desc]);
  }
  return rows;
}

/** 도구 9종 — **글자마다 한 줄**. 표의 순서 = 레일 순서다.
 *
 *  ⚠️ 2026-08-16 기현 지시(*"도움말에 어느 키가 뭔지는 적어야지"*)로 한 줄에서 아홉 줄이 됐다.
 *  옛 모양은 `['V L O T R B C P N', '도구 선택']` 이었다 — 표가 도구 목록이 되는 것을 피하려고
 *  접었는데, 접고 나니 **답을 안 주는 줄**이 됐다: 콘이 어느 글자인지 알려면 아홉 개를 세어
 *  왼쪽 목록과 짝지어야 하고, 그 짝짓기를 사람에게 시키는 순간 도움말이 아니다.
 *  표가 도구 목록으로 읽히는 문제는 접어서가 아니라 **구역을 갈라서** 푼다(HelpModal 의 소제목). */
export function toolHelpRows(): ReadonlyArray<[string, string]> {
  return KEYMAP.filter((d) => d.id.startsWith(TOOL_KEY_PREFIX)).map((d) => [d.label, d.desc]);
}
