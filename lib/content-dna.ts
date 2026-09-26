import type { ContentDna } from "./types";
import type { OwnVideo } from "./youtube";

// Pure aggregation over the creator's own real video history — no LLM. "Topics" and
// "hook styles" are approximated from title text via simple, inspectable heuristics
// (word frequency, common title patterns), not invented. Everything here is derived
// from real titles and real view counts, weighted by actual performance.

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with", "is", "at",
  "this", "that", "my", "your", "i", "you", "we", "how", "what", "why", "vs", "part", "new",
]);

function extractKeywords(title: string): string[] {
  // \w only matches ASCII. \p{L}/\p{N} (Unicode letters/numbers) alone still fragment
  // scripts like Tamil that use combining vowel signs (Unicode category Mark, \p{M}) —
  // e.g. "சாப்பிடலாம்" would otherwise be split apart at every combining mark. Including
  // \p{M} keeps those words intact instead of silently mangling non-Latin scripts.
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
}

function topTopics(videos: OwnVideo[]): string[] {
  const weighted = new Map<string, number>();
  for (const video of videos) {
    for (const keyword of extractKeywords(video.title)) {
      weighted.set(keyword, (weighted.get(keyword) ?? 0) + video.viewCount);
    }
  }
  return [...weighted.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([keyword]) => keyword);
}

function topFormats(videos: OwnVideo[]): string[] {
  const shorts = videos.filter((v) => v.isShort);
  const longForm = videos.filter((v) => !v.isShort);
  const avgViews = (list: OwnVideo[]) => (list.length ? list.reduce((sum, v) => sum + v.viewCount, 0) / list.length : 0);
  return [
    { label: "Shorts", avg: avgViews(shorts), count: shorts.length },
    { label: "Long-form", avg: avgViews(longForm), count: longForm.length },
  ]
    .filter((format) => format.count > 0)
    .sort((a, b) => b.avg - a.avg)
    .map((format) => format.label);
}

// Rule-based buckets from common title patterns — a real, inspectable heuristic,
// not a fabricated classification. "Evidence" for a given bucket is the matching titles.
const HOOK_STYLE_PATTERNS: Array<{ style: string; test: (title: string) => boolean }> = [
  { style: "Curiosity", test: (t) => /\?|secret|nobody|truth/i.test(t) },
  { style: "How-to / Tutorial", test: (t) => /how to|guide|tutorial|step/i.test(t) },
  { style: "List / Ranking", test: (t) => /^\d+|top \d+|best|worst/i.test(t) },
  { style: "Comparison", test: (t) => /\bvs\b|versus|compared/i.test(t) },
  { style: "Challenge / Reaction", test: (t) => /challenge|reacting|trying|i tried/i.test(t) },
];

function topHookStyles(videos: OwnVideo[]): string[] {
  const weighted = new Map<string, number>();
  for (const video of videos) {
    const matched = HOOK_STYLE_PATTERNS.find((pattern) => pattern.test(video.title));
    if (matched) weighted.set(matched.style, (weighted.get(matched.style) ?? 0) + video.viewCount);
  }
  return [...weighted.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([style]) => style);
}

export function buildContentDna(videos: OwnVideo[]): ContentDna {
  return {
    topTopics: topTopics(videos),
    topFormats: topFormats(videos),
    topHookStyles: topHookStyles(videos),
  };
}
