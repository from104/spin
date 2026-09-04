// 언어 접두사는 **주소의 첫 조각을 가로채는** 규칙이라, 너무 넓게 잡으면 앱이 통째로
// 오작동한다. 두 글자 드릴 id(`/drills/ab`)나 두 글자로 시작하는 다른 화면이 접두사로
// 오인되면 그 화면이 영영 안 뜬다 — 그 경계만 잰다.
import { describe, expect, it } from 'vitest';
import { legacyHashPath, splitLocalePrefix, PREFIXED_LOCALES } from './localePrefix.ts';
import { parsePath } from './routes.ts';

describe('언어 접두사', () => {
  it('한국어는 접두사를 갖지 않는다 — 이미 나간 주소가 옮겨 앉으면 안 된다', () => {
    expect(PREFIXED_LOCALES).not.toContain('ko');
    expect(splitLocalePrefix('/rules/two-on-one')).toEqual({
      locale: null,
      basename: '/',
      rest: '/rules/two-on-one',
    });
  });

  it.each(['/ja/rules/two-on-one', '/en/rules/two-on-one'])('%s 를 basename 과 나머지로 가른다', (p) => {
    const { locale, basename, rest } = splitLocalePrefix(p);
    expect(locale).toBe(p.slice(1, 3));
    expect(basename).toBe(p.slice(0, 3));
    expect(rest).toBe('/rules/two-on-one');
  });

  it('접두사만 있는 주소의 나머지는 뿌리다', () => {
    expect(splitLocalePrefix('/ja')).toMatchObject({ locale: 'ja', basename: '/ja', rest: '/' });
    expect(splitLocalePrefix('/ja/')).toMatchObject({ locale: 'ja', basename: '/ja', rest: '/' });
  });

  // ⚠️ 여기가 이 파일의 존재 이유다.
  it('지원 로케일이 아닌 두 글자 조각은 접두사가 아니다', () => {
    // 두 글자짜리 드릴 id 로 들어온 주소. 접두사로 오인하면 basename 이 `/ab` 가 되고
    // 나머지가 빈 문자열이 되어 **드릴 편집기 대신 전술판**이 뜬다.
    const parsed = splitLocalePrefix('/ab/rules');
    expect(parsed.locale).toBeNull();
    expect(parsed.basename).toBe('/');
    expect(parsed.rest).toBe('/ab/rules');
  });

  it('접두사를 걷어낸 나머지가 기존 경로 표 그대로 읽힌다', () => {
    // 접두사 도입이 routes.ts 를 건드리지 않는다는 계약. 여기가 깨지면 언어판에서만
    // 화면이 어긋나는, 가장 늦게 발견되는 종류의 버그가 된다.
    const { rest } = splitLocalePrefix('/en/present/drill/abc');
    expect(parsePath(rest)).toEqual({ screen: 'present', target: { kind: 'drill', id: 'abc' } });
  });
});

describe('해시 시절 주소 관용', () => {
  it('뿌리에 붙은 `#/…` 를 경로로 편다 — 0.6.0 까지 나간 링크가 죽지 않는다', () => {
    expect(legacyHashPath('/', '#/rules/two-on-one')).toBe('/rules/two-on-one');
  });

  it('경로가 이미 있으면 손대지 않는다 — 그 해시는 앵커일 수 있다', () => {
    expect(legacyHashPath('/rules', '#section')).toBeNull();
    expect(legacyHashPath('/rules', '#/two-on-one')).toBeNull();
  });

  it('해시가 없거나 경로 꼴이 아니면 아무것도 안 한다', () => {
    expect(legacyHashPath('/', '')).toBeNull();
    expect(legacyHashPath('/', '#top')).toBeNull();
  });
});
