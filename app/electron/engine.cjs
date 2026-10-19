const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { EventEmitter } = require("node:events");

function validateUrl(value) {
  if (typeof value !== "string" || value.length > 4096)
    throw Error("올바른 링크를 입력해 주세요.");
  let u;
  try {
    u = new URL(value.trim());
  } catch {
    throw Error("올바른 URL이 아닙니다.");
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port)
    throw Error("HTTPS 공개 링크만 지원합니다.");
  const h = u.hostname.toLowerCase();
  if (
    [
      "www.youtube.com",
      "youtube.com",
      "m.youtube.com",
      "music.youtube.com",
    ].includes(h)
  ) {
    if (!/^\/(watch|shorts\/|playlist|@|channel\/|c\/|user\/)/.test(u.pathname))
      throw Error(
        "YouTube 영상, 재생목록 또는 공개 채널 링크를 입력해 주세요.",
      );
  } else if (h === "youtu.be") {
    if (!/^\/[\w-]{6,}/.test(u.pathname))
      throw Error("YouTube 영상 링크가 아닙니다.");
  } else if (["instagram.com", "www.instagram.com"].includes(h)) {
    if (!/^\/(p|reel|reels|tv)\/[\w-]+/.test(u.pathname))
      throw Error("Instagram 공개 게시물 또는 릴스 링크를 입력해 주세요.");
  } else throw Error("YouTube와 Instagram 링크만 지원합니다.");
  u.hash = "";
  return u.href;
}
function koreanError(message) {
  const t = String(message);
  if (/ENOENT|not found|ffmpeg.*not/i.test(t))
    return "다운로드 엔진 또는 FFmpeg를 찾을 수 없습니다. 설정에서 엔진 상태를 확인해 주세요.";
  if (
    /private|login|sign in|cookies|403|age.restrict|not available|unavailable|removed|deleted|restricted|429/i.test(
      t,
    )
  )
    return "콘텐츠가 삭제되었거나 플랫폼에서 접근을 제한했습니다. 공개 링크인지 확인해 주세요. 인증이나 접근 제한을 우회하지 않습니다.";
  if (/ENOSPC|No space|disk full/i.test(t))
    return "디스크 여유 공간이 부족합니다. 저장 위치를 확인해 주세요.";
  if (/EACCES|EPERM|Permission denied/i.test(t))
    return "저장 폴더에 쓸 수 없습니다. 다른 폴더를 선택해 주세요.";
  if (/timed? ?out|network|connection|resolve|TLS|SSL/i.test(t))
    return "네트워크 연결 또는 서버 응답에 문제가 있습니다. 잠시 후 다시 시도해 주세요.";
  if (/format.*not available|no.*formats/i.test(t))
    return "선택한 형식을 제공하지 않습니다. 링크를 다시 분석해 주세요.";
  return "처리하지 못했습니다. 오류 상세를 확인하고 링크를 다시 분석해 주세요.";
}
function parseProgress(line) {
  if (!line.startsWith("FLOW_PROGRESS:")) return null;
  try {
    const p = JSON.parse(line.slice(14));
    const num = (v) => (Number.isFinite(v) && v >= 0 ? v : null);
    const downloaded = num(p.downloaded_bytes),
      total = num(p.total_bytes) ?? num(p.total_bytes_estimate);
    return {
      downloaded,
      total,
      speed: num(p.speed),
      eta: num(p.eta),
      percent:
        total && downloaded !== null
          ? Math.min(100, (downloaded / total) * 100)
          : null,
    };
  } catch {
    return null;
  }
}
function run(
  exe,
  args,
  { signal, onLine, timeout = 120000, maxOutput = 32 * 1024 * 1024 } = {},
) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Error("CANCELED"));
    const child = spawn(exe, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "",
      err = "",
      pending = "",
      settled = false;
    const kill = () => {
      if (child.pid && process.platform === "win32")
        spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      else child.kill("SIGKILL");
    };
    const timer = setTimeout(() => {
      kill();
      finish(Error("network timeout"));
    }, timeout);
    timer.unref();
    const cancel = () => {
      kill();
    };
    signal?.addEventListener("abort", cancel, { once: true });
    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      error ? reject(error) : resolve(result);
    }
    child.stdout.on("data", (b) => {
      const text = b.toString();
      out += text;
      pending += text;
      let i;
      while ((i = pending.indexOf("\n")) >= 0) {
        try {
          onLine?.(pending.slice(0, i).trim());
        } catch (error) {
          kill();
          finish(error);
          return;
        }
        pending = pending.slice(i + 1);
      }
      if (out.length > maxOutput) {
        kill();
        finish(Error("분석 결과가 너무 큽니다. 더 작은 목록을 선택해 주세요."));
      }
    });
    child.stderr.on("data", (b) => {
      err = (err + b.toString()).slice(-20000);
    });
    child.on("error", (e) => finish(e));
    child.on("close", (code) => {
      if (pending) {
        try {
          onLine?.(pending.trim());
        } catch (error) {
          finish(error);
          return;
        }
      }
      finish(
        signal?.aborted
          ? Error("CANCELED")
          : code !== 0
            ? Error(err || `engine exit ${code}`)
            : null,
        { stdout: out, stderr: err },
      );
    });
  });
}
function normalizeMeta(info, url) {
  const formats = (info.formats || [])
    .filter((f) => !f.has_drm && f.format_id && /^https?:/.test(f.url || ""))
    .map((f) => ({
      id: String(f.format_id),
      ext: f.ext,
      height: f.height || null,
      vcodec: f.vcodec || "none",
      acodec: f.acodec || "none",
      size: f.filesize || f.filesize_approx || null,
      abr: f.abr || null,
      fps: f.fps || null,
    }));
  let thumb = info.thumbnail || info.thumbnails?.at(-1)?.url || "";
  if (!/^https:\/\//.test(thumb)) thumb = "";
  return {
    id: String(info.id || randomUUID()),
    url,
    title: info.title || "제목 없는 미디어",
    uploader: info.uploader || info.channel || "",
    duration: info.duration || null,
    thumbnail: thumb,
    platform: url.includes("instagram.com") ? "Instagram" : "YouTube",
    formats,
    subtitles: Object.keys(info.subtitles || {}),
    automaticCaptions: Object.keys(info.automatic_captions || {}),
  };
}
function optionsFor(meta, mode, container) {
  if (mode === "audio")
    return meta.formats.some((f) => f.acodec !== "none") ? ["best"] : [];
  const video = meta.formats.filter((f) => f.vcodec !== "none" && f.height);
  // MP4 stays compatible with broadly playable H.264/AAC; MKV accepts other codecs.
  const compatible = video.filter((f) =>
    container === "mp4"
      ? /^(avc|h264)/i.test(f.vcodec)
      : container === "webm"
        ? /^(vp8|vp9|vp0|av01)/i.test(f.vcodec)
        : true,
  );
  return [...new Set(compatible.map((f) => f.height))].sort((a, b) => b - a);
}
function buildArgs(meta, opt, output, bin) {
  if (!["video", "audio"].includes(opt.mode))
    throw Error("잘못된 다운로드 유형입니다.");
  if (
    !["mp4", "mkv", "webm"].includes(opt.container) ||
    !["mp3", "m4a", "wav", "original"].includes(opt.audioFormat)
  )
    throw Error("지원하지 않는 형식입니다.");
  const args = [
    "--ignore-config",
    "--no-playlist",
    "--no-overwrites",
    "--windows-filenames",
    "--trim-filenames",
    "160",
    "--retries",
    "2",
    "--fragment-retries",
    "2",
    "--socket-timeout",
    "20",
    "--ffmpeg-location",
    bin,
    "--js-runtimes",
    `deno:${path.join(bin, "deno.exe")}`,
    "--newline",
    "--progress",
    "--progress-template",
    "download:FLOW_PROGRESS:%(progress)j",
    "--print",
    "after_move:FLOW_FILE:%(filepath)j",
    "-o",
    output,
    "--embed-metadata",
  ];
  if (opt.mode === "audio") {
    args.push(
      "-f",
      opt.audioFormat === "m4a"
        ? "bestaudio[ext=m4a]/bestaudio/best"
        : "bestaudio/best",
      "-x",
    );
    if (opt.audioFormat !== "original")
      args.push(
        "--audio-format",
        opt.audioFormat,
        "--audio-quality",
        String(opt.audioQuality || "192K"),
      );
    if (opt.cover && ["mp3", "m4a"].includes(opt.audioFormat))
      args.push("--embed-thumbnail");
  } else {
    const heights = optionsFor(meta, "video", opt.container);
    const height = opt.height === "best" ? heights[0] : Number(opt.height);
    if (!heights.includes(height))
      throw Error("선택한 화질을 제공하지 않습니다.");
    const vf =
      opt.container === "mp4"
        ? "[vcodec^=avc]"
        : opt.container === "webm"
          ? '[vcodec~="^(vp|av01)"]'
          : "";
    const af =
      opt.container === "mp4"
        ? "[acodec^=mp4a]"
        : opt.container === "webm"
          ? "[acodec=opus]"
          : "";
    args.push(
      "-f",
      `bestvideo[height<=${height}]${vf}+bestaudio${af}/best[height<=${height}]${vf}/bestvideo[height<=${height}]${vf}`,
      "--merge-output-format",
      opt.container,
      "--remux-video",
      opt.container,
    );
  }
  if (opt.subtitle && meta.subtitles.includes(opt.subtitle))
    args.push(
      "--write-subs",
      "--sub-langs",
      opt.subtitle,
      "--sub-format",
      "vtt/best",
      "--convert-subs",
      opt.subtitleFormat === "srt" ? "srt" : "vtt",
    );
  if (meta.itemIndex) {
    args.splice(args.indexOf("--no-playlist"), 1);
    args.push("--yes-playlist", "--playlist-items", String(meta.itemIndex));
  }
  args.push("--", validateUrl(meta.url));
  return args;
}
class Engine extends EventEmitter {
  constructor({ bin, store, notify }) {
    super();
    this.bin = bin;
    this.store = store;
    this.notify = notify;
    this.running = new Map();
    this.analysis = new Map();
    this.pumping = false;
  }
  exe(name) {
    return path.join(this.bin, `${name}.exe`);
  }
  async health() {
    return Promise.all(
      ["yt-dlp", "ffmpeg", "ffprobe", "deno"].map(async (name) => {
        try {
          const r = await run(
            this.exe(name),
            [
              name === "yt-dlp"
                ? "--version"
                : name === "deno"
                  ? "--version"
                  : "-version",
            ],
            { timeout: 10000 },
          );
          return { name, ok: true, version: r.stdout.split("\n")[0] };
        } catch {
          return { name, ok: false, version: "찾을 수 없음" };
        }
      }),
    );
  }
  base() {
    return [
      "--ignore-config",
      "--js-runtimes",
      `deno:${this.exe("deno")}`,
      "--socket-timeout",
      "20",
      "--retries",
      "2",
      "--no-warnings",
    ];
  }
  async analyze(url) {
    url = validateUrl(url);
    const key = randomUUID(),
      ctrl = new AbortController();
    this.analysis.set(key, ctrl);
    try {
      const r = await run(
        this.exe("yt-dlp"),
        [
          ...this.base(),
          "-J",
          "--flat-playlist",
          "--playlist-end",
          "200",
          "--",
          url,
        ],
        { signal: ctrl.signal },
      );
      const info = JSON.parse(r.stdout);
      if (info.entries) {
        const entries = info.entries
          .filter(Boolean)
          .map((e, i) => {
            let u = url.includes("instagram.com")
              ? url
              : e.webpage_url || e.url;
            if (!u?.startsWith("https:") && url.includes("youtu"))
              u = `https://www.youtube.com/watch?v=${e.id}`;
            try {
              u = validateUrl(u);
            } catch {
              return null;
            }
            return {
              id: String(e.id || i),
              url: u,
              title: e.title || `미디어 ${i + 1}`,
              duration: e.duration || null,
              itemIndex: url.includes("instagram.com") ? i + 1 : undefined,
            };
          })
          .filter(Boolean);
        return {
          type: "collection",
          title: info.title || "미디어 목록",
          entries,
          limited: info.playlist_count > 200,
        };
      }
      return { type: "media", media: normalizeMeta(info, url) };
    } catch (e) {
      throw Error(`${koreanError(e.message)}\n${e.message.slice(-1800)}`);
    } finally {
      this.analysis.delete(key);
    }
  }
  async detail(url, signal, itemIndex) {
    const r = await run(
      this.exe("yt-dlp"),
      [
        ...this.base(),
        "-J",
        ...(itemIndex
          ? ["--yes-playlist", "--playlist-items", String(itemIndex)]
          : ["--no-playlist"]),
        "--",
        validateUrl(url),
      ],
      { signal },
    );
    let info = JSON.parse(r.stdout);
    if (itemIndex && info.entries) info = info.entries.filter(Boolean)[0];
    if (!info) throw Error("선택한 게시물 미디어를 찾을 수 없습니다.");
    return { ...normalizeMeta(info, url), itemIndex };
  }
  enqueue(entries, options, folder) {
    if (!path.isAbsolute(folder))
      throw Error("올바른 저장 폴더를 선택해 주세요.");
    const duplicates = [];
    for (const entry of entries) {
      const url = validateUrl(entry.url);
      const itemIndex = entry.itemIndex;
      if (
        itemIndex !== undefined &&
        (!Number.isInteger(itemIndex) ||
          itemIndex < 1 ||
          itemIndex > 200 ||
          !url.includes("instagram.com"))
      )
        throw Error("게시물 항목 번호를 확인해 주세요.");
      const key = JSON.stringify([
        url,
        itemIndex,
        options.mode,
        options.container,
        options.audioFormat,
        options.height,
      ]);
      if (
        this.store
          .jobs()
          .some(
            (j) =>
              j.key === key &&
              !["failed", "canceled", "interrupted"].includes(j.state),
          )
      ) {
        duplicates.push(entry.title || url);
        continue;
      }
      const j = {
        id: randomUUID(),
        key,
        url,
        itemIndex,
        title: entry.title || url,
        thumbnail: entry.thumbnail || "",
        platform: url.includes("instagram") ? "Instagram" : "YouTube",
        state: "queued",
        created: new Date().toISOString(),
        options: { ...options },
        folder,
        percent: null,
        total: null,
        downloaded: null,
        speed: null,
        eta: null,
        error: null,
        file: null,
      };
      this.store.put(j);
    }
    this.changed();
    this.pump();
    return { duplicates };
  }
  changed() {
    this.emit("change", this.store.jobs());
  }
  patch(id, values) {
    const j = this.store.get(id);
    if (!j) return;
    this.store.put({ ...j, ...values });
    this.changed();
  }
  pump() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      const max = this.store.settings().concurrency;
      for (const j of this.store
        .jobs()
        .filter((j) => j.state === "queued")
        .reverse()) {
        if (this.running.size >= max) break;
        const ctrl = new AbortController();
        this.running.set(j.id, ctrl);
        this.execute(j, ctrl).finally(() => {
          this.running.delete(j.id);
          this.pump();
        });
      }
    } finally {
      this.pumping = false;
    }
  }
  async execute(j, ctrl) {
    const temp = path.join(j.folder, ".flow-temp", j.id);
    try {
      fs.mkdirSync(j.folder, { recursive: true });
      fs.accessSync(j.folder, fs.constants.W_OK);
      this.patch(j.id, { state: "analyzing", error: null });
      const meta = await this.detail(j.url, ctrl.signal, j.itemIndex);
      if (ctrl.signal.aborted) throw Error("CANCELED");
      if (!meta.formats.length) throw Error("no formats available");
      // Smart mode chooses the highest actually available resolution at or below the cap.
      const options = { ...j.options };
      if (options.mode === "video") {
        const heights = optionsFor(meta, "video", options.container);
        if (options.height !== "best") {
          const h = heights.find((h) => h <= Number(options.height));
          if (!h) throw Error("format not available");
          options.height = h;
        }
      }
      fs.mkdirSync(temp, { recursive: true });
      const suffix = j.id.slice(0, 8);
      const template =
        this.store.settings().filename === "id"
          ? `%(id)s-${suffix}.%(ext)s`
          : `%(title)s [%(id)s]-${suffix}.%(ext)s`;
      const output = path.join(j.folder, template);
      let file = null,
        lastSave = 0;
      this.patch(j.id, {
        title: meta.title,
        thumbnail: meta.thumbnail,
        duration: meta.duration,
        uploader: meta.uploader,
        state: "downloading",
        options,
      });
      const args = buildArgs(meta, options, output, this.bin);
      args.unshift("--paths", `temp:${temp}`);
      await run(this.exe("yt-dlp"), args, {
        signal: ctrl.signal,
        timeout: 24 * 60 * 60 * 1000,
        onLine: (line) => {
          if (line.startsWith("FLOW_FILE:")) {
            try {
              file = JSON.parse(line.slice(10));
            } catch {
              file = line.slice(10);
            }
          }
          if (
            /^\[(Merger|ExtractAudio|VideoRemuxer|Metadata|EmbedThumbnail|SubtitlesConvertor)\]/.test(
              line,
            )
          )
            this.patch(j.id, { state: "processing", speed: null, eta: null });
          const p = parseProgress(line);
          if (p && Date.now() - lastSave > 300) {
            lastSave = Date.now();
            this.patch(j.id, { ...p, state: "downloading" });
          }
        },
      });
      if (ctrl.signal.aborted) throw Error("CANCELED");
      if (!file || !fs.existsSync(file))
        throw Error("완료 파일 경로를 확인할 수 없습니다.");
      this.patch(j.id, {
        state: "processing",
        percent: null,
        speed: null,
        eta: null,
      });
      const probe = await run(
        this.exe("ffprobe"),
        ["-v", "error", "-show_streams", "-show_format", "-of", "json", file],
        { signal: ctrl.signal },
      );
      const media = JSON.parse(probe.stdout);
      if (
        !media.streams?.some(
          (s) =>
            s.codec_type === (options.mode === "audio" ? "audio" : "video"),
        )
      )
        throw Error("미디어 스트림 검증에 실패했습니다.");
      this.patch(j.id, {
        state: "completed",
        file,
        percent: 100,
        total: fs.statSync(file).size,
        downloaded: fs.statSync(file).size,
        finished: new Date().toISOString(),
      });
      if (this.store.settings().notifications) {
        try {
          this.notify?.(meta.title);
        } catch (error) {
          console.warn("Completion notification unavailable:", error.message);
        }
      }
    } catch (e) {
      this.patch(j.id, {
        state: ctrl.signal.aborted ? "canceled" : "failed",
        error: ctrl.signal.aborted ? null : koreanError(e.message),
        detail: ctrl.signal.aborted ? null : e.message.slice(-3000),
        speed: null,
        eta: null,
      });
    } finally {
      try {
        const expectedRoot = path.resolve(j.folder, ".flow-temp") + path.sep;
        if (
          path.resolve(temp).startsWith(expectedRoot) &&
          path.basename(temp) === j.id
        )
          fs.rmSync(temp, { recursive: true, force: true });
      } catch {}
    }
  }
  cancel(id) {
    const c = this.running.get(id);
    if (c) {
      c.abort();
      this.patch(id, { state: "canceling" });
    } else if (this.store.get(id)?.state === "queued")
      this.patch(id, { state: "canceled" });
  }
  retry(id) {
    const j = this.store.get(id);
    if (!j || !["failed", "canceled", "interrupted"].includes(j.state)) return;
    this.patch(id, {
      state: "queued",
      percent: null,
      error: null,
      detail: null,
    });
    this.pump();
  }
  remove(id) {
    if (this.running.has(id))
      throw Error("진행 중인 작업은 취소한 후 제거해 주세요.");
    this.store.remove(id);
    this.changed();
  }
  stop() {
    for (const c of this.analysis.values()) c.abort();
    for (const c of this.running.values()) c.abort();
  }
}
module.exports = {
  validateUrl,
  koreanError,
  parseProgress,
  run,
  normalizeMeta,
  optionsFor,
  buildArgs,
  Engine,
};
