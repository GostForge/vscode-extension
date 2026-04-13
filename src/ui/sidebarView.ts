import * as vscode from "vscode";
import * as T from "../localization/texts";

/**
 * Sidebar WebviewView — renders action buttons and conversion warnings.
 */
export class SidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "gostforge.panel";

  private _view?: vscode.WebviewView;
  private _warnings: string[] = [];
  private _tokenSet = false;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this._getHtml();

    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.command) {
        case "setToken":
          vscode.commands.executeCommand("gostforge.setToken");
          break;
        case "setEndpoint":
          vscode.commands.executeCommand("gostforge.setEndpoint");
          break;
        case "convertDocx":
          vscode.commands.executeCommand("gostforge.convertDocx");
          break;
        case "convertPdf":
          vscode.commands.executeCommand("gostforge.convertPdf");
          break;
        case "convertMarkdown":
          vscode.commands.executeCommand("gostforge.convertMarkdown");
          break;
        case "showHistory":
          vscode.commands.executeCommand("gostforge.history.focus");
          break;
      }
    });
  }

  /** Call after token changes to update the status indicator */
  setTokenStatus(hasToken: boolean): void {
    this._tokenSet = hasToken;
    this._refresh();
  }

  /** Call after conversion to show warnings */
  setWarnings(warnings: string[]): void {
    this._warnings = warnings;
    this._refresh();
  }

  private _refresh(): void {
    if (this._view) {
      this._view.webview.html = this._getHtml();
    }
  }

  private _getHtml(): string {
    const tokenStatus = this._tokenSet
      ? `<span class="status ok">✅ ${T.PANEL_TOKEN_SAVED}</span>`
      : `<span class="status warn">⚠️ ${T.PANEL_TOKEN_NOT_SET}</span>`;

    const serverUrl = vscode.workspace
      .getConfiguration("gostforge")
      .get<string>("serverUrl") ?? "http://localhost:8080";

    let warningsHtml = "";
    if (this._warnings.length > 0) {
      const items = this._warnings
        .map((w) => `<li>${escapeHtml(w)}</li>`)
        .join("");
      warningsHtml = `
        <div class="section">
          <h3>⚠️ ${T.PANEL_SECTION_WARNINGS}</h3>
          <ul class="warnings-list">${items}</ul>
        </div>`;
    }

    return /* html */ `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      padding: 0 12px 12px 12px;
      margin: 0;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
    }
    h3 {
      margin: 14px 0 8px 0;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border, #444));
      padding-bottom: 4px;
    }
    .status {
      display: block;
      padding: 4px 0;
      font-size: 12px;
    }
    .status.ok { color: var(--vscode-testing-iconPassed, #73c991); }
    .status.warn { color: var(--vscode-editorWarning-foreground, #cca700); }
    .server-url {
      display: block;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      padding: 2px 0 6px 0;
      word-break: break-all;
    }
    button {
      display: block;
      width: 100%;
      padding: 6px 12px;
      margin: 4px 0;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 13px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button.secondary {
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
    }
    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .warnings-list {
      margin: 0;
      padding: 0 0 0 18px;
      font-size: 12px;
      color: var(--vscode-editorWarning-foreground, #cca700);
      max-height: 200px;
      overflow-y: auto;
    }
    .warnings-list li {
      margin: 2px 0;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="section">
    <h3>⚙️ ${T.PANEL_SECTION_SETTINGS}</h3>
    ${tokenStatus}
    <span class="server-url">${T.PANEL_SERVER_URL}: ${escapeHtml(serverUrl)}</span>
    <button class="secondary" onclick="send('setToken')">${T.PANEL_BTN_SET_TOKEN}</button>
    <button class="secondary" onclick="send('setEndpoint')">${T.PANEL_BTN_SET_URL}</button>
  </div>

  <div class="section">
    <h3>📄 ${T.PANEL_SECTION_CONVERT}</h3>
    <button onclick="send('convertDocx')">${T.PANEL_BTN_CONVERT_DOCX}</button>
    <button onclick="send('convertPdf')">${T.PANEL_BTN_CONVERT_PDF}</button>
    <button onclick="send('convertMarkdown')">${T.PANEL_BTN_CONVERT_MARKDOWN}</button>
  </div>

  ${warningsHtml}

  <script>
    const vscode = acquireVsCodeApi();
    function send(cmd) {
      vscode.postMessage({ command: cmd });
    }
  </script>
</body>
</html>`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
