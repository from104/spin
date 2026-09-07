// 자물쇠의 회귀선. 지우면 새는 것:
//  ① 왕복이 깨지면 링크가 열리지 않는다(iv 배치·base64url 자리 실수가 여기서만 드러난다).
//  ② 한 바이트 변조가 통과하면 "서버는 내용을 못 본다" 는 약속의 나머지 반쪽(변조 검출)이
//     사라진다 — 운영자가 내용을 못 보는 것과 **못 바꾸는 것**은 다른 성질이고, GCM 태그가
//     그 둘째를 진다.
//  ③ 다른 키로 풀리면 링크의 `#` 뒤가 열쇠라는 모델 자체가 거짓이 된다.
import { describe, expect, it } from 'vitest';
import { generateKey, importKey, encrypt, decrypt, toBase64Url, fromBase64Url, SHARE_KEY_B64_LEN } from './crypto.ts';
import { ShareError } from './api.ts';

const plain = new TextEncoder().encode('드릴 봉투 자리 — 한글이 섞여야 UTF-8 왕복까지 본다');

async function kindOf(run: Promise<unknown>): Promise<string> {
  try {
    await run;
    return 'no-throw';
  } catch (e) {
    return e instanceof ShareError ? e.kind : `other:${String(e)}`;
  }
}

describe('crypto — AES-GCM 왕복과 변조 검출', () => {
  it('키는 base64url 43자다 — 링크 길이와 잘림 판정이 이 수에 걸려 있다', async () => {
    const { keyB64 } = await generateKey();
    expect(keyB64).toHaveLength(SHARE_KEY_B64_LEN);
    expect(keyB64).toMatch(/^[0-9A-Za-z_-]+$/); // 패딩 '=' 도, URL 에서 깨지는 '+/' 도 없다
    expect(fromBase64Url(keyB64)).toHaveLength(32);
  });

  it('base64url 왕복이 바이트를 보존한다', () => {
    const bytes = new Uint8Array([0, 1, 62, 63, 251, 252, 253, 254, 255]);
    expect(Array.from(fromBase64Url(toBase64Url(bytes)))).toEqual(Array.from(bytes));
  });

  it('링크의 열쇠(43자)만으로 원문이 돌아온다', async () => {
    const { key, keyB64 } = await generateKey();
    const sealed = await encrypt(key, plain);
    const opened = await decrypt(await importKey(keyB64), sealed);
    expect(new TextDecoder().decode(opened)).toBe(new TextDecoder().decode(plain));
    // iv 12바이트가 앞에 붙고 태그 16바이트가 뒤에 붙는다 — 서버가 받는 바이트의 모양이다.
    expect(sealed.byteLength).toBe(12 + plain.byteLength + 16);
  });

  it('한 바이트만 바뀌어도 열리지 않는다 (GCM 태그)', async () => {
    const { key, keyB64 } = await generateKey();
    const sealed = await encrypt(key, plain);
    sealed[20] = sealed[20]! ^ 0x01;
    expect(await kindOf(decrypt(await importKey(keyB64), sealed))).toBe('bad-key');
  });

  it('다른 키로는 열리지 않는다', async () => {
    const a = await generateKey();
    const b = await generateKey();
    const sealed = await encrypt(a.key, plain);
    expect(await kindOf(decrypt(await importKey(b.keyB64), sealed))).toBe('bad-key');
  });

  it('열쇠가 잘렸거나 길이가 안 맞으면 importKey 가 먼저 끊는다 — 서버를 부르기 전에', async () => {
    const { keyB64 } = await generateKey();
    expect(await kindOf(importKey(keyB64.slice(0, 42)))).toBe('bad-key');
    expect(await kindOf(importKey('!'.repeat(43)))).toBe('bad-key');
  });

  it('iv 도 못 채울 만큼 짧은 암호문은 bad-key 다', async () => {
    const { key } = await generateKey();
    expect(await kindOf(decrypt(key, new Uint8Array(12)))).toBe('bad-key');
  });
});
