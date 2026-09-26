export type Brief = {
  platform: "YouTube Shorts" | "Instagram Reels" | "TikTok";
  topic: string;
  audience: string;
  goal: "Educate" | "Entertain" | "Encourage saves" | "Encourage follows";
};

export type Finding = {
  frameId: string;
  kind: "strength" | "improvement";
  title: string;
  observation: string;
  whyItMatters: string;
  suggestion: string;
};

export type SavedReview = {
  analysis?: import("./analysis/schemas").AnalysisResult;
  id: string;
  createdAt: string;
  fileName: string;
  duration: number;
  brief: Brief;
  summary: string;
  findings: Finding[];
  frames: { id: string; time: number }[];
};

export type Performance = {
  id: string;
  videoId: string;
  url: string;
  publishedAt: string;
  measuredAt: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  watchTime?: number;
  completion?: number;
  note: string;
};
