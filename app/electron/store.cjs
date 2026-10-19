const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
class Store {
  constructor(dir, downloads) {
    fs.mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(path.join(dir, "flow.sqlite"));
    this.db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, data TEXT NOT NULL);",
    );
    this.defaults = {
      folder: downloads,
      smart: false,
      mode: "video",
      container: "mp4",
      audioFormat: "mp3",
      audioQuality: "192K",
      height: "1080",
      concurrency: 2,
      notifications: true,
      theme: "light",
      filename: "title",
      cover: false,
      subtitle: "",
      subtitleFormat: "srt",
    };
    for (const j of this.jobs())
      if (
        ["analyzing", "downloading", "processing", "canceling"].includes(
          j.state,
        )
      )
        this.put({
          ...j,
          state: "interrupted",
          error: "앱 종료로 중단되었습니다. 다시 시도해 주세요.",
        });
  }
  settings() {
    const row = this.db.prepare("SELECT data FROM settings WHERE id=1").get();
    return { ...this.defaults, ...(row ? JSON.parse(row.data) : {}) };
  }
  validate(values) {
    const current = this.settings();
    const s = { ...current };
    for (const k of Object.keys(this.defaults))
      if (Object.hasOwn(values, k)) s[k] = values[k];
    if (!path.isAbsolute(s.folder) || s.folder.length > 1000)
      throw Error("저장 폴더를 확인해 주세요.");
    if (
      !Number.isInteger(s.concurrency) ||
      s.concurrency < 1 ||
      s.concurrency > 5
    )
      throw Error("동시 다운로드는 1~5개로 설정해 주세요.");
    if (
      !["video", "audio"].includes(s.mode) ||
      !["mp4", "mkv", "webm"].includes(s.container) ||
      !["mp3", "m4a", "wav", "original"].includes(s.audioFormat) ||
      !["light", "dark", "system"].includes(s.theme) ||
      !["title", "id"].includes(s.filename)
    )
      throw Error("올바르지 않은 설정입니다.");
    if (
      s.height !== "best" &&
      (!Number.isInteger(Number(s.height)) ||
        Number(s.height) < 1 ||
        Number(s.height) > 10000)
    )
      throw Error("화질 설정을 확인해 주세요.");
    if (
      !["128K", "192K", "320K", "0"].includes(s.audioQuality) ||
      typeof s.subtitle !== "string" ||
      s.subtitle.length > 64 ||
      !["srt", "vtt"].includes(s.subtitleFormat)
    )
      throw Error("오디오/자막 설정을 확인해 주세요.");
    for (const k of ["smart", "notifications", "cover"])
      if (typeof s[k] !== "boolean") throw Error("설정 값을 확인해 주세요.");
    return s;
  }
  save(values) {
    const s = this.validate(values);
    this.db
      .prepare("INSERT OR REPLACE INTO settings VALUES (1,?)")
      .run(JSON.stringify(s));
    return s;
  }
  jobs() {
    return this.db
      .prepare("SELECT data FROM jobs ORDER BY rowid DESC")
      .all()
      .map((r) => JSON.parse(r.data));
  }
  get(id) {
    const r = this.db.prepare("SELECT data FROM jobs WHERE id=?").get(id);
    return r ? JSON.parse(r.data) : null;
  }
  put(j) {
    this.db
      .prepare(
        "INSERT INTO jobs VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .run(j.id, JSON.stringify(j));
  }
  remove(id) {
    this.db.prepare("DELETE FROM jobs WHERE id=?").run(id);
  }
}
module.exports = { Store };
