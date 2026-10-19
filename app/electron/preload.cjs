const { contextBridge, ipcRenderer } = require("electron");
const invoke = async (method, ...args) => {
  try {
    return await ipcRenderer.invoke("flow:call", method, ...args);
  } catch (error) {
    throw Error(
      String(error.message).replace(
        /^Error invoking remote method '[^']+': (?:Error: )?/,
        "",
      ),
    );
  }
};
contextBridge.exposeInMainWorld("flow", {
  init: () => invoke("init"),
  analyze: (url) => invoke("analyze", url),
  enqueue: (entries, options) => invoke("enqueue", entries, options),
  settings: (values) => invoke("settings", values),
  chooseFolder: () => invoke("chooseFolder"),
  clipboard: () => invoke("clipboard"),
  cancel: (id) => invoke("cancel", id),
  retry: (id) => invoke("retry", id),
  remove: (id) => invoke("remove", id),
  open: (id, folder) => invoke("open", id, folder),
  health: () => invoke("health"),
  window: (action) => invoke("window", action),
  subscribe: (callback) => {
    const fn = (_event, jobs) => callback(jobs);
    ipcRenderer.on("flow:jobs", fn);
    return () => ipcRenderer.removeListener("flow:jobs", fn);
  },
});
