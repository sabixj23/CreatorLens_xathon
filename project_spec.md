# Idea spec — AI growth strategist for creators
*srii hackathon · AI + Creator Economy track · working name TBD*

---

## 1. One-liner

A strategist costs SGD 800–2,500/month. We give creators the analytical half of that job for the price of a subscription — including something no human strategist can do: simulate a 12-week growth plan before you commit to it.

---

## 2. Problem

**The haves vs have-nots gap**

- Large influencers have a team: strategy, marketing, PR.
- Entry and mid-level creators have none of that.
- So they guess → post → wait a week → guess again.
- Most plateau there.

**Why existing tools don't close it**

| Tool type | Gap |
|---|---|
| Analytics dashboards | Tell you what happened, not what to do |
| Hook / retention scorers | One video at a time, no strategy |
| Autopilot generators | Make content, not decisions |
| Human strategists | SGD 800–2,500/month, out of reach |

> Not the headline problem: "too many apps." That's a convenience complaint and reads as "dashboard" to judges.

---

## 3. Target user

**Primary: the plateaued creator**
- Roughly 50k–200k on YouTube
- Has 1–3 years of analytics history
- Already earning something, so willing to pay to reach the next tier
- Often posting across YouTube + TikTok + Instagram with no coherent plan

**Not: the 0–10k creator.** Large market, but no data to analyse and little willingness to pay.

*Open decision — see §11.*

---

## 4. Solution

Six capabilities, in order of importance:

1. **Diagnosis** — one sharp, non-obvious finding about why growth stalled
2. **Simulation** — 2–3 strategy paths projected 12 weeks out, with trade-offs stated
3. **Weekly plan** — what to post, which format, what cadence
4. **Post-post analysis** — predicted vs actual, then recalibrate
5. **Cross-platform view** — one picture across YouTube, TikTok, Instagram
6. **Cold-start mode** — works from niche patterns when the creator has little history

**Simulation is the differentiator.** Everything else exists elsewhere.

---

## 5. What strategy simulation means

Test a growth strategy against a model *before* spending 8 weeks doing it. A flight simulator for channel growth.

**Worked example** — cooking channel, 12k subs, 1 long-form/week, ~4k views:

| Path | Plan | Projected week 12 | Effort |
|---|---|---|---|
| A | 4 Shorts/week, no long-form | 31k subs, weak watch time | 6 hrs/wk |
| B | 1 long-form + 2 Shorts/wk | 24k subs, strong retention | 11 hrs/wk |
| C | Carry on as now | 15k subs | 8 hrs/wk |

Output is not just curves — it's *"Path A grows fastest, but those Shorts viewers won't convert to long-form, so monetisation stalls."*

**How it's built**
- Learn from public data on comparable channels in the same niche — cadence, format mix, growth curves
- Backtest: take a channel's state at month 1, predict month 4, compare against what actually happened
- Show backtest accuracy on ~20 real channels. Without this, judges read the projection as a guess.

---

## 6. User flow

**Free (no payment, minimal friction)**

1. Landing page — "See why your channel stalled." No signup needed to understand the offer.
2. Connect YouTube via OAuth — one click
3. **Diagnosis appears within ~30 seconds** — value delivered before any payment
4. Simulation teaser: the 3 path names + one-line summaries + week 1 of one path

**Paywall**

5. Subscribe → full 12-week projections, weekly action plan, cross-platform, measure-and-recalibrate loop

The cliffhanger is deliberate: they see the fork in the road, they pay to see where the roads lead.

**Two conditions for this to convert**
- Time to value must be under ~30 seconds, or they leave
- The diagnosis must be non-obvious. "Post more consistently" doesn't convert. "Your Shorts audience is 80% different from your long-form audience, so Shorts growth isn't feeding monetisation" does.

---

## 7. Why AI is core, not cosmetic

| Task | Why it needs AI |
|---|---|
| Diagnosis | Finds patterns across hundreds of videos a human would miss |
| Simulation | Learned model of how cadence / format changes propagate over 12 weeks |
| Recalibration | Each creator's real results tune the model to them specifically |
| Explanation | Turns model output into a decision a creator can act on |

Remove the AI and there is no product — only a dashboard.

---

## 8. Competitive position

**Direct competitor: NEXORA** — connects to YouTube via OAuth, reads full analytics, advises on what to post next, why a video underperformed, when to post. Have an answer ready.

| Them | Us |
|---|---|
| Analyse what happened | Project what hasn't happened yet |
| YouTube only | Cross-platform (roadmap) |
| Generic niche benchmarks | Recalibrates on your own results |

