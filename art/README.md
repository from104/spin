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
| `logo-128.png` | 128 | **앱 안 왼쪽 레일의 로고**(42px 로 그린다). 아래 ⚠️ 참고 |

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

### ⚠️ `logo-128.png` 만 다르게 굽는다 — 흰 여백을 잘라낸다

원본은 **흰 정사각형 안에 둥근 초록 타일**이다. 그 여백은 파일 아이콘으로는 맞지만(런처가
자기 배경 위에 얹는다) 앱 안 42px 자리에서는 흰 액자가 그대로 보인다. 그래서 타일 경계
(실측 `253,253 → 1795,1794`)로 자르고, 자른 뒤에도 둥근 모서리 **바깥**에 남는 흰색은
테두리에서 시작하는 플러드 필로 알파 0 을 준다 — **안쪽의 흰 공은 살려야 하므로** 단순히
"흰색이면 지운다" 로 하면 안 된다(공이 뚫린다).

```python
from PIL import Image
import numpy as np
src = Image.open('art/spin-icon-2048.png').convert('RGB').crop((253, 253, 1796, 1795))
im = src.resize((128, 128), Image.LANCZOS)
near_white = np.asarray(im).astype(int).sum(axis=2) > 700
out = np.zeros(near_white.shape, bool)
out[0, :] |= near_white[0, :]; out[-1, :] |= near_white[-1, :]
out[:, 0] |= near_white[:, 0]; out[:, -1] |= near_white[:, -1]
for _ in range(300):                      # 테두리에서만 자라는 플러드 필
    g = out.copy()
    g[1:, :] |= out[:-1, :]; g[:-1, :] |= out[1:, :]
    g[:, 1:] |= out[:, :-1]; g[:, :-1] |= out[:, 1:]
    g &= near_white
    if (g == out).all(): break
    out = g
rgba = np.dstack([np.asarray(im), np.where(out, 0, 255).astype(np.uint8)])
Image.fromarray(rgba, 'RGBA').save('public/logo-128.png', optimize=True)
```

⚠️ 옛 `public/favicon.svg` 는 은퇴했다 — 새 아이콘은 래스터라 벡터로 바꿀 수 없다.
