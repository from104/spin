# art — 배포에 안 들어가는 원본

`public/` 이 아니라 여기 두는 이유 하나: **`public/` 은 통째로 `dist/` 로 복사된다.**
2048² 마스터를 거기 두면 4 MB 가 모든 방문자에게 그대로 나간다(실제로 그 상태였다).

## spin-icon-2048.png

기현님이 2026-08-14 에 주신 앱 아이콘 — 코트 위 파워체어 + 공 + 회전 화살표(= SPIN).
2048×2048 RGBA. 여기서 `public/` 의 래스터 아이콘 다섯을 굽는다:

| 산출물 | 크기 | 쓰임 |
|---|---|---|
| `favicon-32.png` · `favicon-48.png` | 32 · 48 | 브라우저 탭·북마크 |
| `apple-touch-icon.png` | 180 | iOS 홈 화면. **흰 바탕으로 합성**한다(iOS 는 투명을 검게 칠한다) |
| `icon-192.png` · `icon-512.png` | 192 · 512 | manifest(설치형 PWA). 512 는 maskable 로도 쓴다 |

굽는 법(의존성 추가 금지 규칙 때문에 시스템 파이썬 PIL 을 쓴다):

```python
from PIL import Image
src = Image.open('art/spin-icon-2048.png').convert('RGBA')
def out(size, path, bg=None):
    im = src.resize((size, size), Image.LANCZOS)
    if bg:
        base = Image.new('RGB', (size, size), bg); base.paste(im, (0, 0), im); base.save(path, optimize=True)
    else:
        im.save(path, optimize=True)
out(192, 'public/icon-192.png'); out(512, 'public/icon-512.png')
out(180, 'public/apple-touch-icon.png', bg=(255, 255, 255))
out(48, 'public/favicon-48.png'); out(32, 'public/favicon-32.png')
```

⚠️ 옛 `public/favicon.svg` 는 은퇴했다 — 새 아이콘은 래스터라 벡터로 바꿀 수 없다.
