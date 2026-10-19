import { useEffect, useRef, useState } from "react";
import {
  Download,
  History,
  Settings as SettingsIcon,
  Clipboard,
  Search,
  Folder,
  Film,
  Music,
  Info,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  X,
  Minus,
  Square,
  Link as LinkIcon,
  Trash2,
  ExternalLink,
  Loader2,
  Inbox,
  FileVideo,
  Check,
} from "lucide-react";
import type { Analysis, Entry, Health, Job, Media, Settings } from "./types";
const defaults: Settings = {
  folder: "다운로드 / FLOW",
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
const status: Record<string, string> = {
  queued: "대기 중",
  analyzing: "분석 중",
  downloading: "다운로드 중",
  processing: "변환 · 파일 확인 중",
  completed: "다운로드 완료",
  failed: "다운로드 실패",
  canceled: "취소됨",
  canceling: "취소 중",
  interrupted: "중단됨",
};
const terminal = ["completed", "failed", "canceled", "interrupted"];
const bytes = (n: number | null | undefined) =>
  n == null
    ? "—"
    : n >= 1073741824
      ? `${(n / 1073741824).toFixed(1)} GB`
      : n >= 1048576
        ? `${(n / 1048576).toFixed(1)} MB`
        : `${Math.round(n / 1024)} KB`;
const time = (n: number | null | undefined) =>
  n == null
    ? "—"
    : `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
const quality = (h: string) => (h === "best" ? "최고 화질" : `${h}p`);
function Select({
  label,
  value,
  onChange,
  children,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  children: React.ReactNode;
  icon?: typeof Film;
}) {
  return (
    <div className="select-wrap">
      {Icon && <Icon size={21} />}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <ChevronDown size={16} />
    </div>
  );
}
function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`switch ${checked ? "on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    >
      <span />
    </button>
  );
}
function Thumbnail({
  src,
  title,
  duration,
}: {
  src?: string;
  title: string;
  duration?: number | null;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div className="thumbnail">
      {src && !failed ? (
        <img
          src={src}
          alt={title}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <FileVideo size={28} />
      )}{" "}
      {!!duration && <span>{time(duration)}</span>}
    </div>
  );
}
export function App() {
  const [s, setS] = useState<Settings>(defaults),
    [jobs, setJobs] = useState<Job[]>([]),
    [page, setPage] = useState("downloads"),
    [urls, setUrls] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [analysis, setAnalysis] = useState<Analysis | null>(null),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [opt, setOpt] = useState<Settings>(defaults),
    [health, setHealth] = useState<Health[] | null>(null),
    [version, setVersion] = useState("0.1.0"),
    [details, setDetails] = useState<Job | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const api = window.flow;
  useEffect(() => {
    if (!api) return;
    api
      .init()
      .then((r) => {
        setS(r.settings);
        setOpt(r.settings);
        setJobs(r.jobs);
        setVersion(r.version);
      })
      .catch((e) => setError(String(e.message)));
    return api.subscribe(setJobs);
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        s.theme === "system" ? (media.matches ? "dark" : "light") : s.theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [s.theme]);
  useEffect(() => {
    if (!analysis && !details) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const controls = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,textarea,[tabindex="0"]',
        ) || [],
      );
    const frame = requestAnimationFrame(() => controls()[0]?.focus());
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = controls();
      if (!nodes.length) return;
      const first = nodes[0],
        last = nodes.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [analysis, details]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAnalysis(null);
        setDetails(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "l") {
        e.preventDefault();
        setPage("downloads");
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  async function action(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function save(p: Partial<Settings>) {
    if (!api) {
      setS({ ...s, ...p });
      return;
    }
    try {
      setS(await api.settings(p));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function folder(forOptions = false) {
    if (!api) {
      setError("폴더 선택은 설치된 FLOW 앱에서 사용할 수 있습니다.");
      return;
    }
    await action(async () => {
      const f = await api.chooseFolder();
      if (f) {
        if (forOptions) setOpt({ ...opt, folder: f });
        await save({ folder: f });
      }
    });
  }
  async function add(
    entries: { url: string; title: string; thumbnail?: string }[],
    o: Settings,
  ) {
    if (!api) return;
    const r = await api.enqueue(entries, o);
    setAnalysis(null);
    setUrls("");
    setNotice(
      r.duplicates.length
        ? `${entries.length - r.duplicates.length}개 추가 · ${r.duplicates.length}개는 이미 목록에 있습니다.`
        : `${entries.length}개를 대기열에 추가했습니다.`,
    );
  }
  async function analyze(text = urls) {
    if (busy) return;
    if (!api) {
      setError(
        "브라우저는 UI 미리보기입니다. 실제 다운로드는 FLOW 데스크톱 앱에서 사용할 수 있습니다.",
      );
      return;
    }
    const list = [
      ...new Set(
        text
          .split(/\s+/)
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ];
    if (!list.length) {
      input.current?.focus();
      return;
    }
    if (list.length > 200) {
      setError("한 번에 최대 200개 링크를 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (s.smart && list.length > 1) {
        await add(
          list.map((url) => ({ url, title: url })),
          s,
        );
        return;
      }
      if (list.length > 1) {
        setAnalysis({
          type: "collection",
          title: "입력한 링크",
          entries: list.map((url, i) => ({ id: String(i), url, title: url })),
          limited: false,
        });
        setSelected(new Set(list.map((_, i) => String(i))));
        setOpt({ ...s });
        return;
      }
      const a = await api.analyze(list[0]);
      if (a.type === "media" && s.smart) {
        await add([a.media], s);
      } else {
        setAnalysis(a);
        setOpt({ ...s, height: "best" });
        if (a.type === "collection")
          setSelected(new Set(a.entries.map((e) => e.id)));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function paste() {
    if (busy) return;
    if (!api) {
      await action(async () => setUrls(await navigator.clipboard.readText()));
      return;
    }
    await action(async () => {
      const t = await api.clipboard();
      setUrls(t);
      if (s.smart && t.trim()) await analyze(t);
      else input.current?.focus();
    });
  }
  const visible = jobs.filter(
    (j) =>
      (filter === "all" ||
        (filter === "active" && !terminal.includes(j.state)) ||
        j.state === filter) &&
      `${j.title} ${j.platform}`.toLowerCase().includes(query.toLowerCase()),
  );
  const active = jobs.filter((j) => !terminal.includes(j.state)).length;
  function presetFields(
    options: Settings,
    update: (p: Partial<Settings>) => void,
    forModal = false,
    meta?: Media,
  ) {
    const formats = meta?.formats.filter(
      (f) =>
        f.height &&
        f.vcodec !== "none" &&
        (options.container === "mp4"
          ? /^(avc|h264)/i.test(f.vcodec)
          : options.container === "webm"
            ? /^(vp8|vp9|vp0|av01)/i.test(f.vcodec)
            : true),
    );
    const heights = meta
      ? [...new Set(formats?.map((f) => f.height as number))].sort(
          (a, b) => b - a,
        )
      : [
          ...new Set([
            144,
            240,
            360,
            480,
            720,
            1080,
            1440,
            2160,
            4320,
            ...(options.height === "best" ? [] : [Number(options.height)]),
          ]),
        ].sort((a, b) => a - b);
    return (
      <>
        <Select
          label="다운로드 유형"
          icon={options.mode === "video" ? Film : Music}
          value={options.mode}
          onChange={(v) =>
            update({ mode: v as "video" | "audio", height: "best" })
          }
        >
          <option value="video">동영상</option>
          <option
            value="audio"
            disabled={!!meta && !meta.formats.some((f) => f.acodec !== "none")}
          >
            오디오
          </option>
        </Select>
        {options.mode === "video" ? (
          <>
            <Select
              label="영상 형식"
              icon={FileVideo}
              value={options.container}
              onChange={(v) => update({ container: v, height: "best" })}
            >
              <option value="mp4">MP4</option>
              <option value="mkv">MKV</option>
              <option value="webm">WebM</option>
            </Select>
            <Select
              label="화질"
              value={options.height}
              onChange={(v) => update({ height: v })}
            >
              <option value="best">최고 화질</option>
              {heights.map((h) => (
                <option key={h} value={h}>
                  {forModal ? "" : "최대 "}
                  {h}p{h === 2160 ? " · 4K" : h === 4320 ? " · 8K" : ""}
                </option>
              ))}
            </Select>
          </>
        ) : (
          <>
            <Select
              label="오디오 형식"
              icon={Music}
              value={options.audioFormat}
              onChange={(v) => update({ audioFormat: v })}
            >
              <option value="mp3">MP3</option>
              <option value="m4a">M4A</option>
              <option value="wav">WAV</option>
              <option value="original">원본 유지</option>
            </Select>
            {["wav", "original"].includes(options.audioFormat) ? (
              <span className="muted">
                {options.audioFormat === "wav"
                  ? "PCM 오디오로 변환"
                  : "원본 코덱 유지"}
              </span>
            ) : (
              <Select
                label="오디오 품질"
                value={options.audioQuality}
                onChange={(v) => update({ audioQuality: v })}
              >
                <option value="128K">128 kbps</option>
                <option value="192K">192 kbps</option>
                <option value="320K">320 kbps</option>
                <option value="0">최고 품질</option>
              </Select>
            )}
          </>
        )}
        <button
          type="button"
          className="folder-select"
          title={options.folder}
          onClick={() => folder(forModal)}
        >
          <Folder size={21} />
          <span>
            {options.folder
              .split(/[\\/]/)
              .filter(Boolean)
              .slice(-2)
              .join(" / ")}
          </span>
          <ChevronDown size={15} />
        </button>
      </>
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src="./assets/flow-mark.png" alt="" />
          <span>FLOW</span>
        </div>
        <nav>
          <button
            className={page === "downloads" ? "selected" : ""}
            onClick={() => {
              setPage("downloads");
              setFilter("all");
            }}
          >
            <Download />
            <span>다운로드</span>
            {active > 0 && <small>{active}</small>}
          </button>
          <button
            className={page === "history" ? "selected" : ""}
            onClick={() => {
              setPage("history");
              setFilter("all");
            }}
          >
            <History />
            <span>기록</span>
          </button>
        </nav>
        <button
          className={`settings-nav ${page === "settings" ? "selected" : ""}`}
          onClick={() => setPage("settings")}
        >
          <SettingsIcon />
          <span>설정</span>
        </button>
      </aside>
      <div className="workspace">
        <div className="titlebar">
          <span>FLOW · 미디어 다운로더</span>
          <div>
            {[
              ["minimize", Minus, "최소화"],
              ["maximize", Square, "최대화"],
              ["close", X, "닫기"],
            ].map(([a, Icon, label]) => {
              const I = Icon as typeof X;
              return (
                <button
                  key={String(a)}
                  aria-label={String(label)}
                  onClick={() => api?.window(String(a))}
                >
                  <I size={17} />
                </button>
              );
            })}
          </div>
        </div>
        <main>
          {!api && (
            <div className="preview-banner">
              <Info size={16} /> 브라우저 UI 미리보기 · 실제 다운로드는 데스크톱
              앱에서 사용할 수 있습니다.
            </div>
          )}
          {page === "downloads" && (
            <>
              <h1>링크를 파일로, 간편하게.</h1>
              <div
                className={`url-box ${busy ? "busy" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  setUrls(
                    e.dataTransfer.getData("text/uri-list") ||
                      e.dataTransfer.getData("text/plain"),
                  );
                }}
              >
                <textarea
                  ref={input}
                  aria-label="다운로드 링크"
                  placeholder={
                    "YouTube 또는 Instagram 링크를 붙여넣으세요\n여러 링크도 한 번에 추가할 수 있어요."
                  }
                  value={urls}
                  onChange={(e) => setUrls(e.target.value)}
                  onPaste={(e) => {
                    if (s.smart) {
                      e.preventDefault();
                      const t = e.clipboardData.getData("text");
                      setUrls(t);
                      void analyze(t);
                    }
                  }}
                  disabled={busy}
                />
                <button
                  aria-label="링크 붙여넣기"
                  title="링크 붙여넣기"
                  onClick={paste}
                  disabled={busy}
                >
                  <Clipboard size={22} />
                </button>
              </div>
              <p className="input-help">
                여러 링크를 한 줄에 하나씩 입력하세요. <span>Ctrl + L</span>
              </p>
              <section className="smart-band">
                <div className="presets">
                  <div className="smart-switch">
                    <Switch
                      checked={s.smart}
                      label="스마트 모드"
                      onChange={() => save({ smart: !s.smart })}
                    />
                    <strong>스마트 모드</strong>
                    <span title="켜면 링크를 붙여넣는 즉시 아래 설정으로 다운로드합니다.">
                      <Info size={17} />
                    </span>
                  </div>
                  {presetFields(s, (p) => save(p))}
                </div>
                <div className="smart-bottom">
                  <button
                    className="text-button"
                    onClick={() => setPage("settings")}
                  >
                    <SettingsIcon size={21} />
                    설정 변경
                  </button>
                  <span className="smart-hint">
                    {s.smart
                      ? "붙여넣으면 이 설정으로 바로 저장합니다."
                      : "링크 분석 후 저장 옵션을 선택할 수 있습니다."}
                  </span>
                  <button
                    className="primary"
                    disabled={busy || !urls.trim()}
                    onClick={() => analyze()}
                  >
                    {busy ? (
                      <Loader2 className="spin" size={21} />
                    ) : (
                      <Download size={21} />
                    )}{" "}
                    {busy
                      ? "링크 분석 중…"
                      : s.smart
                        ? `${urls.split(/\s+/).filter(Boolean).length || ""}개 다운로드`
                        : "링크 분석"}
                  </button>
                </div>
              </section>
            </>
          )}
          {page !== "settings" ? (
            <section className="downloads">
              <div className="section-heading">
                <h2>
                  {page === "history" ? "다운로드 기록" : "최근 다운로드"}
                  <small>{visible.length > 0 ? visible.length : ""}</small>
                </h2>
                <div className="search">
                  <Search size={19} />
                  <input
                    aria-label="다운로드 검색"
                    placeholder="다운로드 검색"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>
              {(page === "history" || jobs.length > 0) && (
                <div className="filters">
                  {[
                    ["all", "전체"],
                    ["active", "진행 중"],
                    ["completed", "완료"],
                    ["failed", "실패"],
                  ].map(([key, label]) => (
                    <button
                      className={filter === key ? "active" : ""}
                      key={key}
                      onClick={() => setFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {!visible.length ? (
                <div className="empty">
                  <Inbox size={39} />
                  <h3>
                    {query
                      ? "검색 결과가 없습니다"
                      : page === "history"
                        ? "아직 다운로드 기록이 없습니다"
                        : "첫 번째 링크를 추가해 보세요"}
                  </h3>
                  <p>
                    {query
                      ? "다른 검색어나 상태를 선택해 주세요."
                      : "YouTube와 Instagram의 공개 콘텐츠를 내 컴퓨터에 저장하세요."}
                  </p>
                  {page === "downloads" && !query && (
                    <button className="text-button" onClick={paste}>
                      <Clipboard size={17} /> 링크 붙여넣기
                    </button>
                  )}
                </div>
              ) : (
                <div className="job-list">
                  {visible.map((j) => (
                    <article className="job-row" key={j.id}>
                      <Thumbnail
                        src={j.thumbnail}
                        title={j.title}
                        duration={j.duration}
                      />
                      <div className="job-description">
                        <h3 title={j.title}>{j.title}</h3>
                        <p>
                          <LinkIcon size={15} />
                          {j.platform} <span>·</span>{" "}
                          {j.options.mode === "audio"
                            ? j.options.audioFormat.toUpperCase()
                            : `${quality(j.options.height)} · ${j.options.container.toUpperCase()}`}
                        </p>
                        <small>
                          {new Date(j.created).toLocaleString("ko-KR", {
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                      </div>
                      <div className={`job-status ${j.state}`}>
                        {j.state === "downloading" ? (
                          <>
                            <div className="progress-heading">
                              <strong>
                                {j.percent == null
                                  ? "—"
                                  : `${Math.floor(j.percent)}%`}
                              </strong>
                              <div
                                className={`progress ${j.percent == null ? "indeterminate" : ""}`}
                              >
                                <div style={{ width: `${j.percent ?? 0}%` }} />
                              </div>
                            </div>
                            <p>
                              {bytes(j.speed)}/s · 남은 시간{" "}
                              {j.eta == null ? "—" : `${Math.ceil(j.eta)}초`}
                            </p>
                            <small>
                              {bytes(j.downloaded)} / {bytes(j.total)}
                            </small>
                          </>
                        ) : (
                          <>
                            <div className="state-title">
                              {j.state === "completed" ? (
                                <CheckCircle2 size={24} />
                              ) : j.state === "failed" ? (
                                <AlertCircle size={24} />
                              ) : !terminal.includes(j.state) ? (
                                <Loader2 size={22} className="spin" />
                              ) : null}
                              <strong>{status[j.state] || j.state}</strong>
                            </div>
                            <p>
                              {j.error ||
                                (j.state === "completed"
                                  ? bytes(j.total)
                                  : j.state === "queued"
                                    ? "차례가 되면 자동으로 시작합니다."
                                    : j.state === "processing"
                                      ? "병합·변환 후 실제 파일을 확인하고 있습니다."
                                      : "")}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="job-actions">
                        {!terminal.includes(j.state) ? (
                          <button
                            aria-label={`${j.title} 취소`}
                            title="취소"
                            disabled={j.state === "canceling"}
                            onClick={() => action(() => api!.cancel(j.id))}
                          >
                            <X size={19} />
                          </button>
                        ) : (
                          <>
                            {j.state === "completed" ? (
                              <>
                                <button
                                  title="파일 열기"
                                  aria-label={`${j.title} 파일 열기`}
                                  onClick={() =>
                                    action(() => api!.open(j.id, false))
                                  }
                                >
                                  <ExternalLink size={18} />
                                </button>
                                <button
                                  title="폴더 열기"
                                  aria-label={`${j.title} 폴더 열기`}
                                  onClick={() =>
                                    action(() => api!.open(j.id, true))
                                  }
                                >
                                  <Folder size={19} />
                                </button>
                              </>
                            ) : (
                              <button
                                title="다시 시도"
                                aria-label={`${j.title} 다시 시도`}
                                onClick={() => action(() => api!.retry(j.id))}
                              >
                                <RotateCcw size={19} />
                              </button>
                            )}
                            <button
                              title="상세 정보"
                              aria-label={`${j.title} 상세 정보`}
                              onClick={() => setDetails(j)}
                            >
                              <Info size={18} />
                            </button>
                            <button
                              title="목록에서 제거 · 파일 유지"
                              aria-label={`${j.title} 목록에서 제거`}
                              onClick={() => action(() => api!.remove(j.id))}
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="settings-page">
              <h1>설정</h1>
              <p className="muted">자주 쓰는 저장 옵션을 내 방식대로.</p>
              <div className="settings-section">
                <h2>다운로드 기본값</h2>
                <div className="settings-presets">
                  {presetFields(s, (p) => save(p))}
                </div>
                <p className="muted">
                  화질은 최대 해상도이며 실제 원본에서 제공되는 옵션으로만
                  저장합니다.
                </p>
                <label className="setting-row">
                  동시 다운로드
                  <Select
                    label="동시 다운로드"
                    value={String(s.concurrency)}
                    onChange={(v) => save({ concurrency: Number(v) })}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}개
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="setting-row">
                  파일명 규칙
                  <Select
                    label="파일명 규칙"
                    value={s.filename}
                    onChange={(v) => save({ filename: v })}
                  >
                    <option value="title">제목 [미디어 ID]</option>
                    <option value="id">미디어 ID</option>
                  </Select>
                </label>
                <label className="setting-row">
                  자막 형식
                  <Select
                    label="자막 기본 형식"
                    value={s.subtitleFormat}
                    onChange={(v) => save({ subtitleFormat: v })}
                  >
                    <option value="srt">SRT</option>
                    <option value="vtt">VTT</option>
                  </Select>
                </label>
                <div className="setting-row">
                  <div>
                    스마트 모드<p>링크 붙여넣기 시 기본값으로 바로 다운로드</p>
                  </div>
                  <Switch
                    label="스마트 모드 설정"
                    checked={s.smart}
                    onChange={() => save({ smart: !s.smart })}
                  />
                </div>
                <div className="setting-row">
                  <div>
                    앨범 아트 삽입<p>MP3/M4A, 원본에서 제공될 때만 적용</p>
                  </div>
                  <Switch
                    label="앨범 아트 삽입"
                    checked={s.cover}
                    onChange={() => save({ cover: !s.cover })}
                  />
                </div>
              </div>
              <div className="settings-section">
                <h2>외관과 알림</h2>
                <label className="setting-row">
                  테마
                  <Select
                    label="테마"
                    value={s.theme}
                    onChange={(v) => save({ theme: v as Settings["theme"] })}
                  >
                    <option value="light">라이트</option>
                    <option value="dark">다크</option>
                    <option value="system">시스템</option>
                  </Select>
                </label>
                <div className="setting-row">
                  다운로드 완료 알림
                  <Switch
                    label="완료 알림"
                    checked={s.notifications}
                    onChange={() => save({ notifications: !s.notifications })}
                  />
                </div>
              </div>
              <div className="settings-section">
                <h2>다운로드 엔진</h2>
                <p className="muted">
                  yt-dlp · FFmpeg · FFprobe · Deno를 앱에 포함합니다.
                </p>
                <button
                  onClick={() =>
                    action(async () => {
                      if (api) setHealth(await api.health());
                      else
                        setError(
                          "엔진 확인은 데스크톱 앱에서 사용할 수 있습니다.",
                        );
                    })
                  }
                >
                  <RotateCcw size={17} /> 엔진 상태 확인
                </button>
                {health?.map((h) => (
                  <div key={h.name} className="health">
                    <span>
                      {h.ok ? <Check size={16} /> : <AlertCircle size={16} />}{" "}
                      {h.name}
                    </span>
                    <code>{h.version}</code>
                  </div>
                ))}
                <p className="muted">
                  엔진은 앱 업데이트에 함께 포함됩니다. 플랫폼 변경으로 추출이
                  제한될 수 있습니다.
                </p>
                <small className="muted">
                  FLOW {version} · 설정과 기록은 이 PC에만 보관됩니다.
                </small>
              </div>
            </section>
          )}
          <footer>
            <span>
              <Info size={17} />
              저장할 권한이 있는 콘텐츠만 다운로드하세요.
            </span>
            <span>FLOW {version}</span>
          </footer>
        </main>
      </div>
      {error && (
        <div className="error-toast" role="alert">
          <AlertCircle size={20} />
          <div>
            <strong>확인해 주세요</strong>
            <p>{error}</p>
          </div>
          <button aria-label="오류 닫기" onClick={() => setError("")}>
            <X size={18} />
          </button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
      {analysis && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAnalysis(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="options-heading"
          >
            <div className="modal-heading">
              <h2 id="options-heading">
                {analysis.type === "media"
                  ? "다운로드 옵션"
                  : "다운로드 항목 선택"}
              </h2>
              <button aria-label="옵션 닫기" onClick={() => setAnalysis(null)}>
                <X />
              </button>
            </div>
            {analysis.type === "media" ? (
              <>
                <div className="media-summary">
                  <Thumbnail
                    src={analysis.media.thumbnail}
                    title={analysis.media.title}
                    duration={analysis.media.duration}
                  />
                  <div>
                    <h3>{analysis.media.title}</h3>
                    <p>
                      {analysis.media.uploader} ·{" "}
                      {time(analysis.media.duration)}
                    </p>
                  </div>
                </div>
                <div className="option-fields">
                  {presetFields(
                    opt,
                    (p) => setOpt({ ...opt, ...p }),
                    true,
                    analysis.media,
                  )}
                </div>
                <p className="muted">
                  {analysis.media.formats.length}개 원본 스트림 확인 · 호환
                  가능한 코덱과 화질만 표시합니다.
                </p>
                <FormatSummary media={analysis.media} options={opt} />
                <label className="setting-row">
                  자막
                  <Select
                    label="자막 언어"
                    value={opt.subtitle}
                    onChange={(v) => setOpt({ ...opt, subtitle: v })}
                  >
                    <option value="">저장 안 함</option>
                    {analysis.media.subtitles.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </label>
              </>
            ) : (
              <>
                <h3>{analysis.title}</h3>
                <p className="muted">
                  선택한 항목은 대기열에서 각각 분석합니다.
                  {analysis.limited ? " 목록은 처음 200개까지 표시됩니다." : ""}
                </p>
                <button
                  className="text-button"
                  onClick={() =>
                    setSelected(
                      selected.size === analysis.entries.length
                        ? new Set()
                        : new Set(analysis.entries.map((e) => e.id)),
                    )
                  }
                >
                  {selected.size === analysis.entries.length
                    ? "전체 해제"
                    : "전체 선택"}{" "}
                  · {selected.size}개 선택됨
                </button>
                <div className="collection-list">
                  {analysis.entries.map((e) => (
                    <label key={e.id}>
                      <input
                        type="checkbox"
                        checked={selected.has(e.id)}
                        onChange={() => {
                          const next = new Set(selected);
                          next.has(e.id) ? next.delete(e.id) : next.add(e.id);
                          setSelected(next);
                        }}
                      />
                      <span>{e.title}</span>
                      <small>{time(e.duration)}</small>
                    </label>
                  ))}
                </div>
                <div className="option-fields">
                  {presetFields(opt, (p) => setOpt({ ...opt, ...p }), true)}
                </div>
              </>
            )}
            <div className="modal-bottom">
              <button onClick={() => setAnalysis(null)}>취소</button>
              <button
                className="primary"
                disabled={
                  busy ||
                  (analysis.type === "collection" && !selected.size) ||
                  (analysis.type === "media" &&
                    !analysis.media.formats.some((f) =>
                      opt.mode === "audio"
                        ? f.acodec !== "none"
                        : Boolean(f.height) &&
                          f.vcodec !== "none" &&
                          (opt.container === "mp4"
                            ? /^(avc|h264)/i.test(f.vcodec)
                            : opt.container === "webm"
                              ? /^(vp8|vp9|vp0|av01)/i.test(f.vcodec)
                              : true),
                    ))
                }
                onClick={() =>
                  action(async () => {
                    setBusy(true);
                    try {
                      await add(
                        analysis.type === "media"
                          ? [analysis.media]
                          : analysis.entries.filter((e) => selected.has(e.id)),
                        opt,
                      );
                    } finally {
                      setBusy(false);
                    }
                  })
                }
              >
                <Download size={19} />{" "}
                {analysis.type === "media"
                  ? "다운로드 시작"
                  : `${selected.size}개 다운로드`}
              </button>
            </div>
          </section>
        </div>
      )}
      {details && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="작업 상세"
          >
            <div className="modal-heading">
              <h2>작업 상세</h2>
              <button aria-label="상세 닫기" onClick={() => setDetails(null)}>
                <X />
              </button>
            </div>
            <h3>{details.title}</h3>
            <p>{details.url}</p>
            <p>저장 위치: {details.file || details.folder}</p>
            <p>{details.error || status[details.state]}</p>
            {details.detail && <pre>{details.detail}</pre>}
            <p className="muted">
              목록에서 제거해도 저장한 파일은 삭제하지 않습니다.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
function FormatSummary({
  media,
  options,
}: {
  media: Media;
  options: Settings;
}) {
  const f = media.formats
    .filter((f) =>
      options.mode === "audio"
        ? f.acodec !== "none"
        : f.vcodec !== "none" &&
          (options.height === "best" || f.height === Number(options.height)) &&
          (options.container === "mp4"
            ? /^(avc|h264)/i.test(f.vcodec)
            : options.container === "webm"
              ? /^(vp8|vp9|vp0|av01)/i.test(f.vcodec)
              : true),
    )
    .sort((a, b) => (b.height || b.abr || 0) - (a.height || a.abr || 0))[0];
  return (
    <div className="format-summary">
      <span>
        코덱{" "}
        <strong>
          {f
            ? [f.vcodec, f.acodec].filter((c) => c !== "none").join(" · ")
            : "호환 가능한 스트림 없음"}
        </strong>
      </span>
      <span>
        원본 스트림 크기 <strong>{bytes(f?.size)}</strong>
      </span>
      <small>병합·변환 후 최종 용량은 달라질 수 있습니다.</small>
    </div>
  );
}
