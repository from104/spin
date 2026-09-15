// 첫 실행 튜토리얼 드릴의 **원본 데이터** (2026-09-16, T7).
//
// ⚠️ **손으로 고치지 마라.** 이 객체는 기현님이 편집기에서 만들어 [파일로 내보내기] 한 것을
// 그대로 옮겨 적은 것이다 — 내보낸 원본은 `docs/assets/SPIN_sample_20260916.spin.drill.json`
// 에 그대로 두었다(이 파일의 `payload` 가 아래 객체다). 좌표·타이밍을
// 손코딩하지 않는 것이 이 저장소의 상시 규율이고(규칙 장면 22벌도 같은 길로 들어왔다), 그
// 규율을 지키는 자리가 바로 이 파일이다. 내용을 바꾸려면 **앱에서 다시 만들어 내보낸 뒤 이
// 파일을 통째로 갈아끼운다.**
//
// 바꿔도 되는 것은 하나도 없다 — id·시각·제목·팀 이름처럼 시드가 정해야 하는 값은 이 파일이
// 아니라 `tutorialDrill.ts` 가 덮는다. 여기는 «사람이 만든 그림» 그대로여야 한다.
//
// 타입을 `Drill` 로 못박은 것은 의도다: 앱의 스키마가 올라가면(지금 v11) **이 파일이 먼저
// 빨개져** 내보낸 판이 낡았다는 것을 빌드가 알려 준다.
import type { Drill } from './drill.ts';

export const TUTORIAL_DRILL_RAW: Drill = {
  "schemaVersion": 11,
  "id": "dr_mu2ttts500zg6n",
  "title": "sample",
  "drillType": "technical",
  "level": "초급",
  "durationMin": 10,
  "tags": [],
  "objective": "",
  "coachingPoints": [],
  "playersNeeded": 0,
  "equipment": "",
  "courtMode": "half",
  "courtSize": "30x18",
  "defense": "away",
  "formation": "1-2-1",
  "teams": {
    "home": {
      "label": "우리 팀",
      "color": "#d93a3a",
      "gkColor": "#f2c811"
    },
    "away": {
      "label": "상대",
      "color": "#1f6bb8",
      "gkColor": "#22a95b"
    }
  },
  "cast": {
    "chairs": [
      {
        "id": "ch_mu2tr5y400s0gw",
        "team": "home",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mu2tr5y401zan0",
        "team": "home",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mu2tr5y4029s1o",
        "team": "home",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mu2tr5y403pmmz",
        "team": "home",
        "number": "4",
        "isGk": false
      },
      {
        "id": "ch_mu2tr5y404g9ll",
        "team": "away",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mu2tr5y405l74h",
        "team": "away",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mu2tr5y4061170",
        "team": "away",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mu2tr5y407rgbl",
        "team": "away",
        "number": "4",
        "isGk": false
      }
    ],
    "balls": [
      {
        "id": "bl_mu2ts13t002cta"
      }
    ],
    "cones": []
  },
  "steps": [
    {
      "id": "st_mu2tr5y409gxrd",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mu2tr5y404g9ll": {
          "x": 293.3,
          "y": 287.5,
          "angleDeg": -72.1
        },
        "ch_mu2tr5y405l74h": {
          "x": 246.4,
          "y": 256,
          "angleDeg": -90
        },
        "ch_mu2tr5y407rgbl": {
          "x": 404.5,
          "y": 219.1,
          "angleDeg": -90
        },
        "ch_mu2tr5y4061170": {
          "x": 305.3,
          "y": 391.5,
          "angleDeg": -90
        },
        "ch_mu2tr5y401zan0": {
          "x": 303.2,
          "y": 206.8,
          "angleDeg": 90
        }
      },
      "balls": {
        "bl_mu2ts13t002cta": {
          "x": 273.6,
          "y": 261.1
        }
      },
      "ballRings": {
        "bl_mu2ts13t002cta": "3m"
      },
      "cones": {},
      "arrows": [],
      "notes": [],
      "shapes": []
    },
    {
      "id": "st_mu2tu2z001nr7i",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mu2tr5y404g9ll": {
          "x": 298,
          "y": 270.8,
          "angleDeg": -72.1
        },
        "ch_mu2tr5y405l74h": {
          "x": 245.1,
          "y": 231.8,
          "angleDeg": -90
        },
        "ch_mu2tr5y407rgbl": {
          "x": 404.5,
          "y": 219.1,
          "angleDeg": -90
        },
        "ch_mu2tr5y4061170": {
          "x": 305.3,
          "y": 391.5,
          "angleDeg": -90
        },
        "ch_mu2tr5y401zan0": {
          "x": 305.3,
          "y": 178.8,
          "angleDeg": 90
        }
      },
      "balls": {
        "bl_mu2ts13t002cta": {
          "x": 278.7,
          "y": 231.8
        }
      },
      "ballRings": {
        "bl_mu2ts13t002cta": "3m"
      },
      "cones": {},
      "arrows": [],
      "notes": [],
      "shapes": []
    },
    {
      "id": "st_mu2tvojz01kkr3",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mu2tr5y404g9ll": {
          "x": 294.2,
          "y": 287.5,
          "angleDeg": -72.1
        },
        "ch_mu2tr5y405l74h": {
          "x": 249.8,
          "y": 202.3,
          "angleDeg": -90
        },
        "ch_mu2tr5y407rgbl": {
          "x": 404.5,
          "y": 219.1,
          "angleDeg": -90
        },
        "ch_mu2tr5y4061170": {
          "x": 305.3,
          "y": 391.5,
          "angleDeg": -90
        },
        "ch_mu2tr5y401zan0": {
          "x": 305.3,
          "y": 150.5,
          "angleDeg": 90
        }
      },
      "balls": {
        "bl_mu2ts13t002cta": {
          "x": 276.1,
          "y": 202.3
        }
      },
      "ballRings": {
        "bl_mu2ts13t002cta": "3m"
      },
      "cones": {},
      "arrows": [],
      "notes": [],
      "shapes": []
    }
  ],
  "createdAt": 1789486113029,
  "updatedAt": 1789486222931
};
