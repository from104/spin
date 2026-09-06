// ⚠️ 손으로 고치지 마라 — scripts/import-rule-scene.mjs 가 찍는 파일이다.
//
// 출처: 드릴 "3-3 셋볼"(schemaVersion 11(2026-09-06 v11 도장; 원본은 9), 1스텝,
// half/30x18). 봉투의 `teams` 는 만든 기기의 설정이라 버리고
// `DEFAULT_TEAMS` 참조로 바꿔 찍는다(규칙 도해는 앱 기본 팀색으로 떠야 한다).
//
//   다시 찍기: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/set-ball.scene.ts --title '3-3 셋볼'
//   드리프트 검사: node scripts/import-rule-scene.mjs SPIN_backup_20260831.spin.backup.json src/features/rules/scenes/set-ball.scene.ts --title '3-3 셋볼' --check
import { DEFAULT_TEAMS } from '../../../model/defaults.ts';
import type { Drill } from '../../../model/drill.ts';

export const drill = {
  "schemaVersion": 11,
  "id": "dr_mtdrw2fa00t0of",
  "title": "3-3 셋볼",
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
          "x": 132.8,
          "y": 338.4,
          "angleDeg": 32.7
        },
        "ch_mtdlfukr052t9d": {
          "x": 415.5,
          "y": 287.5,
          "angleDeg": 104.8
        },
        "ch_mtdlfukr04oaeh": {
          "x": 278.5,
          "y": 300.3,
          "angleDeg": -90.2
        },
        "ch_mtdlfukr02s8ma": {
          "x": 278.5,
          "y": 212.7,
          "angleDeg": 90.8
        },
        "ch_mtdlfukr067xma": {
          "x": 291.2,
          "y": 353.6,
          "angleDeg": 176.9
        },
        "ch_mtdlfukr07q15h": {
          "x": 162.5,
          "y": 223,
          "angleDeg": 96.2
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
          "x": 278.5,
          "y": 256.5
        }
      },
      "ballRings": {
        "bl_mtdlg4og00jpns": "3m"
      },
      "cones": {},
      "arrows": [],
      "notes": [
        {
          "id": "nt_mtds38dy00lmks",
          "x": 139.2,
          "y": 148.4,
          "text": "공을 중심으로 사이드 라인과 평행으로 마주보고 30cm 이내에서 경기를 재게. ",
          "size": 14,
          "color": "#fde047"
        },
        {
          "id": "nt_mtds6ybf00g5gl",
          "x": 420.5,
          "y": 166.6,
          "text": "그 외의 선수들은 공에서 3m이상 떨어져야함.",
          "size": 14,
          "color": "#ef4444"
        }
      ],
      "shapes": []
    }
  ],
  "createdAt": 1787971203910,
  "updatedAt": 1788014780583
} satisfies Drill;
