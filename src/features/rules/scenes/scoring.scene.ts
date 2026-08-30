// ⚠️ 손으로 고치지 마라 — scripts/import-rule-scene.mjs 가 찍는 파일이다.
//
// 출처: 드릴 "3-2 득점"(schemaVersion 9, 6스텝,
// half/30x18). 봉투의 `teams` 는 만든 기기의 설정이라 버리고
// `DEFAULT_TEAMS` 참조로 바꿔 찍는다(규칙 도해는 앱 기본 팀색으로 떠야 한다).
//
//   다시 찍기: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/scoring.scene.ts --title '3-2 득점'
//   드리프트 검사: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/scoring.scene.ts --title '3-2 득점' --check
import { DEFAULT_TEAMS } from '../../../model/defaults.ts';
import type { Drill } from '../../../model/drill.ts';

export const drill = {
  "schemaVersion": 9,
  "id": "dr_mtdlxtdd00tixr",
  "title": "3-2 득점",
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
          "x": 83.5,
          "y": 318.3,
          "angleDeg": 32.7
        },
        "ch_mtdlfukr052t9d": {
          "x": 422.6,
          "y": 273,
          "angleDeg": 104.8
        },
        "ch_mtdlfukr04oaeh": {
          "x": 278.5,
          "y": 338.4,
          "angleDeg": -172.3
        },
        "ch_mtdlfukr02s8ma": {
          "x": 292.8,
          "y": 261.8,
          "angleDeg": 57.4
        },
        "ch_mtdlfukr067xma": {
          "x": 286.2,
          "y": 407.5,
          "angleDeg": 176.9
        },
        "ch_mtdlfukr07q15h": {
          "x": 254.1,
          "y": 246.9,
          "angleDeg": 94.6
        },
        "ch_mtdlfukr01a58f": {
          "x": 432.9,
          "y": 338.4,
          "angleDeg": 172.2
        },
        "ch_mtdlfukr00j2h0": {
          "x": 334,
          "y": 60,
          "angleDeg": 90
        }
      },
      "balls": {
        "bl_mtdlg4og00jpns": {
          "x": 286.2,
          "y": 287.5
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [],
      "shapes": []
    },
    {
      "id": "st_mtdm32ah01bqe7",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtdlfukr03w5o5": {
          "x": 115,
          "y": 336,
          "angleDeg": 36.4
        },
        "ch_mtdlfukr052t9d": {
          "x": 432.9,
          "y": 261.8,
          "angleDeg": 124.9
        },
        "ch_mtdlfukr04oaeh": {
          "x": 240.9,
          "y": 357.8,
          "angleDeg": 163.7
        },
        "ch_mtdlfukr02s8ma": {
          "x": 292.8,
          "y": 261.8,
          "angleDeg": 146.5
        },
        "ch_mtdlfukr067xma": {
          "x": 262.5,
          "y": 400.8,
          "angleDeg": -172.9
        },
        "ch_mtdlfukr07q15h": {
          "x": 241.6,
          "y": 244.6,
          "angleDeg": 131.2
        },
        "ch_mtdlfukr01a58f": {
          "x": 432.9,
          "y": 338.4,
          "angleDeg": 172.2
        },
        "ch_mtdlfukr00j2h0": {
          "x": 334,
          "y": 60,
          "angleDeg": 90
        }
      },
      "balls": {
        "bl_mtdlg4og00jpns": {
          "x": 144.3,
          "y": 357.8
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [],
      "shapes": []
    },
    {
      "id": "st_mtdmao1c01s1ih",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtdlfukr03w5o5": {
          "x": 142.3,
          "y": 357.8,
          "angleDeg": 36.4
        },
        "ch_mtdlfukr052t9d": {
          "x": 412.5,
          "y": 261.8,
          "angleDeg": 146.7
        },
        "ch_mtdlfukr04oaeh": {
          "x": 227.7,
          "y": 357.8,
          "angleDeg": 163.7
        },
        "ch_mtdlfukr02s8ma": {
          "x": 292.8,
          "y": 261.8,
          "angleDeg": 146.5
        },
        "ch_mtdlfukr067xma": {
          "x": 255.8,
          "y": 400.8,
          "angleDeg": -172.9
        },
        "ch_mtdlfukr07q15h": {
          "x": 240.9,
          "y": 244.4,
          "angleDeg": 131.2
        },
        "ch_mtdlfukr01a58f": {
          "x": 432.9,
          "y": 338.4,
          "angleDeg": 172.2
        },
        "ch_mtdlfukr00j2h0": {
          "x": 334,
          "y": 60,
          "angleDeg": 90
        }
      },
      "balls": {
        "bl_mtdlg4og00jpns": {
          "x": 201.3,
          "y": 405.8
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtdmexhv00g57b",
          "x": 330.8,
          "y": 351,
          "text": "아직 골 아님.",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    },
    {
      "id": "st_mtdmg3tc01g7ks",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtdlfukr03w5o5": {
          "x": 142.3,
          "y": 357.8,
          "angleDeg": 36.4
        },
        "ch_mtdlfukr052t9d": {
          "x": 412.5,
          "y": 261.8,
          "angleDeg": 146.7
        },
        "ch_mtdlfukr04oaeh": {
          "x": 227.7,
          "y": 357.8,
          "angleDeg": 163.7
        },
        "ch_mtdlfukr02s8ma": {
          "x": 292.8,
          "y": 261.8,
          "angleDeg": 146.5
        },
        "ch_mtdlfukr067xma": {
          "x": 255.8,
          "y": 400.8,
          "angleDeg": -172.9
        },
        "ch_mtdlfukr07q15h": {
          "x": 240.9,
          "y": 244.4,
          "angleDeg": 131.2
        },
        "ch_mtdlfukr01a58f": {
          "x": 432.9,
          "y": 338.4,
          "angleDeg": 172.2
        },
        "ch_mtdlfukr00j2h0": {
          "x": 334,
          "y": 60,
          "angleDeg": 90
        }
      },
      "balls": {
        "bl_mtdlg4og00jpns": {
          "x": 203.8,
          "y": 410.8
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtdmexhv00g57b",
          "x": 330.8,
          "y": 351,
          "text": "아직도 골 아님.",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    },
    {
      "id": "st_mtdmguv200754c",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtdlfukr03w5o5": {
          "x": 142.3,
          "y": 357.8,
          "angleDeg": 36.4
        },
        "ch_mtdlfukr052t9d": {
          "x": 412.5,
          "y": 261.8,
          "angleDeg": 146.7
        },
        "ch_mtdlfukr04oaeh": {
          "x": 227.7,
          "y": 357.8,
          "angleDeg": 163.7
        },
        "ch_mtdlfukr02s8ma": {
          "x": 292.8,
          "y": 261.8,
          "angleDeg": 146.5
        },
        "ch_mtdlfukr067xma": {
          "x": 255.8,
          "y": 400.8,
          "angleDeg": -172.9
        },
        "ch_mtdlfukr07q15h": {
          "x": 240.9,
          "y": 244.4,
          "angleDeg": 131.2
        },
        "ch_mtdlfukr01a58f": {
          "x": 432.9,
          "y": 338.4,
          "angleDeg": 172.2
        },
        "ch_mtdlfukr00j2h0": {
          "x": 334,
          "y": 60,
          "angleDeg": 90
        }
      },
      "balls": {
        "bl_mtdlg4og00jpns": {
          "x": 211.6,
          "y": 419.3
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtdmexhv00g57b",
          "x": 330.8,
          "y": 351,
          "text": "아직도! 골 아님.",
          "size": 14,
          "color": "#fde047"
        }
      ],
      "shapes": []
    },
    {
      "id": "st_mtdmlif601y1t5",
      "name": "",
      "note": "",
      "chairs": {
        "ch_mtdlfukr03w5o5": {
          "x": 142.3,
          "y": 357.8,
          "angleDeg": 36.4
        },
        "ch_mtdlfukr052t9d": {
          "x": 412.5,
          "y": 261.8,
          "angleDeg": 146.7
        },
        "ch_mtdlfukr04oaeh": {
          "x": 227.7,
          "y": 357.8,
          "angleDeg": 163.7
        },
        "ch_mtdlfukr02s8ma": {
          "x": 292.8,
          "y": 261.8,
          "angleDeg": 146.5
        },
        "ch_mtdlfukr067xma": {
          "x": 255.8,
          "y": 400.8,
          "angleDeg": -172.9
        },
        "ch_mtdlfukr07q15h": {
          "x": 240.9,
          "y": 244.4,
          "angleDeg": 131.2
        },
        "ch_mtdlfukr01a58f": {
          "x": 432.9,
          "y": 338.4,
          "angleDeg": 172.2
        },
        "ch_mtdlfukr00j2h0": {
          "x": 334,
          "y": 60,
          "angleDeg": 90
        }
      },
      "balls": {
        "bl_mtdlg4og00jpns": {
          "x": 215.7,
          "y": 423
        }
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtdmexhv00g57b",
          "x": 330.8,
          "y": 349.8,
          "text": "이제 골임.",
          "size": 14,
          "color": "#ef4444"
        },
        {
          "id": "nt_mtdmsh8c00vmul",
          "x": 104.4,
          "y": 277.6,
          "text": "공의 외경(둘레)이 골대 사이에 있는 골 라인의 바깥 경계를 완전히 지나가야 골 판정.",
          "size": 14,
          "color": "#ef4444"
        }
      ],
      "shapes": []
    }
  ],
  "createdAt": 1787961207793,
  "updatedAt": 1787970531404
} satisfies Drill;
