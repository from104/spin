// §7 3.5 — 인스펙터 태그 칩이 "이미 쓰고 있는 태그" 를 먼저 보여 주기 위한 목록.
//
// 태그를 자유 텍스트로 두면 '수비'·'수비 '·'수비연습' 이 각각 다른 태그가 되고, 그 순간
// 검색은 **가끔 안 되는 기능**이 된다(§7 3.5). 그래서 화면은 기존 태그를 칩으로 내놓고,
// 새 태그 만들기는 그 아래 한 칸으로 밀어 둔다. 그 '기존' 을 여기서 읽는다.
//
// 요약(DrillSummary)에 tags 가 이미 있다 — 본문을 열지 않는다(SUMMARY_BUILD 상승도 없다).
import { useEffect, useState } from 'react';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';

/** 한 번만 읽는다. 태그 목록이 사는 시간은 "인스펙터를 연 동안" 이라 그 사이 다른 화면에서
 *  드릴이 늘어나는 일이 없고, 매번 다시 읽으면 인스펙터를 여닫을 때마다 IDB 를 두드린다.
 *
 *  @param enabled 거짓이면 저장소를 아예 건드리지 않는다 — 자유 전술판의 드릴은 drillRepo 에
 *  살지 않아(localStorage 스냅샷 1장) 태그를 적을 자리도, 남의 태그를 보여 줄 이유도 없다.
 */
export function useKnownTags(enabled: boolean): readonly string[] {
  const [tags, setTags] = useState<readonly string[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const { repo } = await resolveDrillRepo();
      // 인자 없이 부르면 **전량**이다(drillRepo.ts:101 — limit 이 없으면 안 자른다). 여기서
      // 잘리면 "예전에 만든 태그만 안 보인다" 가 되어 같은 뜻의 태그가 새로 생긴다.
      const list = await repo.listDrillSummaries();
      if (cancelled) return;
      const seen = new Set<string>();
      for (const s of list) for (const t of s.tags) seen.add(t);
      // 가나다순. 최근 쓴 순은 요약에 그 정보가 없고(updatedAt 은 드릴의 것이지 태그의 것이
      // 아니다) 칩 자리가 매번 바뀌면 공간 기억이 깨진다 — 트레이와 같은 이유다(§3 불변식 1).
      setTags([...seen].sort((a, b) => a.localeCompare(b, 'ko')));
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return tags;
}
