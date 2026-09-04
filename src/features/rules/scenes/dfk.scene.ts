// ⚠️ 손으로 고치지 마라 — scripts/import-rule-scene.mjs 가 찍는 파일이다.
//
// 출처: 드릴 "2-5 직접FK"(schemaVersion 10(2026-09-03 v10 도장; 원본은 9), 2스텝,
// half/30x18). 봉투의 `teams` 는 만든 기기의 설정이라 버리고
// `DEFAULT_TEAMS` 참조로 바꿔 찍는다(규칙 도해는 앱 기본 팀색으로 떠야 한다).
//
//   다시 찍기: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/dfk.scene.ts --title '2-5 직접FK'
//   드리프트 검사: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/dfk.scene.ts --title '2-5 직접FK' --check
import { DEFAULT_TEAMS } from '../../../model/defaults.ts';
import type { Drill } from '../../../model/drill.ts';

export const drill = {
  "schemaVersion": 10,
  "id": "dr_mtc4darg001c6n",
  "title": "2-5 직접FK",
  "drillType": "game-scenario",
  "situation": "direct-fk",
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
        "id": "ch_mtbs101200rkeh",
        "team": "home",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mtbs101201gg4h",
        "team": "home",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mtbs101202q4bj",
        "team": "home",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mtbs101203aahx",
        "team": "home",
        "number": "4",
        "isGk": false
      },
      {
        "id": "ch_mtbs101204kgae",
        "team": "away",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mtbs1012059zh3",
        "team": "away",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mtbs101206lip2",
        "team": "away",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mtbs101207yzuz",
        "team": "away",
        "number": "4",
        "isGk": false
      }
    ],
    "balls": [
      {
        "id": "bl_mtc4clez00w1wp"
      }
    ],
    "cones": []
  },
  "steps": [
    {
      "id": "st_mtbs1012098be8",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtbs101204kgae": {
          "x": 321.2,
          "y": 415.1,
          "angleDeg": -179.1
        },
        "ch_mtbs1012059zh3": {
          "x": 229.7,
          "y": 392.2,
          "angleDeg": -141.2
        },
        "ch_mtbs101201gg4h": {
          "x": 335.2,
          "y": 267.6,
          "angleDeg": -145.7
        },
        "ch_mtbs101206lip2": {
          "x": 127.2,
          "y": 235.3,
          "angleDeg": -28.4
        },
        "ch_mtbs101207yzuz": {
          "x": 419.3,
          "y": 370,
          "angleDeg": -55
        },
        "ch_mtbs101200rkeh": {
          "x": 197.3,
          "y": 65.1,
          "angleDeg": 140.2
        },
        "ch_mtbs101203aahx": {
          "x": 167.5,
          "y": 323.8,
          "angleDeg": 55.4
        },
        "ch_mtbs101202q4bj": {
          "x": 394.7,
          "y": 111.9,
          "angleDeg": 39.2
        }
      },
      "balls": {
        "bl_mtc4clez00w1wp": {
          "x": 307.7,
          "y": 275.1
        }
      },
      "ballRings": {
        "bl_mtc4clez00w1wp": "5m"
      },
      "ballOwner": {
        "bl_mtc4clez00w1wp": "home"
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtd24j1o00jfei",
          "x": 343.40342603911074,
          "y": 209.07081589899522,
          "text": "수비수는 5미터 떨어져 있어야하고",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    },
    {
      "id": "st_mtd2cbpk01stxu",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtbs101204kgae": {
          "x": 312.7,
          "y": 412.5,
          "angleDeg": -179.1
        },
        "ch_mtbs1012059zh3": {
          "x": 237.5,
          "y": 403.9,
          "angleDeg": -141.2
        },
        "ch_mtbs101201gg4h": {
          "x": 335.2,
          "y": 267.6,
          "angleDeg": 129.4
        },
        "ch_mtbs101206lip2": {
          "x": 170.8,
          "y": 217.8,
          "angleDeg": -18.6
        },
        "ch_mtbs101207yzuz": {
          "x": 435.7,
          "y": 333.6,
          "angleDeg": -92.8
        },
        "ch_mtbs101200rkeh": {
          "x": 197.3,
          "y": 65.1,
          "angleDeg": 140.2
        },
        "ch_mtbs101203aahx": {
          "x": 181.5,
          "y": 342.1,
          "angleDeg": 55.4
        },
        "ch_mtbs101202q4bj": {
          "x": 394.7,
          "y": 111.9,
          "angleDeg": 39.2
        }
      },
      "balls": {
        "bl_mtc4clez00w1wp": {
          "x": 255.9,
          "y": 424.6
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtd24j1o00jfei",
          "x": 344.7,
          "y": 227.9,
          "text": "5미터 떨어져 있어야하고",
          "size": 14,
          "color": "#fde047"
        },
        {
          "id": "nt_mtd2eu3e00zfhk",
          "x": 305.2,
          "y": 349.4,
          "text": "아무도 거치지 않고 직접 골이 될 수 있다.",
          "size": 14,
          "color": "#ef4444"
        }
      ],
      "shapes": []
    }
  ],
  "createdAt": 1787871230908,
  "updatedAt": 1788014397969
} satisfies Drill;
