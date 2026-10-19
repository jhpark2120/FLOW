export type Settings = {
  folder: string;
  smart: boolean;
  mode: "video" | "audio";
  container: string;
  audioFormat: string;
  audioQuality: string;
  height: string;
  concurrency: number;
  notifications: boolean;
  theme: "light" | "dark" | "system";
  filename: string;
  cover: boolean;
  subtitle: string;
  subtitleFormat: string;
};
export type Format = {
  id: string;
  ext: string;
  height: number | null;
  vcodec: string;
  acodec: string;
  size: number | null;
  abr: number | null;
  fps: number | null;
};
export type Media = {
  id: string;
  url: string;
  title: string;
  uploader: string;
  duration: number | null;
  thumbnail: string;
  platform: string;
  formats: Format[];
  subtitles: string[];
  automaticCaptions: string[];
};
export type Entry = {
  id: string;
  url: string;
  title: string;
  duration?: number | null;
};
export type Job = {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  platform: string;
  state: string;
  created: string;
  options: Settings;
  folder: string;
  percent: number | null;
  total: number | null;
  downloaded: number | null;
  speed: number | null;
  eta: number | null;
  error?: string;
  detail?: string;
  file?: string;
  duration?: number;
};
export type Analysis =
  | { type: "media"; media: Media }
  | { type: "collection"; title: string; entries: Entry[]; limited: boolean };
export type Health = { name: string; ok: boolean; version: string };
export interface API {
  init(): Promise<{ settings: Settings; jobs: Job[]; version: string }>;
  analyze(url: string): Promise<Analysis>;
  enqueue(
    entries: { url: string; title: string; thumbnail?: string }[],
    settings: Settings,
  ): Promise<{ duplicates: string[] }>;
  settings(s: Partial<Settings>): Promise<Settings>;
  chooseFolder(): Promise<string | null>;
  clipboard(): Promise<string>;
  cancel(id: string): Promise<void>;
  retry(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  open(id: string, folder: boolean): Promise<void>;
  health(): Promise<Health[]>;
  window(action: string): Promise<void>;
  subscribe(cb: (jobs: Job[]) => void): () => void;
}
declare global {
  interface Window {
    flow?: API;
  }
}
