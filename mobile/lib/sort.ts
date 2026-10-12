/**
 * Natural numerical section comparator.
 * Correctly orders statutory sections such as:
 * '1', '1(1)', '1(2)', '2', '2(1)(a)', '10', '100', '302', '304', '304A', '304B', '305', '511'
 */
export function naturalCompareSections(
  aSec: string | undefined | null,
  bSec: string | undefined | null
): number {
  const parseSec = (s: string | undefined | null): [number, number, string] => {
    if (!s) return [999999, 999999, ''];
    const trimmed = String(s).trim();
    if (!trimmed) return [999999, 999999, ''];

    const match = trimmed.match(/^(\d+)(.*)/);
    if (!match) return [999998, 0, trimmed.toLowerCase()];

    const mainNum = parseInt(match[1], 10);
    const rest = match[2].trim();

    const subMatch = rest.match(/\((\d+)\)/);
    const subNum = subMatch ? parseInt(subMatch[1], 10) : 0;

    return [mainNum, subNum, rest.toLowerCase()];
  };

  const [aMain, aSub, aRest] = parseSec(aSec);
  const [bMain, bSub, bRest] = parseSec(bSec);

  if (aMain !== bMain) return aMain - bMain;
  if (aSub !== bSub) return aSub - bSub;
  return aRest.localeCompare(bRest);
}
