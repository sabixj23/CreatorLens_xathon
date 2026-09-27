import type { ShortsStats } from "../format-stats";
import type { PathPlan } from "../simulation";
import { weekMix } from "../simulation";
import type { GrowthPath, Hypothesis, HypothesisId, Level } from "../types";
import type { PrimaryMetric } from "./experiments";
import { buildExperiment } from "./experiments";

const STRENGTH: Record<Level, number> = { low: 0, medium: 1, high: 2 };
const backed = (h: Hypothesis | undefined) => Boolean(h && (h.status === "supported" || h.status === "mixed"));

// Balanced addresses the measured bottleneck with Shorts levers only (cadence, hooks,
// topics) — it never recommends shifting output to long-form.
function bottleneck(hypotheses: Hypothesis[]): { id: HypothesisId | null; thesis: string; actions: (n: number, proven: number, tests: number, topics: string) => string[] } {
  const top = hypotheses.find(backed);
  switch (top?.id) {
    case "cadence":
      return { id: "cadence", thesis: "Your Shorts cadence dropped when growth slowed — rebuild a steady weekly rhythm before changing anything else.", actions: (n, proven, tests) => [`Post ${n} Shorts every week, on fixed days`, `${proven} on proven topics`, ...(tests ? [`${tests} testing one new hook`] : [])] };
    case "conversion":
      return { id: "conversion", thesis: "Views held up but fewer viewers subscribe — work on turning Shorts viewers into subscribers.", actions: (n, proven, tests) => [`Post ${n} Shorts a week`, "End every Short with one clear reason to subscribe (what's next in the series)", `${tests || 1} a week testing a stronger first-second hook`] };
    case "format_mix":
      return { id: "format_mix", thesis: "Shorts bring you views but convert fewer subscribers than your long-form — make each Short do more to earn the subscribe.", actions: (n, proven, tests) => [`Post ${n} Shorts a week`, "Turn Shorts into series viewers can follow (Part 1 / Part 2)", `${tests || 1} a week testing a subscribe-focused ending`] };
    case "topic_shift":
      return { id: "topic_shift", thesis: "Your recent Shorts drifted from the topics that convert best — bring most back while testing one new idea at a time.", actions: (n, proven, tests, topics) => [`Post ${n} Shorts a week`, `${proven} on ${topics || "your proven topics"}`, `${tests} testing one new topic or hook`] };
    case "outlier_dependence":
      return { id: "outlier_dependence", thesis: "Past growth leaned on a few hit Shorts — build a repeatable format instead of waiting for the next hit.", actions: (n, proven, tests) => [`Post ${n} Shorts a week in one recurring format`, `${proven} following your best Short's structure`, `${tests || 1} testing a variation of it`] };
    default:
      return { id: null, thesis: "No single cause stands out in your data — keep your core Shorts steady and test one variable at a time.", actions: (n, proven, tests) => [`Post ${n} Shorts a week`, `${proven} on proven topics`, `${tests || 1} testing one new topic or hook`] };
  }
}

export function buildStrategyCards(
  plans: PathPlan[],
  hypotheses: Hypothesis[],
  shortsStats: ShortsStats,
  topHookStyle: string | null,
  metric: PrimaryMetric,
  thresholds: { keepAbove: number | null; dropBelow: number | null }
): GrowthPath[] {
  const byId = new Map(hypotheses.map((h) => [h.id, h]));
  const topics = shortsStats.provenTopics.slice(0, 2).join(", ");
  const bn = bottleneck(hypotheses);

  return plans.map((plan) => {
    const { proven, test } = weekMix(plan);
    let thesis: string;
    let actions: string[];
    let evidenceIds: HypothesisId[];
    let assumption: string;
    let mainRisk: string;

    if (plan.id === "A") {
      evidenceIds = (["topic_shift", "outlier_dependence"] as HypothesisId[]).filter((id) => backed(byId.get(id)));
      thesis = shortsStats.provenRel > shortsStats.otherRel && topics
        ? `Your Shorts on ${topics} convert best — make more of them.`
        : "Lean into the Shorts topics and hooks that already work for you.";
      actions = [`Post ${plan.shortsPerWeek} Shorts a week`, `${proven} on proven topics${topics ? ` (${topics})` : ""}`, topHookStyle ? `Open with your best-performing hook style: ${topHookStyle}` : "Reuse the opening of your best recent Short"];
      assumption = "Your audience wants more of what already works, and it won't tire of it within 12 weeks.";
      mainRisk = "An audience ceiling: repeating proven topics can flatten reach over time.";
    } else if (plan.id === "B") {
      evidenceIds = bn.id ? [bn.id] : [];
      thesis = bn.thesis;
      actions = bn.actions(plan.shortsPerWeek, proven, test, topics);
      assumption = "Fixing the measured bottleneck with Shorts alone (cadence, hooks, topics) is enough to lift growth.";
      mainRisk = "The bottleneck may sit outside Shorts (e.g. seasonality) — the checkpoints will show it.";
    } else {
      evidenceIds = (["outlier_dependence"] as HypothesisId[]).filter((id) => backed(byId.get(id)));
      thesis = "Test adjacent topics and hooks to find new reach.";
      actions = [`Post ${plan.shortsPerWeek} Shorts a week`, `${test} testing new topics or hooks`, proven ? `${proven} on a proven topic as the comparison` : "Compare each test with your recent average Short"];
      assumption = "There's untapped reach next to your current topics.";
      mainRisk = "Higher effort and a real chance of lower conversion while you search.";
    }

    const linked = evidenceIds.map((id) => byId.get(id)).filter((h): h is Hypothesis => Boolean(h));
    const evidenceStrength: Level = linked.reduce<Level>((best, h) => (STRENGTH[h.strength] > STRENGTH[best] ? h.strength : best), "low");
    const effort: Level = plan.shortsPerWeek >= 5 || (plan.id === "C" && plan.shortsPerWeek >= 3) ? "high" : plan.shortsPerWeek >= 3 || plan.testsPerWeek >= 2 ? "medium" : "low";

    return {
      id: plan.id,
      name: plan.name,
      oneLiner: plan.oneLiner,
      weekOnePlan: plan.weekOnePlan,
      projectedWeek12Subs: plan.projectedWeek12Subs,
      tradeOff: plan.tradeOff,
      thesis,
      evidenceIds,
      exploratory: evidenceIds.length === 0,
      actions,
      assumption,
      mainRisk,
      effort,
      evidenceStrength: evidenceIds.length ? evidenceStrength : "low",
      shortsPerWeek: plan.shortsPerWeek,
      testsPerWeek: plan.testsPerWeek,
      experiment: buildExperiment(plan.id, proven, test, topics, metric, thresholds),
    };
  });
}
