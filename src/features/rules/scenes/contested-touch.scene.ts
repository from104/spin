// ⚠️ 손으로 고치지 마라 — scripts/import-rule-scene.mjs 가 찍는 파일이다.
//
// 출처: 드릴 "경합 시 아웃 판정"(schemaVersion 9, 3스텝,
// half/30x18). 봉투의 `teams` 는 만든 기기의 설정이라 버리고
// `DEFAULT_TEAMS` 참조로 바꿔 찍는다(규칙 도해는 앱 기본 팀색으로 떠야 한다).
//
//   다시 찍기: node scripts/import-rule-scene.mjs drills/SPIN_경합 시 아웃 판정_20260901.spin.drill.json src/features/rules/scenes/contested-touch.scene.ts
//   드리프트 검사: node scripts/import-rule-scene.mjs drills/SPIN_경합 시 아웃 판정_20260901.spin.drill.json src/features/rules/scenes/contested-touch.scene.ts --check
import { DEFAULT_TEAMS } from '../../../model/defaults.ts';
import type { Drill } from '../../../model/drill.ts';

export const drill = {
  "schemaVersion": 9,
  "id": "dr_mthtjnu50as3uj",
  "title": "경합 시 아웃 판정",
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
  "teams": { home: { ...DEFAULT_TEAMS.home }, away: { ...DEFAULT_TEAMS.away } },
  "cast": {
    "chairs": [
      {
        "id": "ch_mthtjnu500bzv8",
        "team": "home",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mthtjnu501j36l",
        "team": "home",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mthtjnu502qvrl",
        "team": "home",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mthtjnu503di9h",
        "team": "home",
        "number": "4",
        "isGk": false
      },
      {
        "id": "ch_mthtjnu504e94q",
        "team": "away",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mthtjnu505imsl",
        "team": "away",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mthtjnu506yrfw",
        "team": "away",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mthtjnu50758uz",
        "team": "away",
        "number": "4",
        "isGk": false
      }
    ],
    "balls": [
      {
        "id": "bl_mthtm2q500rd6o"
      }
    ],
    "cones": []
  },
  "steps": [
    {
      "id": "st_mthtjnu509bjim",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mthtjnu504e94q": {
          "x": 175.1,
          "y": 338.6,
          "angleDeg": 154.5
        },
        "ch_mthtjnu506yrfw": {
          "x": 118.3,
          "y": 333.7,
          "angleDeg": 168.4
        },
        "ch_mthtjnu50758uz": {
          "x": 274.2,
          "y": 352.8,
          "angleDeg": 167.1
        },
        "ch_mthtjnu503di9h": {
          "x": 230.3,
          "y": 264.3,
          "angleDeg": 90
        },
        "ch_mthtjnu502qvrl": {
          "x": 108.7,
          "y": 300,
          "angleDeg": 158.3
        }
      },
      "balls": {
        "bl_mthtm2q500rd6o": {
          "x": 98.3,
          "y": 320.3
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [],
      "shapes": []
    },
    {
      "id": "st_mthtpv2l014y3f",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mthtjnu504e94q": {
          "x": 175.1,
          "y": 338.6,
          "angleDeg": 154.5
        },
        "ch_mthtjnu506yrfw": {
          "x": 54.8,
          "y": 354.8,
          "angleDeg": 168.4
        },
        "ch_mthtjnu50758uz": {
          "x": 274.2,
          "y": 352.8,
          "angleDeg": 167.1
        },
        "ch_mthtjnu503di9h": {
          "x": 230.3,
          "y": 264.3,
          "angleDeg": 90
        },
        "ch_mthtjnu502qvrl": {
          "x": 45.2,
          "y": 321.1,
          "angleDeg": 158.3
        }
      },
      "balls": {
        "bl_mthtm2q500rd6o": {
          "x": 34.8,
          "y": 341.4
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [],
      "shapes": []
    },
    {
      "id": "st_mthtrd81016az8",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mthtjnu504e94q": {
          "x": 175.1,
          "y": 338.6,
          "angleDeg": 154.5
        },
        "ch_mthtjnu506yrfw": {
          "x": 37.5,
          "y": 359.4,
          "angleDeg": 168.4
        },
        "ch_mthtjnu50758uz": {
          "x": 274.2,
          "y": 352.8,
          "angleDeg": 167.1
        },
        "ch_mthtjnu503di9h": {
          "x": 230.3,
          "y": 264.3,
          "angleDeg": 90
        },
        "ch_mthtjnu502qvrl": {
          "x": 29.5,
          "y": 326.4,
          "angleDeg": 158.3
        }
      },
      "balls": {
        "bl_mthtm2q500rd6o": {
          "x": 21.1,
          "y": 348.2
        }
      },
      "cones": {},
      "arrows": [
        {
          "id": "ar_mthtz32r007sy1",
          "from": {
            "x": 125.42030876887372,
            "y": 258.78198055689535
          },
          "ctrl": {
            "x": 104.06870885474152,
            "y": 302.5451040128246
          },
          "to": {
            "x": 47.94080211956088,
            "y": 322.42527821496145
          },
          "color": "#fde047"
        }
      ],
      "notes": [
        {
          "id": "nt_mthtsdeb00a388",
          "x": 133.8,
          "y": 191.8,
          "text": "두 선수가 공을 사이에 두고 움직여 공이 아웃될 경우,\n각도상 공을 안쪽으로 살리려는 선수에게 소유권이 주어짐.",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    }
  ],
  "createdAt": 1788215849069,
  "updatedAt": 1788216816538
} satisfies Drill;
