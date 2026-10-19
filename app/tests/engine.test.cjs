const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  validateUrl,
  parseProgress,
  buildArgs,
  optionsFor,
  normalizeMeta,
  koreanError,
  run,
  Engine,
} = require("../electron/engine.cjs");
const { Store } = require("../electron/store.cjs");
test("URL parser restricts actual HTTPS platform hosts and paths", () => {
  for (const u of [
    "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    "https://youtu.be/aqz-KE-bpKQ",
    "https://www.youtube.com/@Blender",
    "https://www.instagram.com/reel/test123/",
  ])
    assert.equal(new URL(validateUrl(u)).protocol, "https:");
  for (const u of [
    "file:///C:/Windows",
    "https://youtube.com.attacker.org/watch?v=x",
    "https://localhost/watch?v=x",
    "http://youtube.com/watch?v=x",
    "https://user:pass@youtube.com/watch?v=x",
    "https://youtube.com:444/watch?v=x",
    "https://instagram.com/accounts/login/",
    "--exec calc.exe",
  ])
    assert.throws(() => validateUrl(u));
});
test("unknown totals and speeds remain null instead of fabricated zero", () => {
  assert.deepEqual(parseProgress('FLOW_PROGRESS:{"downloaded_bytes":50}'), {
    downloaded: 50,
    total: null,
    speed: null,
    eta: null,
    percent: null,
  });
  assert.equal(
    parseProgress('FLOW_PROGRESS:{"downloaded_bytes":50,"total_bytes":100}')
      .percent,
    50,
  );
  assert.equal(parseProgress("not progress"), null);
  assert.equal(parseProgress("FLOW_PROGRESS:not json"), null);
});
const meta = {
  url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
  formats: [
    { height: 1080, vcodec: "avc1.640028", acodec: "none" },
    { height: 2160, vcodec: "vp9", acodec: "none" },
    { height: null, vcodec: "none", acodec: "mp4a.40.2" },
  ],
  subtitles: ["ko"],
};
const opt = {
  mode: "video",
  container: "mp4",
  height: "1080",
  audioFormat: "mp3",
  audioQuality: "192K",
  subtitle: "ko",
  subtitleFormat: "srt",
};
test("MP4 choices reflect codec compatibility; MKV includes source VP9 4K", () => {
  assert.deepEqual(optionsFor(meta, "video", "mp4"), [1080]);
  assert.deepEqual(optionsFor(meta, "video", "mkv"), [2160, 1080]);
  assert.throws(() =>
    buildArgs(meta, { ...opt, height: 4320 }, "C:/out", "C:/bin"),
  );
});
test("URL is a single argument after option terminator; audio conversion is real", () => {
  const args = buildArgs(
    meta,
    opt,
    "C:/folder name/%(title)s.%(ext)s",
    "C:/bin",
  );
  assert.equal(args.at(-2), "--");
  assert.equal(args.at(-1), meta.url);
  assert.ok(args.includes("--merge-output-format"));
  assert.ok(args.includes("--convert-subs"));
  const audio = buildArgs(
    meta,
    { ...opt, mode: "audio", audioFormat: "mp3" },
    "C:/out",
    "C:/bin",
  );
  assert.ok(audio.includes("-x"));
  assert.equal(audio[audio.indexOf("--audio-format") + 1], "mp3");
});
test("DRM formats and insecure thumbnails never enter choices", () => {
  const m = normalizeMeta(
    {
      id: "x",
      formats: [
        { format_id: "1", has_drm: true, url: "https://x" },
        {
          format_id: "2",
          url: "https://x",
          height: 720,
          vcodec: "avc1",
          acodec: "none",
        },
      ],
      thumbnail: "file:///private",
    },
    meta.url,
  );
  assert.equal(m.formats.length, 1);
  assert.equal(m.thumbnail, "");
});
test("settings and jobs persist and interrupted work is recoverable", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flow-test-"));
  const store = new Store(dir, path.join(dir, "downloads"));
  store.save({ smart: true, concurrency: 3 });
  store.put({ id: "1", state: "downloading", title: "test" });
  store.db.close();
  const reopened = new Store(dir, path.join(dir, "downloads"));
  assert.equal(reopened.settings().smart, true);
  assert.equal(reopened.settings().concurrency, 3);
  assert.equal(reopened.get("1").state, "interrupted");
  assert.throws(() => reopened.save({ concurrency: 99 }));
  reopened.remove("1");
  assert.equal(reopened.jobs().length, 0);
  reopened.db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
test("process cancellation rejects instead of reporting a successful download", async () => {
  const c = new AbortController();
  const promise = run(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
    signal: c.signal,
    timeout: 10000,
  });
  setTimeout(() => c.abort(), 100);
  await assert.rejects(promise, /CANCELED/);
});
test("platform access errors are actionable Korean messages", () => {
  assert.match(
    koreanError("Sign in to confirm you are not a bot"),
    /접근을 제한/,
  );
  assert.match(koreanError("ENOSPC"), /여유 공간/);
});
test("per-download validation preserves saved defaults and accepts actual source heights", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flow-options-"));
  const store = new Store(dir, path.join(dir, "output"));
  const opt = store.validate({ mode: "audio", height: "840" });
  assert.equal(opt.mode, "audio");
  assert.equal(opt.height, "840");
  assert.equal(store.settings().mode, "video");
  assert.equal(store.settings().height, "1080");
  store.db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
test("queue respects concurrency, removal never deletes media and queued cancellation is terminal", async () => {
  const map = new Map();
  const store = {
    jobs: () => [...map.values()].reverse(),
    get: (id) => map.get(id),
    put: (j) => map.set(j.id, j),
    remove: (id) => map.delete(id),
    settings: () => ({ concurrency: 1 }),
  };
  const engine = new Engine({ bin: "C:/tools", store });
  let release;
  engine.execute = async () =>
    new Promise((resolve) => {
      release = resolve;
    });
  engine.enqueue(
    [
      { url: meta.url, title: "one" },
      { url: "https://youtu.be/abcdefghijk", title: "two" },
    ],
    opt,
    path.resolve("test-output"),
  );
  assert.equal(engine.running.size, 1);
  const queued = store
    .jobs()
    .find((j) => j.state === "queued" && !engine.running.has(j.id));
  engine.cancel(queued.id);
  assert.equal(store.get(queued.id).state, "canceled");
  assert.throws(() => engine.remove([...engine.running.keys()][0]));
  engine.remove(queued.id);
  assert.equal(store.jobs().length, 1);
  release();
});
