import * as vscode from "vscode";
import { ApiClient } from "./api/client";
import { setTokenCommand, setEndpointCommand } from "./commands/setToken";
import { convertQuickCommand } from "./commands/convertQuick";
import { StatusBarManager } from "./ui/statusBar";
import { HistoryViewProvider } from "./ui/historyView";
import { SidebarViewProvider } from "./ui/sidebarView";
import * as T from "./localization/texts";

let statusBar: StatusBarManager;
let historyProvider: HistoryViewProvider;
let sidebarProvider: SidebarViewProvider;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext): void {
  const api = new ApiClient(context.secrets);
  statusBar = new StatusBarManager();
  historyProvider = new HistoryViewProvider();
  sidebarProvider = new SidebarViewProvider(context.extensionUri);
  outputChannel = vscode.window.createOutputChannel(T.WARNINGS_TITLE);

  // Register sidebar webview
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarViewProvider.viewType,
      sidebarProvider
    )
  );

  // Register tree view
  vscode.window.registerTreeDataProvider("gostforge.history", historyProvider);

  // Update sidebar token status on activation
  api.getToken().then((t) => sidebarProvider.setTokenStatus(!!t));

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("gostforge.setToken", async () => {
      await setTokenCommand(api);
      const hasToken = !!(await api.getToken());
      sidebarProvider.setTokenStatus(hasToken);
    }),

    vscode.commands.registerCommand("gostforge.setEndpoint", () =>
      setEndpointCommand()
    ),

    vscode.commands.registerCommand("gostforge.convertDocx", () =>
      runConvert(api, "DOCX")
    ),

    vscode.commands.registerCommand("gostforge.convertPdf", () =>
      runConvert(api, "PDF")
    ),

    vscode.commands.registerCommand("gostforge.convertBoth", () =>
      runConvert(api, "BOTH")
    ),

    vscode.commands.registerCommand("gostforge.convertMarkdown", () =>
      runConvert(api, "MARKDOWN")
    ),

    vscode.commands.registerCommand("gostforge.history", () => {
      vscode.commands.executeCommand("gostforge.history.focus");
    }),

    statusBar,
    outputChannel
  );
}

async function runConvert(api: ApiClient, format: string): Promise<void> {
  const result = await convertQuickCommand(api, statusBar, format);
  if (result) {
    historyProvider.addEntry(result.jobId, result.status, format);

    // Display warnings in output channel and sidebar
    if (result.warnings && result.warnings.length > 0) {
      outputChannel.clear();
      outputChannel.appendLine(T.WARNINGS_HEADER(result.warnings.length));
      outputChannel.appendLine(T.WARNINGS_SEPARATOR);
      for (const w of result.warnings) {
        outputChannel.appendLine(`  ⚠ ${w}`);
      }
      outputChannel.show(true); // true = preserveFocus
      sidebarProvider.setWarnings(result.warnings);
    } else {
      sidebarProvider.setWarnings([]);
    }
  }
}

export function deactivate(): void {
  statusBar?.dispose();
}
