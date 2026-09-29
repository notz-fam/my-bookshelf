import { exec } from "node:child_process";

// URL やファイルを OS の既定アプリで開く
export function openWithDefaultApp(target) {
  if (process.platform === "win32") {
    exec(`start "" "${target.replace(/&/g, "^&")}"`, { shell: "cmd.exe" });
  } else {
    exec(`${process.platform === "darwin" ? "open" : "xdg-open"} "${target}"`);
  }
}
