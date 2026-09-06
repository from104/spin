// ⚠️ 손으로 고치지 마라 — scripts/import-rule-scene.mjs 가 찍는 파일이다.
//
// 출처: 드릴 "2대1 반칙의 성립"(schemaVersion 11(2026-09-06 v11 도장; 원본은 10), 2스텝,
// half/30x18). 봉투의 `teams` 는 만든 기기의 설정이라 버리고
// `DEFAULT_TEAMS` 참조로 바꿔 찍는다(규칙 도해는 앱 기본 팀색으로 떠야 한다).
//
//   다시 찍기: node scripts/import-rule-scene.mjs drills/SPIN_2대1 반칙의 성립_20260904.spin.drill.json src/features/rules/scenes/two-on-one-active.scene.ts
//   드리프트 검사: node scripts/import-rule-scene.mjs drills/SPIN_2대1 반칙의 성립_20260904.spin.drill.json src/features/rules/scenes/two-on-one-active.scene.ts --check
import { DEFAULT_TEAMS } from '../../../model/defaults.ts';
import type { Drill } from '../../../model/drill.ts';

export const drill = {
  "schemaVersion": 11,
  "id": "dr_mtlu0rnf0aon29",
  "title": "2대1 반칙의 성립",
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
        "id": "ch_mtlu0rnf00v8n9",
        "team": "home",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mtlu0rnf01qe7e",
        "team": "home",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mtlu0rnf02lzbq",
        "team": "home",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mtlu0rnf03xkgf",
        "team": "home",
        "number": "4",
        "isGk": false
      },
      {
        "id": "ch_mtlu0rnf04aqva",
        "team": "away",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mtlu0rnf056e3d",
        "team": "away",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mtlu0rnf06iab0",
        "team": "away",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mtlu0rnf07tvo7",
        "team": "away",
        "number": "4",
        "isGk": false
      }
    ],
    "balls": [
      {
        "id": "bl_mtlu30y600ujrm"
      }
    ],
    "cones": []
  },
  "steps": [
    {
      "id": "st_mtlu0rnf09i0bx",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtlu0rnf056e3d": {
          "x": 264.2,
          "y": 181.2,
          "angleDeg": -90
        },
        "ch_mtlu0rnf03xkgf": {
          "x": 250.6,
          "y": 100,
          "angleDeg": 70.2
        },
        "ch_mtlu0rnf06iab0": {
          "x": 162.5,
          "y": 169.8,
          "angleDeg": 9.3
        }
      },
      "balls": {
        "bl_mtlu30y600ujrm": {
          "x": 272,
          "y": 138.1
        }
      },
      "ballRings": {
        "bl_mtlu30y600ujrm": "3m"
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtlu3sjn00rm08",
          "x": 114.6,
          "y": 136.4,
          "text": "아직 2대1 반칙 아님",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    },
    {
      "id": "st_mtlujsci019jby",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtlu0rnf056e3d": {
          "x": 264.2,
          "y": 181.2,
          "angleDeg": -46.9
        },
        "ch_mtlu0rnf03xkgf": {
          "x": 254.4,
          "y": 109.5,
          "angleDeg": 70.2
        },
        "ch_mtlu0rnf06iab0": {
          "x": 201.1,
          "y": 175.5,
          "angleDeg": 5.6
        }
      },
      "balls": {
        "bl_mtlu30y600ujrm": {
          "x": 272,
          "y": 138.1
        }
      },
      "ballRings": {
        "bl_mtlu30y600ujrm": "3m"
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtlu3sjn00rm08",
          "x": 117.9,
          "y": 120.5,
          "text": "제2의 선수가 공의 반경 3미터 안에 들어와 플레이하면 2대1 반칙!",
          "size": 14,
          "color": "#ef4444"
        }
      ],
      "shapes": []
    }
  ],
  "createdAt": 1788458511867,
  "updatedAt": 1788459791930
} satisfies Drill;
