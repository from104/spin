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
      'Unlike the lines and marks the field-tour scene shows, the surface material is not part of the court dimensions. Wood and artificial flooring is smooth and kind to powerchair wheels; concrete and tarmac are rough, wear tyres quickly and make control harder.',
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
      'field-tour のシーンが示す図形（ラインやマーク）と違い、表面の材質はコート規格には含まれません — 木材・人工素材の床は滑りにくく電動車椅子の車輪にやさしいのに対し、コンクリートやアスファルトは粗くタイヤの摩耗が早く、操作も難しくなります。',
  },
  distance: {
    title: '再開時の距離 — 5m と 3m',
    caption: 'ほとんどの再開で相手は5m離れ、セットボールだけが3mです — その代わりセットボールに参加する2人はボールから30cm以内に近づきます。',
    aria: '再開時に相手が保つ距離 — ほとんどが5メートル、セットボールだけ3メートルの2つの円を重ねた比較図',
    fiveM: '5m — ほとんどの再開',
    threeM: '3m — セットボール',
    note: 'ボールを中心に、2つの再開で必要な距離を重ねて描いています',
  },
};

export function figureTextFor(locale: Locale): FigureText {
  if (locale === 'en') return EN;
  if (locale === 'ja') return JA;
  return KO;
}
