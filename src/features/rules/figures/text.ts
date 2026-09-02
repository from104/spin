// 조항 도해의 화면 문자열 — 로케일별 표.
//
// 왜 전역 i18n 사전(`src/i18n/*.ts`)이 아니라 여기인가: 이 문자열들은 **그림의 부품**이다.
// 라벨 길이가 바뀌면 그림이 넘치거나 겹치므로, 옮기는 사람이 그림 코드 옆에서 함께 봐야 한다.
// 규칙 콘텐츠(`ruleTopics.en.ts`·`ruleContent.en.ts`)와 같은 방식이다.
//
// ⚠️ `aria-label` 을 빠뜨리지 말 것 — 도해는 SVG 라 스크린리더에게는 이 문장이 **그림 전체**다.
// 눈에 보이는 라벨만 옮기고 aria-label 을 한국어로 두면, 화면은 영어인데 읽어 주는 말은
// 한국어가 된다(가장 티가 안 나면서 가장 나쁜 종류의 누락이다).
//
// 수치는 여기 적지 않는다 — `BALL.diameterM` 등에서 파생시켜 넣는다(치수 하드코딩 금지 규율).
import type { Locale } from '../../../i18n/locale.ts';
import type { LineageVariant } from '../ruleConstants.ts';

export interface FigureText {
  ball: {
    sizeAria: (ballCm: number, soccerCm: number) => string;
    soccerName: string;
    soccerSize: string;
    matchBallName: string;
    matchBallSub: string;
    approx: (cm: number) => string;
    sizeCardTitle: string;
    sizeCardCaption: (ballCm: number, soccerCm: number) => string;
  };
  court: {
    sizeAria: (labels: readonly string[]) => string;
    basketballCallout: string;
    surfaceAria: string;
    goodSurface: string;
    badSurface: string;
    sizeCardTitle: string;
    sizeCardCaption: (max: string, min: string, std: string) => string;
    goodHead: string;
    goodTail: string;
    badHead: string;
    badTail: string;
    surfaceCardTitle: string;
    surfaceCardCaption: string;
  };
  distance: {
    title: string;
    caption: string;
    aria: string;
    fiveM: string;
    threeM: string;
    note: string;
  };
  /** 카드 1 `pf-quota` — 코트 위 네 자리 중 PF2 는 둘까지(Law 18). 칸 수는 LAW 에서 파생. */
  pfQuota: {
    /** 인자는 LAW.teamMaxOnCourt · LAW.pf2MaxOnCourt — 4·2 를 문자열에 적지 않는다(이 파일 머리말). */
    title: (max: number, pf2: number) => string;
    caption: (max: number) => string;
    aria: (max: number, pf2: number) => string;
    slotPf1: string;
    slotPf2: string;
    /** 브래킷 라벨 1~2줄 — 영어·일본어는 두 줄로 나눠 칸 두 개 폭(154px) 안에 넣는다. 인자는 그 칸 수. */
    bracketPf1: (n: number) => readonly string[];
    bracketPf2: (n: number) => readonly string[];
    /** 정원 밖 칸의 ✕ 머리·꼬리 — "하나 더" 로 써서 서수(셋째)를 피한다. 상한이 바뀌어도 참인 문장. */
    extraHead: string;
    extraTail: string;
  };
  /** 카드 1 `lineage` — 네 갈래 규칙이 한 벌이 되는 계보. 연도는 여기 안 적고 LINEAGE 에서 포맷해 넘긴다. */
  lineage: {
    title: string;
    caption: string;
    aria: (coimbra: string, edition: string) => string;
    variants: Record<LineageVariant, string>;
    coimbra: string;
    fipfa: string;
    current: string;
    note: string;
  };
  /** 카드 2 `match-clock` — 전·후반·하프타임을 길이에 비례해 늘어놓은 막대(Law 7·8). */
  matchClock: {
    title: string;
    caption: string;
    aria: (halfMin: number, halftimeMaxMin: number) => string;
    firstHalf: (min: number) => string;
    secondHalf: (min: number) => string;
    halftimeName: string;
    halftimeMax: (min: number) => string;
    stoppage: string;
    endsSwap: string;
    kickoff: string;
    fullTime: string;
  };
  /** 카드 2 `stuck-ball` — 공 물림 5초 시간축과 세 조건(Law 9). */
  stuckBall: {
    title: (sec: number) => string;
    caption: string;
    aria: (sec: number) => string;
    threshold: (sec: number) => string;
    inPlay: string;
    out: string;
    cond1: string;
    cond2: string;
    cond3: string;
    allThree: string;
  };
}

