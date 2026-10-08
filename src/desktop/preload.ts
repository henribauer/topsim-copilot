// Verb-only bridge: named operations, no ipcRenderer, no generic invoke(channel), no arguments except a fixed choice.
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("topsim", {
  chooseHandbook: () => ipcRenderer.invoke("handbook:choose"),
  clearHandbook: () => ipcRenderer.invoke("handbook:clear"),
  chooseLectureFolder: () => ipcRenderer.invoke("lecture:choose"),
  clearLectureFolder: () => ipcRenderer.invoke("lecture:clear"),
  copyCommand: (which: "install" | "login") => ipcRenderer.invoke("command:copy", which === "login" ? "login" : "install"),
});
