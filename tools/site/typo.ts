// The website's typography (owner's brief, 2026-10-18): non-breaking spaces after short words, before a dash and after a
// number, the last words of a paragraph held together — so no word hangs alone on the last line and no dash starts one.
// Used by tools/site/build.ts and the forum's renderer.

export type Lang = 'ru' | 'en';

const SHORT_RU = /(^|[\s(«„"])(а|в|во|и|к|ко|о|об|от|по|с|со|у|за|из|на|не|ни|но|до|для|без|под|над|при|про|что|как|или|же|ли|бы|то|их|её|его|это|все|всё)\s+/giu;
const SHORT_EN = /(^|[\s("])(a|an|the|of|to|in|on|at|by|for|and|or|but|is|it|as|no|its|with|from)\s+/giu;

export function typo(s: string, lang: Lang): string {
  let t = s.replace(/\s+—/g, ' —').replace(/(\d)\s+(?=[^\s\d])/g, '$1 ');
  const re = lang === 'ru' ? SHORT_RU : SHORT_EN;
  for (let k = 0; k < 2; k++) t = t.replace(re, (_m, a: string, w: string) => `${a}${w} `);
  const words = t.split(' ');
  if (words.length > 4) t = `${words.slice(0, -2).join(' ')} ${words.slice(-2).join(' ')}`;
  return t;
}