const KO: FigureText = {
  ball: {
    sizeAria: (b, s) => `파워체어풋볼 공(지름 ${b}cm)과 축구공 5호(지름 약 ${s}cm)를 같은 축척으로 나란히 놓은 크기 비교 그림`,
    soccerName: '축구공',
    soccerSize: '5호',
    matchBallName: '파워체어풋볼',
    matchBallSub: '경기구 · 13인치',
    approx: (cm) => `약 ${cm}cm`,
    sizeCardTitle: '크기 — 같은 축척 비교',
    sizeCardCaption: (b, s) =>
      `경기구는 지름 ${b}cm(13인치)로, 축구공 5호(약 ${s}cm)의 1.5배다. 이 치수는 Laws 본문이 아니라 FIPFA 장비 규격에서 온다 — 앱의 물리 상수 BALL.diameterM 도 같은 값이다.`,
  },
  court: {
    sizeAria: (l) => `세 코트 규격을 같은 축척으로 겹쳐 그린 비교 그림. ${l.join(', ')}. 표준 규격은 농구 코트와 같은 크기다.`,
    basketballCallout: '농구 코트',
    surfaceAria: '바닥재 비교 그림. 목재·인조 마루는 미끄럼이 적고 부드러워 규정이 권장하고, 콘크리트·아스팔트는 거칠어 규정이 피하라고 한다.',
    goodSurface: '목재·인조 마루',
    badSurface: '콘크리트·아스팔트',
    sizeCardTitle: '코트 규격 — 3단 비교',
    sizeCardCaption: (max, min, std) =>
      `규정 범위는 ${max}부터 ${min}까지다. 그 사이 ${std} — 표준 농구 코트와 정확히 같은 크기라, 새 체육관을 구할 때 "농구 코트가 있는가"만 물으면 된다.`,
    goodHead: '미끄럼 적고 바퀴에 부드럽다',
    goodTail: '규정이 권장하는 표면',
    badHead: '거칠어 타이어가 마모된다',
    badTail: '규정이 피하라는 표면',
    surfaceCardTitle: '바닥재 — 권장 vs 지양',
    surfaceCardCaption:
      // 2026-09-03: field-tour 장면이 카드 1 로 옮겨 가서 이 카드에는 없다 — 같은 카드의 위 패널을 가리킨다.
      '위 코트 규격 도해의 도형(라인·마크)과 달리 표면 재질은 코트 규격에는 안 나온다 — 목재·인조 마루는 미끄럼이 적고 파워체어 바퀴에 부드럽지만, 콘크리트·아스팔트는 거칠어 타이어 마모가 빠르고 제어가 어렵다.',
  },
  distance: {
    title: '재개 거리 — 5m vs 3m',
    caption: '대부분의 재개는 상대와 5m, 세트볼만 3m입니다 — 대신 세트볼 참여 2명은 공에서 30cm 이내로 붙습니다.',
    aria: '재개 시 상대와의 거리 — 대부분 5미터, 세트볼만 3미터인 두 원을 겹쳐 비교한 그림',
    fiveM: '5m — 대부분의 재개',
    threeM: '3m — 세트볼',
    note: '공을 중심으로 두 재개의 필요 거리를 겹쳐 그렸습니다',
  },
  pfQuota: {
    title: (max, pf2) => `코트 위 ${max}자리 — PF2는 ${pf2}명까지`,
    caption: (max) => `${max}명이 뛸 때입니다. FIPFA 공인 대회 기준이며, 스쿼드 구성에는 제한이 없습니다.`,
    aria: (max, pf2) =>
      `한 팀의 코트 위 ${max}자리 가운데 PF2로 채울 수 있는 자리는 ${pf2}까지이고, 나머지 ${max - pf2}자리는 PF1이라는 그림. 정원 밖 칸에 ✕ 표시 — PF2 하나 더는 안 됩니다.`,
    slotPf1: 'PF1',
    slotPf2: 'PF2',
    bracketPf1: (n) => [`PF1 ${n}자리 이상`],
    bracketPf2: (n) => [`PF2 최대 ${n}자리`],
    extraHead: 'PF2 하나 더',
    extraTail: '안 됩니다',
  },
  lineage: {
    title: '규칙이 한 벌이 되기까지',
    caption: '이 화면의 규칙은 코임브라에서 표준으로 채택된 영국 규칙의 후손입니다.',
    aria: (c, e) => `${c} 코임브라에서 네 가지 방식(프랑스·캐나다/미국·일본·영국)이 영국 규칙을 표준으로 한 벌이 되고, FIPFA 출범을 거쳐 ${e} 승인판까지 이어지는 계보`,
    variants: {
      fr: '프랑스식',
      'ca-us': '캐나다·미국식',
      jp: '일본식',
      en: '영국식',
    },
    coimbra: '영국 규칙을 표준으로',
    fipfa: 'FIPFA 출범',
    current: '지금 쓰는 규칙',
    note: '간격은 연대에 비례하지 않습니다',
  },
  matchClock: {
    title: '경기 시간은 이렇게 흐릅니다',
    caption: '전·후반 길이는 양 팀과 심판이 합의하면 바꿀 수 있습니다.',
    aria: (h, t) => `전반 ${h}분, 하프타임 최대 ${t}분, 후반 ${h}분을 길이에 비례해 늘어놓은 막대. 후반에는 진영을 바꾸고, 멈춘 시간은 각 하프에 더합니다.`,
    firstHalf: (m) => `전반 ${m}분`,
    secondHalf: (m) => `후반 ${m}분`,
    halftimeName: '하프타임',
    halftimeMax: (m) => `최대 ${m}분`,
    stoppage: '+ 멈춘 만큼',
    endsSwap: '진영 교체',
    kickoff: '킥오프',
    fullTime: '종료',
  },
  stuckBall: {
    title: (s) => `물리면 ${s}초까지`,
    caption: '‘액티브 플레이’의 뜻은 2-on-1 반칙 카드에서 설명합니다.',
    aria: (s) => `액티브 플레이 중인 상대 둘 이상 사이에 공이 물린 채 ${s}초를 넘기면 아웃오브플레이가 된다는 시간축. 세 조건이 모두 맞아야 합니다.`,
    threshold: (s) => `${s}초`,
    inPlay: '인플레이',
    out: '아웃',
    cond1: '상대 둘 이상 사이',
    cond2: '액티브 플레이 중',
    cond3: '공이 움직이지 못함',
    allThree: '셋 다 맞아야',
  },
};

