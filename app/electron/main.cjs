const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  clipboard,
  shell,
  Notification,
  protocol,
  net,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { Store } = require("./store.cjs");
const { Engine, validateUrl } = require("./engine.cjs");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "flow",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);
let window, engine, store;
if (process.env.FLOW_DATA_DIR)
  app.setPath("userData", path.resolve(process.env.FLOW_DATA_DIR));
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    window?.show();
    window?.focus();
  });
  app.whenReady().then(() => {
    const root = path.join(__dirname, "../dist/client");
    protocol.handle("flow", async (request) => {
      const u = new URL(request.url);
      const target = path.resolve(
        root,
        decodeURIComponent(u.pathname).replace(/^\//, ""),
      );
      if (
        u.hostname !== "app" ||
        (!target.startsWith(root + path.sep) && target !== root)
      )
        return new Response("Forbidden", { status: 403 });
      const file = target === root ? path.join(root, "index.html") : target;
      const mime = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
      };
      try {
        return new Response(await fs.promises.readFile(file), {
          headers: {
            "Content-Type":
              mime[path.extname(file)] || "application/octet-stream",
          },
        });
      } catch (error) {
        console.error("App resource load failed:", file, error.code);
        return new Response("Not found", { status: 404 });
      }
    });
    store = new Store(
      app.getPath("userData"),
      path.join(app.getPath("downloads"), "FLOW"),
    );
    engine = new Engine({
      bin: app.isPackaged
        ? path.join(process.resourcesPath, "bin")
        : path.join(__dirname, "../resources/bin"),
      store,
      notify: (title) => {
        if (Notification.isSupported())
          new Notification({
            title: "FLOW · 다운로드 완료",
            body: title,
          }).show();
      },
    });
    window = new BrowserWindow({
      width: 1440,
      height: 1024,
      minWidth: 1040,
      minHeight: 730,
      title: "FLOW",
      frame: false,
      show: true,
      backgroundColor: "#ffffff",
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("did-fail-load", (_event, code, description) =>
      console.error("Renderer load failed", code, description),
    );
    window.webContents.on("render-process-gone", (_event, details) =>
      console.error("Renderer process ended", details.reason),
    );
    window.webContents.on("will-navigate", (e, url) => {
      if (!url.startsWith("flow://app/")) e.preventDefault();
    });
    window.webContents.session.setPermissionRequestHandler((_wc, _p, cb) =>
      cb(false),
    );
    window.webContents.session.webRequest.onHeadersReceived((details, cb) =>
      cb({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'",
          ],
        },
      }),
    );
    engine.on("change", (jobs) => {
      if (!window.isDestroyed()) window.webContents.send("flow:jobs", jobs);
    });
    ipcMain.handle("flow:call", async (event, method, ...args) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        !event.senderFrame.url.startsWith("flow://app/")
      )
        throw Error("허용되지 않은 요청입니다.");
      const id = args[0];
      switch (method) {
        case "init":
          return {
            settings: store.settings(),
            jobs: store.jobs(),
            version: app.getVersion(),
          };
        case "analyze":
          return engine.analyze(validateUrl(id));
        case "enqueue": {
          const [entries, opt] = args;
          if (
            !Array.isArray(entries) ||
            entries.length < 1 ||
            entries.length > 200
          )
            throw Error("한 번에 1~200개를 추가해 주세요.");
          const settings = store.validate({
            ...store.settings(),
            ...opt,
            folder: store.settings().folder,
          });
          return engine.enqueue(entries, settings, settings.folder);
        }
        case "settings": {
          const settings = store.save(args[0] || {});
          engine.pump();
          return settings;
        }
        case "health":
          return engine.health();
        case "chooseFolder": {
          const r = await dialog.showOpenDialog(window, {
            title: "저장 폴더 선택",
            defaultPath: store.settings().folder,
            properties: ["openDirectory", "createDirectory"],
          });
          return r.canceled ? null : r.filePaths[0];
        }
        case "clipboard":
          return clipboard.readText().slice(0, 100000);
        case "cancel":
          engine.cancel(id);
          return;
        case "retry":
          engine.retry(id);
          return;
        case "remove":
          engine.remove(id);
          return;
        case "open": {
          const j = store.get(id);
          if (!j) throw Error("기록을 찾을 수 없습니다.");
          if (args[1]) {
            if (j.file && fs.existsSync(j.file)) shell.showItemInFolder(j.file);
            else {
              const err = await shell.openPath(j.folder);
              if (err) throw Error(err);
            }
          } else {
            if (j.state !== "completed" || !j.file || !fs.existsSync(j.file))
              throw Error(
                "파일을 찾을 수 없습니다. 이동 또는 삭제되었는지 확인해 주세요.",
              );
            if (
              ![
                ".mp4",
                ".mkv",
                ".webm",
                ".mp3",
                ".m4a",
                ".wav",
                ".opus",
                ".ogg",
                ".flac",
                ".aac",
              ].includes(path.extname(j.file).toLowerCase())
            )
              throw Error("허용되지 않은 파일 형식입니다.");
            const err = await shell.openPath(j.file);
            if (err) throw Error(err);
          }
          return;
        }
        case "window":
          if (id === "minimize") window.minimize();
          else if (id === "maximize")
            window.isMaximized() ? window.unmaximize() : window.maximize();
          else if (id === "close") window.close();
          return;
        default:
          throw Error("지원하지 않는 요청입니다.");
      }
    });
    window.once("ready-to-show", () => window.show());
    window.loadURL("flow://app/index.html");
    engine.pump();
    window.on("close", (event) => {
      if (engine.running.size) {
        const answer = dialog.showMessageBoxSync(window, {
          type: "question",
          buttons: ["계속 다운로드", "작업 중단 후 종료"],
          defaultId: 0,
          cancelId: 0,
          title: "다운로드 중",
          message:
            "앱을 종료하면 현재 다운로드가 중단됩니다. 다음 실행에서 다시 시도할 수 있습니다.",
        });
        if (answer === 0) {
          event.preventDefault();
          return;
        }
        engine.stop();
      }
    });
  });
  app.on("window-all-closed", () => {
    engine?.stop();
    app.quit();
  });
}
