import * as vscode from "vscode";
import * as T from "../localization/texts";

export class StatusBarManager {
  private item: vscode.StatusBarItem;
  private resetTimer: NodeJS.Timeout | undefined;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.item.command = "gostforge.history";
    this.setIdle();
    this.item.show();
  }

  setIdle(): void {
    this.clearTimer();
    this.item.text = `$(file-text) ${T.STATUSBAR_READY}`;
    this.item.tooltip = T.STATUSBAR_READY_TOOLTIP;
    this.item.backgroundColor = undefined;
  }

  setBusy(message: string): void {
    this.clearTimer();
    this.item.text = `$(sync~spin) ${message}`;
    this.item.tooltip = `GostForge — ${message}`;
    this.item.backgroundColor = undefined;
  }

  setDone(): void {
    this.clearTimer();
    this.item.text = `$(check) ${T.STATUSBAR_DONE}`;
    this.item.tooltip = T.STATUSBAR_DONE_TOOLTIP;
    this.item.backgroundColor = undefined;

    // Reset to idle after 10 seconds
    this.resetTimer = setTimeout(() => this.setIdle(), 10_000);
  }

  setError(message: string): void {
    this.clearTimer();
    this.item.text = `$(error) ${T.STATUSBAR_ERROR}`;
    this.item.tooltip = `GostForge — ${message}`;
    this.item.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground"
    );

    // Reset to idle after 15 seconds
    this.resetTimer = setTimeout(() => this.setIdle(), 15_000);
  }

  dispose(): void {
    this.clearTimer();
    this.item.dispose();
  }

  private clearTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
  }
}