const EN: FigureText = {
  ball: {
    sizeAria: (b, s) => `Size comparison: a powerchair football ball (${b}cm across) beside a size 5 football (about ${s}cm), drawn to the same scale.`,
    soccerName: 'Football',
    soccerSize: 'size 5',
    matchBallName: 'Powerchair football',
    matchBallSub: 'match ball · 13in',
    approx: (cm) => `about ${cm}cm`,
    sizeCardTitle: 'Size — drawn to the same scale',
    sizeCardCaption: (b, s) =>
      `The match ball is ${b}cm (13in) across — one and a half times a size 5 football (about ${s}cm). That figure comes from FIPFA equipment guidance, not from the Laws; the app's physics constant BALL.diameterM uses the same value.`,
  },
  court: {
    sizeAria: (l) => `Three court sizes drawn over one another to the same scale: ${l.join(', ')}. The standard size is the same as a basketball court.`,
    basketballCallout: 'basketball court',
    surfaceAria:
      'Surface comparison. Wood and artificial flooring is smooth and easy on the wheels, which the Laws recommend; concrete and tarmac are rough, which the Laws say to avoid.',
    goodSurface: 'Wood · artificial',
    badSurface: 'Concrete · tarmac',
    sizeCardTitle: 'Court size — three sizes compared',
    sizeCardCaption: (max, min, std) =>
      `The permitted range runs from ${max} down to ${min}. Between them sits ${std} — exactly the size of a standard basketball court, so finding a venue comes down to one question: does it have a basketball court?`,
    goodHead: 'Low grip loss, easy on wheels',
    goodTail: 'the surface the Laws recommend',
    badHead: 'Rough — wears tyres',
    badTail: 'the surface the Laws say to avoid',
    surfaceCardTitle: 'Surface — recommended vs avoided',
    surfaceCardCaption:
      'Unlike the shapes (lines and marks) in the court-size figure above, the surface material is not part of the court dimensions. Wood and artificial flooring is smooth and kind to powerchair wheels; concrete and tarmac are rough, wear tyres quickly and make control harder.',
  },
  distance: {
    title: 'Restart distance — 5m vs 3m',
    caption:
      'Most restarts keep opponents 5m away; only the set ball uses 3m — and there the two players taking it come within 30cm of the ball.',
    aria: 'The distance opponents must keep at a restart — two overlaid circles, 5 metres for most restarts and 3 metres for the set ball.',
    fiveM: '5m — most restarts',
    threeM: '3m — set ball',
    note: 'The two required distances drawn over one another, centred on the ball',
  },
  pfQuota: {
    title: (max, pf2) => `${max} on court — at most ${pf2} PF2`,
    caption: (max) => `With ${max} players on court. Applies to FIPFA-sanctioned events; squad make-up is unrestricted.`,
    aria: (max, pf2) =>
      `Of a team's ${max} on-court slots, at most ${pf2} may be PF2 and the other ${max - pf2} are PF1. An extra, crossed-out slot shows one more PF2 is not allowed.`,
    slotPf1: 'PF1',
    slotPf2: 'PF2',
    bracketPf1: (n) => ['PF1', `${n} or more`],
    bracketPf2: (n) => ['PF2', `${n} at most`],
    extraHead: 'One more PF2',
    extraTail: 'not allowed',
  },
  lineage: {
    title: 'How the Laws became one',
    caption: 'The Laws on this screen descend from the English rules adopted as the standard at Coimbra.',
    aria: (c, e) => `Four variants (France, Canada/USA, Japan, England) merged at Coimbra in ${c} with the English rules as the template; FIPFA was then founded, leading to the ${e} edition used here.`,
    variants: {
      fr: 'France',
      'ca-us': 'Canada · USA',
      jp: 'Japan',
      en: 'England',
    },
    coimbra: 'English rules adopted',
    fipfa: 'FIPFA founded',
    current: 'Laws used here',
    note: 'Spacing is not to scale',
  },
  matchClock: {
    title: 'How match time runs',
    caption: 'Half length can be changed if both teams and the referee agree beforehand.',
    aria: (h, t) => `First half ${h} minutes, half-time up to ${t} minutes, second half ${h} minutes, drawn as a bar in proportion. Teams switch ends for the second half; lost time is added to each half.`,
    firstHalf: (m) => `1st half ${m} min`,
    secondHalf: (m) => `2nd half ${m} min`,
    halftimeName: 'Half-time',
    halftimeMax: (m) => `up to ${m} min`,
    stoppage: '+ lost time',
    endsSwap: 'Switch ends',
    kickoff: 'Kick-off',
    fullTime: 'Full time',
  },
  stuckBall: {
    title: (s) => `Stuck ball: ${s} seconds`,
    caption: '‘Active play’ is explained in the 2-on-1 violation card.',
    aria: (s) => `A time axis: a ball jammed between two or more opponents in active play goes out of play after ${s} seconds. All three conditions must hold.`,
    threshold: (s) => `${s} s`,
    inPlay: 'In play',
    out: 'Out',
    cond1: 'Between 2+ opponents',
    cond2: 'In active play',
    cond3: 'Ball cannot move',
    allThree: 'All three together',
  },
};

