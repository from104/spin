// ⚠️ 손으로 고치지 마라 — scripts/import-rule-scene.mjs 가 찍는 파일이다.
//
// 출처: 드릴 "2-1 킥오프"(schemaVersion 11(2026-09-06 v11 도장; 원본은 9), 2스텝,
// full/30x18). 봉투의 `teams` 는 만든 기기의 설정이라 버리고
// `DEFAULT_TEAMS` 참조로 바꿔 찍는다(규칙 도해는 앱 기본 팀색으로 떠야 한다).
//
//   다시 찍기: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/kickoff.scene.ts --title '2-1 킥오프'
//   드리프트 검사: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/kickoff.scene.ts --title '2-1 킥오프' --check
import { DEFAULT_TEAMS } from '../../../model/defaults.ts';
import type { Drill } from '../../../model/drill.ts';

export const drill = {
  "schemaVersion": 11,
  "id": "dr_mt63rvxl00rm7m",
  "title": "2-1 킥오프",
  "drillType": "game-scenario",
  "situation": "kick-off",
  "level": "초급",
  "durationMin": 1,
  "tags": [],
  "objective": "",
  "coachingPoints": [],
  "playersNeeded": 0,
  "equipment": "",
  "courtMode": "full",
  "courtSize": "30x18",
  "defense": "home",
  "formation": "1-2-1",
  "teams": { home: { ...DEFAULT_TEAMS.home }, away: { ...DEFAULT_TEAMS.away } },
  "cast": {
    "chairs": [
      {
        "id": "ch_mt63dpzh00g1uu",
        "team": "home",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mt63dpzh0120ru",
        "team": "home",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mt63dpzh0292r4",
        "team": "home",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mt63dpzh03zvkt",
        "team": "home",
        "number": "4",
        "isGk": false
      },
      {
        "id": "ch_mt63dpzh041ttp",
        "team": "away",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mt63dpzh05q91u",
        "team": "away",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mt63dpzh06qyto",
        "team": "away",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mt63dpzh07z4nu",
        "team": "away",
        "number": "4",
        "isGk": false
      }
    ],
    "balls": [
      {
        "id": "bl_mt63ngh700qhs3"
      }
    ],
    "cones": []
  },
  "steps": [
    {
      "id": "st_mt63dpzh09wcjj",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mt63dpzh00g1uu": {
          "x": 116.2,
          "y": 310.7,
          "angleDeg": -88.4
        },
        "ch_mt63dpzh0120ru": {
          "x": 144.8,
          "y": 227.3,
          "angleDeg": 90
        },
        "ch_mt63dpzh0292r4": {
          "x": 274.2,
          "y": 218.7,
          "angleDeg": 9.1
        },
        "ch_mt63dpzh03zvkt": {
          "x": 187.7,
          "y": 326.9,
          "angleDeg": -87.3
        },
        "ch_mt63dpzh041ttp": {
          "x": 722.6,
          "y": 234,
          "angleDeg": -90
        },
        "ch_mt63dpzh07z4nu": {
          "x": 411.6,
          "y": 440.5,
          "angleDeg": -88.2
        },
        "ch_mt63dpzh05q91u": {
          "x": 441.2,
          "y": 245.7,
          "angleDeg": -133.5
        },
        "ch_mt63dpzh06qyto": {
          "x": 377.1,
          "y": 120.6,
          "angleDeg": 167.1
        }
      },
      "balls": {
        "bl_mt63ngh700qhs3": {
          "x": 411.6,
          "y": 263.5
        }
      },
      "ballRings": {
        "bl_mt63ngh700qhs3": "5m"
      },
      "ballOwner": {
        "bl_mt63ngh700qhs3": "away"
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mt63sotb00n9z1",
          "x": 235.2,
          "y": 136.9,
          "text": "수비는 공으로부터 5미터 떨어져있어야 함",
          "size": 14,
          "color": "#fde047"
        },
        {
          "id": "nt_mt643fsm0074yn",
          "x": 415,
          "y": 91.3,
          "text": "각자 자기 진영에 있어야함.",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    },
    {
      "id": "st_mt7a34rc014le5",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mt63dpzh00g1uu": {
          "x": 116.2,
          "y": 310.7,
          "angleDeg": -88.4
        },
        "ch_mt63dpzh0120ru": {
          "x": 144.8,
          "y": 227.3,
          "angleDeg": 90
        },
        "ch_mt63dpzh0292r4": {
          "x": 187.7,
          "y": 183,
          "angleDeg": 82
        },
        "ch_mt63dpzh03zvkt": {
          "x": 187.7,
          "y": 326.9,
          "angleDeg": -87.3
        },
        "ch_mt63dpzh041ttp": {
          "x": 722.6,
          "y": 234,
          "angleDeg": -90
        },
        "ch_mt63dpzh07z4nu": {
          "x": 411.6,
          "y": 440.5,
          "angleDeg": -88.2
        },
        "ch_mt63dpzh05q91u": {
          "x": 441.2,
          "y": 245.7,
          "angleDeg": -133.5
        },
        "ch_mt63dpzh06qyto": {
          "x": 425.4,
          "y": 104.7,
          "angleDeg": 167.1
        }
      },
      "balls": {
        "bl_mt63ngh700qhs3": {
          "x": 411.6,
          "y": 263.5
        }
      },
      "ballRings": {
        "bl_mt63ngh700qhs3": "5m"
      },
      "ballOwner": {
        "bl_mt63ngh700qhs3": "away"
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mt63sotb00n9z1",
          "x": 235.2,
          "y": 136.9,
          "text": "수비는 공으로부터 5미터 떨어져있어야 함",
          "size": 14,
          "color": "#fde047"
        },
        {
          "id": "nt_mt643fsm0074yn",
          "x": 420.2,
          "y": 71,
          "text": "각자 자기 진영에 있어야함.",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    }
  ],
  "createdAt": 1787507434857,
  "updatedAt": 1787998273254
} satisfies Drill;
