# art — 배포에 안 들어가는 원본

`public/` 이 아니라 여기 두는 이유 하나: **`public/` 은 통째로 `dist/` 로 복사된다.**
큰 마스터를 거기 두면 그 무게가 모든 방문자에게 그대로 나간다(실제로 4 MB 가 그랬다).

## ⚠️ 지금 마스터는 여기가 아니라 `public/logo.svg` 다

2026-08-14 기현님이 새 아이콘(초록 원 안의 파란 코트 + 공 + 콘)을 주셨고, **SVG 로 뽑으라**
하셨다. 원본이 원·둥근 사각·점 몇 개의 기하 도형이라 **자동 추적하지 않고 다시 그렸다** —
추적하면 매끈한 곡선이 수백 개의 점으로 쪼개져 파일은 커지고 모양은 흐려진다. 지금은 도형
6개, 1.6 KB 다. 그래서 마스터가 배포본 안에 있어도 무게 문제가 없다.

앞선 래스터 마스터(`spin-icon-2048.png`, 3 MB)는 **은퇴했다.** 그 그림은 흰 정사각 안의 둥근
초록 타일이었고 지금 아이콘과 다른 그림이다 — 되살릴 일이 있으면 git 이력에서 꺼내라.

## `public/logo.svg` 에서 나머지를 굽는다

| 산출물 | 크기 | 바탕 | 쓰임 |
|---|---|---|---|
| `favicon-32.png` · `favicon-48.png` | 32 · 48 | 투명 | 탭·북마크. 16px 로 줄면 차체 뒤끝의 흰 파선이 뭉개져 미리 구워 준다 |
| `apple-touch-icon.png` | 180 | 짙은 나무색 정사각 | iOS 홈 화면 |
| `icon-192.png` · `icon-512.png` | 192 · 512 | 짙은 나무색 정사각 | manifest(설치형). 512 는 maskable 로도 쓴다 |

⚠️ **정사각 셋은 바탕을 채워야 한다.** iOS 는 투명을 검게 칠하고, maskable 은 모서리를
잘라내므로 투명한 원을 주면 원이 잘린다. 짙은 나무색(`#3d2612`) 바탕에 마크를 82~86% 로 넣어
안전 영역을 확보한다. (2026-08-31 이전에는 잔디색 `#24421f` 였다 — 마크의 바닥이 초록에서
나무로 바뀌면서 함께 옮겼다.)

굽는 법(의존성 추가 금지라 ImageMagick + 시스템 파이썬 PIL 을 쓴다):

```sh
convert -background none -density 600 public/logo.svg -resize 1024x1024 /tmp/logo1024.png
```
```python
from PIL import Image
src = Image.open('/tmp/logo1024.png').convert('RGBA')
WOOD = (61, 38, 18)  # #3d2612 — 마크 바닥(#a9713c)보다 짙은 나무

def bake(size, path, square_bg=None, inset=1.0):
    im = src.resize((int(size * inset), int(size * inset)), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0) if square_bg is None else (*square_bg, 255))
    off = (size - im.width) // 2
    canvas.alpha_composite(im, (off, off))
    (canvas if square_bg is None else canvas.convert('RGB')).save(path, optimize=True)

bake(32, 'public/favicon-32.png'); bake(48, 'public/favicon-48.png')
bake(180, 'public/apple-touch-icon.png', WOOD, 0.86)
bake(192, 'public/icon-192.png', WOOD, 0.82)
bake(512, 'public/icon-512.png', WOOD, 0.82)
```

⚠️ SVG 를 고쳤으면 **PNG 다섯도 다시 구워야 한다.** 한쪽만 바뀌면 탭 아이콘과 앱 안 로고가
서로 다른 그림이 된다(2026-08-14 에 실제로 그랬다 — 파일 아이콘만 갈고 앱 안 로고를 놓쳤다).
