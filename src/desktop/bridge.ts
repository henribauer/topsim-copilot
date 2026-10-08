/** What the desktop app's preload exposes to the page (window.topsim). Absent in the browser dev launcher. */
export interface BridgeResult {
  ok: boolean;
  canceled?: boolean;
  error?: string;
}
export interface TopsimBridge {
  chooseHandbook(): Promise<BridgeResult>;
  clearHandbook(): Promise<BridgeResult>;
  chooseLectureFolder(): Promise<BridgeResult>;
  clearLectureFolder(): Promise<BridgeResult>;
  copyCommand(which: "install" | "login"): Promise<BridgeResult>;
}
declare global {
  interface Window {
    topsim?: TopsimBridge;
  }
}
