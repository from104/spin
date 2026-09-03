// ⚠️ 손으로 고치지 마라 — scripts/import-rule-scene.mjs 가 찍는 파일이다.
//
// 출처: 드릴 "4-1 골에리어 반칙 1"(schemaVersion 10(2026-09-03 v10 도장; 원본은 9), 2스텝,
// half/30x18). 봉투의 `teams` 는 만든 기기의 설정이라 버리고
// `DEFAULT_TEAMS` 참조로 바꿔 찍는다(규칙 도해는 앱 기본 팀색으로 떠야 한다).
//
//   다시 찍기: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/three-in-area.scene.ts --title '4-1 골에리어 반칙 1'
//   드리프트 검사: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/three-in-area.scene.ts --title '4-1 골에리어 반칙 1' --check
import { DEFAULT_TEAMS } from '../../../model/defaults.ts';
import type { Drill } from '../../../model/drill.ts';

export const drill = {
  "schemaVersion": 10,
  "id": "dr_mtdsdvr90adj3l",
  "title": "4-1 골에리어 반칙 1",
  "drillType": "game-scenario",
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
        "id": "bl_mtdsf7f0005j1p"
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
          "x": 255.8,
          "y": 301.7,
          "angleDeg": 1.1
        },
        "ch_mtdsdvr905vlrh": {
          "x": 250.6,
          "y": 412.5,
          "angleDeg": -58.7
        },
        "ch_mtdsdvr903k32b": {
          "x": 370.9,
          "y": 384.6,
          "angleDeg": -160.9
        },
        "ch_mtdsdvr9025ey6": {
          "x": 272.9,
          "y": 239.9,
          "angleDeg": 90
        },
        "ch_mtdsdvr906eggd": {
          "x": 229.3,
          "y": 253.6,
          "angleDeg": 60.9
        },
        "ch_mtdsdvr901ptqs": {
          "x": 162.5,
          "y": 384.6,
          "angleDeg": -14.4
        }
      },
      "balls": {
        "bl_mtdsf7f0005j1p": {
          "x": 272.9,
          "y": 280.8
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtdsjsk0001clt",
          "x": 104.9,
          "y": 259.8,
          "text": "아직 골에리어 반칙 아님. 수비 3번이 위험함.",
          "size": 14,
          "color": "#ffffff"
        }
      ],
      "shapes": []
    },
    {
      "id": "st_mtdso6n401y3ue",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtdsdvr904v2qy": {
          "x": 256.5,
          "y": 309.5,
          "angleDeg": 1.1
        },
        "ch_mtdsdvr905vlrh": {
          "x": 250.6,
          "y": 412.5,
          "angleDeg": -58.7
        },
        "ch_mtdsdvr903k32b": {
          "x": 370.9,
          "y": 384.6,
          "angleDeg": -160.9
        },
        "ch_mtdsdvr9025ey6": {
          "x": 273.6,
          "y": 247.7,
          "angleDeg": 90
        },
        "ch_mtdsdvr906eggd": {
          "x": 230,
          "y": 261.4,
          "angleDeg": 60.9
        },
        "ch_mtdsdvr901ptqs": {
          "x": 162.5,
          "y": 384.6,
          "angleDeg": -14.4
        }
      },
      "balls": {
        "bl_mtdsf7f0005j1p": {
          "x": 273.6,
          "y": 288.6
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtdsjsk0001clt",
          "x": 68.1,
          "y": 302.5,
          "text": "수비 3번 플레이어의 앞 가드가 수비하다가 골에리어를 침범한 상황",
          "size": 14,
          "color": "#ef4444"
        },
        {
          "id": "nt_mtdt0aer00b16c",
          "x": 82.6,
          "y": 212.2,
          "text": "수비측 골에리어 반칙인 상황. 골에리어에 들어간다는 판정은 휠체어, 바퀴는 물론 가드가 조금만 걸쳐있어도 들어간 것으로 간주",
          "size": 14,
          "color": "#ef4444"
        }
      ],
      "shapes": []
    }
  ],
  "createdAt": 1787972035077,
  "updatedAt": 1787973341853,
  "situation": "open-play"
} satisfies Drill;
