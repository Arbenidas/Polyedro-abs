export type TrendWindow = "day" | "week";
export type ShortVideoPlatform = "reels" | "tiktok" | "both";
export type ShortVideoSourceMode = "topic" | "day" | "week";

export type TrendCandidate = {
  id: string;
  title: string;
  summary: string;
  whyNow: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt?: string;
  score: number;
};

export type ShortVideoBeat = {
  startSecond: number;
  endSecond: number;
  purpose: "hook" | "context" | "proof" | "payoff" | "cta";
  voiceover: string;
  onScreenText: string;
  visualDirection: string;
  editCue: string;
};

export type ShortVideoScript = {
  id: string;
  topic: string;
  angle: string;
  platform: ShortVideoPlatform;
  durationSeconds: number;
  hook: string;
  promise: string;
  beats: ShortVideoBeat[];
  patternInterrupt: string;
  caption: string;
  cta: string;
  hashtags: string[];
  sources: Array<{ title: string; url: string }>;
  verificationNotes: string[];
  retentionScore: number;
  createdAt: string;
  provider: "deepseek" | "local";
  model?: string;
};

export type ShortVideoScriptRequest = {
  sourceMode: "topic" | "trend";
  topic: string;
  platform: ShortVideoPlatform;
  durationSeconds: 15 | 30 | 45 | 60;
  audience?: string;
  tone?: "direct" | "curious" | "contrarian" | "story";
  goal?: "teach" | "save" | "discuss" | "act";
  sources?: Array<{ title: string; url: string; snippet?: string }>;
};