const JA: FigureText = {
  ball: {
    sizeAria: (b, s) => `電動車椅子サッカーのボール（直径${b}cm）とサッカーボール5号（直径およそ${s}cm）を同じ縮尺で並べた大きさ比較の図`,
    soccerName: 'サッカーボール',
    soccerSize: '5号',
    matchBallName: '電動車椅子サッカー',
    matchBallSub: '競技球 · 13インチ',
    approx: (cm) => `およそ${cm}cm`,
    sizeCardTitle: '大きさ — 同じ縮尺での比較',
    sizeCardCaption: (b, s) =>
      `競技球は直径${b}cm（13インチ）で、サッカーボール5号（およそ${s}cm）の1.5倍です。この寸法は競技規則本文ではなくFIPFAの用具基準によるもので、アプリの物理定数 BALL.diameterM も同じ値です。`,
  },
  court: {
    sizeAria: (l) => `3つのコート規格を同じ縮尺で重ねた比較の図。${l.join('、')}。標準規格はバスケットボールコートと同じ大きさ。`,
    basketballCallout: 'バスケコート',
    surfaceAria: '床材の比較図。木材・人工素材の床は滑りにくく車輪にやさしいので規則が推奨し、コンクリート・アスファルトは粗いので規則が避けるよう求めている。',
    goodSurface: '木材・人工素材',
    badSurface: 'コンクリート・アスファルト',
    sizeCardTitle: 'コート規格 — 3段階の比較',
    sizeCardCaption: (max, min, std) =>
      `規定の範囲は${max}から${min}までです。その間の${std}は標準的なバスケットボールコートとまったく同じ大きさなので、新しい体育館を探すときは「バスケットボールコートがあるか」だけ確かめれば足ります。`,
    goodHead: '滑りにくく車輪にやさしい',
    goodTail: '規則が推奨する床',
    badHead: '粗くタイヤが摩耗する',
    badTail: '規則が避けるよう求める床',
    surfaceCardTitle: '床材 — 推奨と非推奨',
    surfaceCardCaption:
      '上のコート規格の図の図形（ラインやマーク）と違い、表面の材質はコート規格には含まれません — 木材・人工素材の床は滑りにくく電動車椅子の車輪にやさしいのに対し、コンクリートやアスファルトは粗くタイヤの摩耗が早く、操作も難しくなります。',
  },
  distance: {
    title: '再開時の距離 — 5m と 3m',
    caption: 'ほとんどの再開で相手は5m離れ、セットボールだけが3mです — その代わりセットボールに参加する2人はボールから30cm以内に近づきます。',
    aria: '再開時に相手が保つ距離 — ほとんどが5メートル、セットボールだけ3メートルの2つの円を重ねた比較図',
    fiveM: '5m — ほとんどの再開',
    threeM: '3m — セットボール',
    note: 'ボールを中心に、2つの再開で必要な距離を重ねて描いています',
  },
  pfQuota: {
    title: (max, pf2) => `コート上の${max}枠 — PF2は${pf2}人まで`,
    caption: (max) => `${max}人で出場するとき。FIPFA公認大会の基準で、スカッド構成に制限はありません。`,
    aria: (max, pf2) =>
      `チームのコート上${max}枠のうちPF2で埋められるのは${pf2}枠まで、残り${max - pf2}枠はPF1という図。定員外の枠に✕ — PF2をもう1人は不可。`,
    slotPf1: 'PF1',
    slotPf2: 'PF2',
    bracketPf1: (n) => ['PF1', `${n}枠以上`],
    bracketPf2: (n) => ['PF2', `最大${n}枠`],
    extraHead: 'PF2をもう1人',
    extraTail: '不可',
  },
  lineage: {
    title: 'ルールがひとつになるまで',
    caption: 'この画面のルールは、コインブラで標準に採択された英国ルールの系譜です。',
    aria: (c, e) => `${c}コインブラで4つの方式(フランス・カナダ/米国・日本・英国)が英国ルールを標準にひとつになり、FIPFA発足を経て${e}承認版まで続く系譜`,
    variants: {
      fr: 'フランス式',
      'ca-us': 'カナダ・米国式',
      jp: '日本式',
      en: '英国式',
    },
    coimbra: '英国ルールを標準に',
    fipfa: 'FIPFA発足',
    current: '現行ルール',
    note: '間隔は年代に比例しません',
  },
  matchClock: {
    title: '試合時間の流れ',
    caption: '前後半の長さは両チームと審判が事前に合意すれば変えられます。',
    aria: (h, t) => `前半${h}分、ハーフタイム最大${t}分、後半${h}分を長さに比例して並べた棒。後半はコートを交代し、止まった時間は各ハーフに加えます。`,
    firstHalf: (m) => `前半${m}分`,
    secondHalf: (m) => `後半${m}分`,
    halftimeName: 'ハーフタイム',
    halftimeMax: (m) => `最大${m}分`,
    stoppage: '+ 停止時間',
    endsSwap: 'コート交代',
    kickoff: 'キックオフ',
    fullTime: '終了',
  },
  stuckBall: {
    title: (s) => `挟まったら${s}秒まで`,
    caption: '「アクティブプレー」の意味は「2対1の反則」カードで説明します。',
    aria: (s) => `アクティブプレー中の相手2人以上の間にボールが挟まったまま${s}秒を超えるとアウトオブプレーになる時間軸。3つの条件すべてが必要です。`,
    threshold: (s) => `${s}秒`,
    inPlay: 'インプレー',
    out: 'アウト',
    cond1: '相手2人以上の間',
    cond2: 'アクティブプレー中',
    cond3: 'ボールが動かない',
    allThree: '3つとも必要',
  },
};

export function figureTextFor(locale: Locale): FigureText {
  if (locale === 'en') return EN;
  if (locale === 'ja') return JA;
  return KO;
}
