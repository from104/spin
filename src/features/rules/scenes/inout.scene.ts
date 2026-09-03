// ⚠️ 손으로 고치지 마라 — scripts/import-rule-scene.mjs 가 찍는 파일이다.
//
// 출처: 드릴 "3-1 인·아웃"(schemaVersion 10(2026-09-03 v10 도장; 원본은 9), 5스텝,
// half/30x18). 봉투의 `teams` 는 만든 기기의 설정이라 버리고
// `DEFAULT_TEAMS` 참조로 바꿔 찍는다(규칙 도해는 앱 기본 팀색으로 떠야 한다).
//
//   다시 찍기: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/inout.scene.ts --title '3-1 인·아웃'
//   드리프트 검사: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/inout.scene.ts --title '3-1 인·아웃' --check
import { DEFAULT_TEAMS } from '../../../model/defaults.ts';
import type { Drill } from '../../../model/drill.ts';

export const drill = {
  "schemaVersion": 10,
  "id": "dr_mtdlfukr0anvxd",
  "title": "3-1 인·아웃",
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
        "id": "ch_mtdlfukr00j2h0",
        "team": "home",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mtdlfukr01a58f",
        "team": "home",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mtdlfukr02s8ma",
        "team": "home",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mtdlfukr03w5o5",
        "team": "home",
        "number": "4",
        "isGk": false
      },
      {
        "id": "ch_mtdlfukr04oaeh",
        "team": "away",
        "number": "G",
        "isGk": true
      },
      {
        "id": "ch_mtdlfukr052t9d",
        "team": "away",
        "number": "2",
        "isGk": false
      },
      {
        "id": "ch_mtdlfukr067xma",
        "team": "away",
        "number": "3",
        "isGk": false
      },
      {
        "id": "ch_mtdlfukr07q15h",
        "team": "away",
        "number": "4",
        "isGk": false
      }
    ],
    "balls": [
      {
        "id": "bl_mtdlg4og00jpns"
      }
    ],
    "cones": []
  },
  "steps": [
    {
      "id": "st_mtdlfukr09wink",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtdlfukr03w5o5": {
          "x": 110.9,
          "y": 305.8,
          "angleDeg": 90
        },
        "ch_mtdlfukr052t9d": {
          "x": 134.9,
          "y": 389.8,
          "angleDeg": -90
        },
        "ch_mtdlfukr04oaeh": {
          "x": 168.7,
          "y": 338,
          "angleDeg": -90
        },
        "ch_mtdlfukr02s8ma": {
          "x": 247.5,
          "y": 201.7,
          "angleDeg": 90
        },
        "ch_mtdlfukr067xma": {
          "x": 312.9,
          "y": 400.3,
          "angleDeg": -90
        },
        "ch_mtdlfukr07q15h": {
          "x": 312.9,
          "y": 216.6,
          "angleDeg": 94.6
        },
        "ch_mtdlfukr01a58f": {
          "x": 432.9,
          "y": 338.4,
          "angleDeg": 90
        },
        "ch_mtdlfukr00j2h0": {
          "x": 334,
          "y": 60,
          "angleDeg": 90
        }
      },
      "balls": {
        "bl_mtdlg4og00jpns": {
          "x": 110.3,
          "y": 369.6
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [],
      "shapes": []
    },
    {
      "id": "st_mtdljzp301ds5q",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtdlfukr03w5o5": {
          "x": 97.8,
          "y": 320.1,
          "angleDeg": 114.7
        },
        "ch_mtdlfukr052t9d": {
          "x": 134.9,
          "y": 389.8,
          "angleDeg": -162.3
        },
        "ch_mtdlfukr04oaeh": {
          "x": 168.7,
          "y": 338,
          "angleDeg": -90
        },
        "ch_mtdlfukr02s8ma": {
          "x": 247.5,
          "y": 201.7,
          "angleDeg": 90
        },
        "ch_mtdlfukr067xma": {
          "x": 312.9,
          "y": 400.3,
          "angleDeg": -90
        },
        "ch_mtdlfukr07q15h": {
          "x": 312.9,
          "y": 216.6,
          "angleDeg": 94.6
        },
        "ch_mtdlfukr01a58f": {
          "x": 432.9,
          "y": 338.4,
          "angleDeg": 90
        },
        "ch_mtdlfukr00j2h0": {
          "x": 334,
          "y": 60,
          "angleDeg": 90
        }
      },
      "balls": {
        "bl_mtdlg4og00jpns": {
          "x": 43.8,
          "y": 379
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtdlkpjp00ta8e",
          "x": 57.6,
          "y": 287.4,
          "text": "아직 아웃 아님",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    },
    {
      "id": "st_mtdlm26201q87j",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtdlfukr03w5o5": {
          "x": 97.8,
          "y": 320.1,
          "angleDeg": 114.7
        },
        "ch_mtdlfukr052t9d": {
          "x": 134.9,
          "y": 389.8,
          "angleDeg": -162.3
        },
        "ch_mtdlfukr04oaeh": {
          "x": 168.7,
          "y": 338,
          "angleDeg": -90
        },
        "ch_mtdlfukr02s8ma": {
          "x": 247.5,
          "y": 201.7,
          "angleDeg": 90
        },
        "ch_mtdlfukr067xma": {
          "x": 312.9,
          "y": 400.3,
          "angleDeg": -90
        },
        "ch_mtdlfukr07q15h": {
          "x": 312.9,
          "y": 216.6,
          "angleDeg": 94.6
        },
        "ch_mtdlfukr01a58f": {
          "x": 432.9,
          "y": 338.4,
          "angleDeg": 90
        },
        "ch_mtdlfukr00j2h0": {
          "x": 334,
          "y": 60,
          "angleDeg": 90
        }
      },
      "balls": {
        "bl_mtdlg4og00jpns": {
          "x": 36.3,
          "y": 379
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtdlkpjp00ta8e",
          "x": 66.2,
          "y": 292,
          "text": "아직도 아웃 아님",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    },
    {
      "id": "st_mtdlmzvk01gt4q",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtdlfukr03w5o5": {
          "x": 97.8,
          "y": 320.1,
          "angleDeg": 114.7
        },
        "ch_mtdlfukr052t9d": {
          "x": 134.9,
          "y": 389.8,
          "angleDeg": -162.3
        },
        "ch_mtdlfukr04oaeh": {
          "x": 168.7,
          "y": 338,
          "angleDeg": -90
        },
        "ch_mtdlfukr02s8ma": {
          "x": 247.5,
          "y": 201.7,
          "angleDeg": 90
        },
        "ch_mtdlfukr067xma": {
          "x": 312.9,
          "y": 400.3,
          "angleDeg": -90
        },
        "ch_mtdlfukr07q15h": {
          "x": 312.9,
          "y": 216.6,
          "angleDeg": 94.6
        },
        "ch_mtdlfukr01a58f": {
          "x": 432.9,
          "y": 338.4,
          "angleDeg": 90
        },
        "ch_mtdlfukr00j2h0": {
          "x": 334,
          "y": 60,
          "angleDeg": 90
        }
      },
      "balls": {
        "bl_mtdlg4og00jpns": {
          "x": 31.3,
          "y": 379
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtdlkpjp00ta8e",
          "x": 66.2,
          "y": 292,
          "text": "아직도! 아웃 아님",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    },
    {
      "id": "st_mtdloy3w01rxca",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtdlfukr03w5o5": {
          "x": 97.8,
          "y": 320.1,
          "angleDeg": 114.7
        },
        "ch_mtdlfukr052t9d": {
          "x": 134.9,
          "y": 389.8,
          "angleDeg": -162.3
        },
        "ch_mtdlfukr04oaeh": {
          "x": 168.7,
          "y": 338,
          "angleDeg": -90
        },
        "ch_mtdlfukr02s8ma": {
          "x": 247.5,
          "y": 201.7,
          "angleDeg": 90
        },
        "ch_mtdlfukr067xma": {
          "x": 312.9,
          "y": 400.3,
          "angleDeg": -90
        },
        "ch_mtdlfukr07q15h": {
          "x": 312.9,
          "y": 216.6,
          "angleDeg": 94.6
        },
        "ch_mtdlfukr01a58f": {
          "x": 432.9,
          "y": 338.4,
          "angleDeg": 90
        },
        "ch_mtdlfukr00j2h0": {
          "x": 334,
          "y": 60,
          "angleDeg": 90
        }
      },
      "balls": {
        "bl_mtdlg4og00jpns": {
          "x": 28.8,
          "y": 379
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtdlkpjp00ta8e",
          "x": 66.2,
          "y": 292,
          "text": "이제 아웃임.",
          "size": 14,
          "color": "#ef4444"
        },
        {
          "id": "nt_mtdlr5qm00idfk",
          "x": 112.4,
          "y": 240.8,
          "text": "공의 외경(둘레)이 사이드 또는 골대 밖 골 라인의 바깥 경계를 완전히 벗어나야 아웃 판정",
          "size": 14,
          "color": "#ef4444"
        }
      ],
      "shapes": []
    }
  ],
  "createdAt": 1787960369547,
  "updatedAt": 1788014650001
} satisfies Drill;