**Caveat to state honestly:** "when to post" is a weak lever. Short-form runs on recommendation feeds, not follower feeds, and Shorts can surface weeks after upload. Treat posting time as a minor feature, not a selling point.

---

## 9. Business model

**Pricing**
- Free tier: diagnosis + simulation teaser
- Paid: target ~SGD 30/month (validate with real creators)
- Premium: cross-platform + deeper personalisation

**The comparison slide — real 2026 Singapore figures**

| Option | Monthly |
|---|---|
| Freelancer / solo consultant | SGD 800–2,500 |
| Entry agency retainer | from SGD 1,500 |
| Typical SME retainer | SGD 1,800–4,500 |
| In-house social media manager | SGD 3,500–6,000 (salary alone, before CPF) |

Use the **freelancer** band — closest to what a creator would face. Still 30–80× the subscription price.

Two supporting facts: retainers rose roughly 15–25% since 2023, and each additional platform adds roughly 20–30% to a retainer (which justifies the cross-platform tier).

> Caveat: these are brand / SME rates. The creator-specific market is less documented. Find 2–3 real creator quotes about what they paid a strategist or manager — one of those beats the whole table.

**What we replace, and what we don't**

| We do | Creator still does |
|---|---|
| Performance analysis | Brand negotiations |
| Content planning | Creative taste |
| Platform mechanics | Community relationships |
| Simulation + projection | The final call |

Position as augmentation, not replacement. It's more honest and it pre-empts the obvious objection.

**Why the price can be this low:** one human strategist serves ~10 clients; the model serves 10,000. Marginal cost per client approaches zero; the intelligence doesn't degrade.

---

## 10. Technical feasibility

| Platform | Creator analytics API | Constraint |
|---|---|---|
| YouTube | Yes — Analytics API via OAuth | Cleanest. Build the demo here. |
| Instagram | Graph API only | Business / Creator account required; Meta App Review takes 2–4 weeks; ~200 calls/hour/app |
| TikTok | Limited | Most tools use unofficial routes |
| Spotify | **No** | No Spotify for Artists API; terms prohibit aggregating with other services |

**Consequences**
- You cannot ship live Instagram integration inside the hackathon window. Demo YouTube live, mock the rest, label it clearly.
- Drop Spotify entirely.
- Unified creator-data APIs (e.g. Phyllo) exist for this — worth citing, but it means aggregation itself isn't your innovation.

---

## 11. Open decisions

1. **Cold start or plateau?** The board says both. A 100k creator is not cold-start. Recommend: target plateaued creators, and treat "cold start" as the *model's* cold start on a new client.
2. **Product name.**
3. **Price point** — validate SGD 30 with real creators.
4. **Does anyone on the team do time-series / regression modelling?** Simulation is the defensible part and also the part that can sink the build.
5. **Build hours available** — decides how much of §6 ships live vs mocked.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| "NEXORA already does this" | Lead with simulation + cross-platform, not "AI strategist" |
| "How do you know the projections are right?" | Backtest on ~20 real channels; show the accuracy |
| Instagram / TikTok can't ship in time | YouTube live, others mocked and labelled |
| Free tier doesn't convert | Write 3 example diagnoses before building. If none are surprising, the funnel fails |
| Crowded market | Acknowledge it directly; differentiate on projection, not analysis |

---

## 13. Hackathon scope

**Build live**
- YouTube OAuth + analytics pull
- Diagnosis generation
- Simulation with 3 paths (model can be simple; backtest matters more than sophistication)
- Paywall boundary

**Mock, clearly labelled**
- Instagram / TikTok data
- Week-4 "here's what actually happened" results

**Demo (~3 min)**
1. Open at **step 3** with a realistic creator already loaded — skip the setup
2. Show the fork: three paths, three outcomes, stated trade-offs
3. Creator picks one → weekly plan appears
4. Payoff: "four weeks later — predicted 18k, actual 17.2k" → the model recalibrates

The wow moment is the fork, and the proof is the accuracy reveal.

---

## Sources for the figures in §9

- Digimau, *Social Media Management Cost Singapore 2026* — freelancer and agency bands, 15–25% rise since 2023 — https://www.digimau.com/social-media-management-cost-singapore/
- Papercut, *Best Social Media Marketing Companies in Singapore 2026* — SME retainer band, per-platform uplift — https://www.papercutsg.com/post/best-social-media-marketing-companies-in-singapore-2026
- Drealm, *What Does a Social Media Marketing Agency in Singapore Actually Cost?* — entry retainer floor — https://drealm.sg/social-media-marketing-agency-singapore-cost/
- Globivio, *How Much Does Social Media Marketing Cost in Singapore? (2026)* — in-house salary — https://www.globivio.com/blog/social-media-marketing-cost-singapore-2/
