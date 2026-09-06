// ⚠️ 손으로 고치지 마라 — scripts/import-rule-scene.mjs 가 찍는 파일이다.
//
// 출처: 드릴 "5-1 2-on- 1  반칙 2 골키퍼 면제"(schemaVersion 11(2026-09-06 v11 도장; 원본은 9), 3스텝,
// half/30x18). 봉투의 `teams` 는 만든 기기의 설정이라 버리고
// `DEFAULT_TEAMS` 참조로 바꿔 찍는다(규칙 도해는 앱 기본 팀색으로 떠야 한다).
//
//   다시 찍기: node scripts/import-rule-scene.mjs drills/SPIN_5-1 2-on- 1  반칙 2 골키퍼 면제_20260901.spin.drill.json src/features/rules/scenes/two-on-one-gk.scene.ts
//   드리프트 검사: node scripts/import-rule-scene.mjs drills/SPIN_5-1 2-on- 1  반칙 2 골키퍼 면제_20260901.spin.drill.json src/features/rules/scenes/two-on-one-gk.scene.ts --check
import { DEFAULT_TEAMS } from '../../../model/defaults.ts';
import type { Drill } from '../../../model/drill.ts';

export const drill = {
  "schemaVersion": 11,
  "id": "dr_mtf1f2v200q2ub",
  "title": "5-1 2-on- 1  반칙 2 골키퍼 면제",
  "drillType": "game-scenario",
  "situation": "open-play",
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
        "id": "ch_mtdsdvr900uj4m",
        "team": "home",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mtdsdvr901ptqs",
        "team": "home",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mtdsdvr9025ey6",
        "team": "home",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mtdsdvr903k32b",
        "team": "home",
        "number": "4",
        "isGk": false
      },
      {
        "id": "ch_mtdsdvr904v2qy",
        "team": "away",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mtdsdvr905vlrh",
        "team": "away",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mtdsdvr906eggd",
        "team": "away",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mtdsdvr907po65",
        "team": "away",
        "number": "4",
        "isGk": false
      }
    ],
    "balls": [
      {
        "id": "bl_mthdoxxy00jld3"
      }
    ],
    "cones": []
  },
  "steps": [
    {
      "id": "st_mtdsdvr9092s0i",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtdsdvr904v2qy": {
          "x": 205.3,
          "y": 308.1,
          "angleDeg": 0.5
        },
        "ch_mtdsdvr906eggd": {
          "x": 214.1,
          "y": 238.1,
          "angleDeg": -163.7
        },
        "ch_mtdsdvr905vlrh": {
          "x": 247.5,
          "y": 407.6,
          "angleDeg": -87
        },
        "ch_mtdsdvr903k32b": {
          "x": 270.3,
          "y": 227.7,
          "angleDeg": 141.8
        }
      },
      "balls": {
        "bl_mthdoxxy00jld3": {
          "x": 230.8,
          "y": 259.1
        }
      },
      "ballRings": {
        "bl_mthdoxxy00jld3": "3m"
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mthdq2dy00cbsw",
          "x": 396.8,
          "y": 244.3,
          "text": "골리가 우리 수비 진영 골에리어에 있으면 2대1 반칙 면제",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    },
    {
      "id": "st_mthdstzo00pywz",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtdsdvr904v2qy": {
          "x": 230.8,
          "y": 297.3,
          "angleDeg": -39.3
        },
        "ch_mtdsdvr906eggd": {
          "x": 214.1,
          "y": 238.1,
          "angleDeg": -163.7
        },
        "ch_mtdsdvr905vlrh": {
          "x": 247.5,
          "y": 407.6,
          "angleDeg": -87
        },
        "ch_mtdsdvr903k32b": {
          "x": 270.3,
          "y": 227.7,
          "angleDeg": 141.8
        }
      },
      "balls": {
        "bl_mthdoxxy00jld3": {
          "x": 230.8,
          "y": 259.1
        }
      },
      "ballRings": {
        "bl_mthdoxxy00jld3": "3m"
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mthdq2dy00cbsw",
          "x": 396.8,
          "y": 244.3,
          "text": "골리가 우리 수비 진영 골에리어에 있으면 2대1 반칙 면제",
          "size": 14,
          "color": "#fde047"
        },
        {
          "id": "nt_mthdtbj2003ev4",
          "x": 399.3,
          "y": 187.6,
          "text": "골에리어 선상에 조금이라도 걸쳐있어도 면제",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    },
    {
      "id": "st_mthdv0ce00alrx",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtdsdvr904v2qy": {
          "x": 259.5,
          "y": 269.8,
          "angleDeg": -38.8
        },
        "ch_mtdsdvr906eggd": {
          "x": 215.6,
          "y": 238.1,
          "angleDeg": -62.3
        },
        "ch_mtdsdvr905vlrh": {
          "x": 247.5,
          "y": 407.6,
          "angleDeg": -87
        },
        "ch_mtdsdvr903k32b": {
          "x": 274.8,
          "y": 198.7,
          "angleDeg": 141.8
        }
      },
      "balls": {
        "bl_mthdoxxy00jld3": {
          "x": 247.5,
          "y": 238.1
        }
      },
      "ballRings": {
        "bl_mthdoxxy00jld3": "3m"
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mthdw2hi00fzh9",
          "x": 405.7,
          "y": 299.8,
          "text": "그러나 골에리어에서 완전히 벗어나면 면제 아님!",
          "size": 14,
          "color": "#ef4444"
        }
      ],
      "shapes": []
    }
  ],
  "createdAt": 1788047673662,
  "updatedAt": 1788189738191
} satisfies Drill;
