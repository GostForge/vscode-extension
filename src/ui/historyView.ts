import * as vscode from "vscode";
import * as T from "../localization/texts";

interface HistoryEntry {
  jobId: string;
  status: string;
  outputFormat: string;
  timestamp: string;
}

export class HistoryViewProvider implements vscode.TreeDataProvider<HistoryItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<HistoryItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private entries: HistoryEntry[] = [];

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  addEntry(jobId: string, status: string, outputFormat: string): void {
    this.entries.unshift({
      jobId,
      status,
      outputFormat,
      timestamp: new Date().toLocaleString(),
    });

    // Keep last 20
    if (this.entries.length > 20) {
      this.entries = this.entries.slice(0, 20);
    }

    this.refresh();
  }

  getTreeItem(element: HistoryItem): vscode.TreeItem {
    return element;
  }

  getChildren(): HistoryItem[] {
    if (this.entries.length === 0) {
      return [
        new HistoryItem(
          T.HISTORY_EMPTY,
          "",
          "",
          vscode.TreeItemCollapsibleState.None
        ),
      ];
    }

    return this.entries.map(
      (e) =>
        new HistoryItem(
          `${statusIcon(e.status)} ${e.outputFormat} — ${e.timestamp}`,
          e.jobId,
          e.status,
          vscode.TreeItemCollapsibleState.None
        )
    );
  }
}

class HistoryItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly jobId: string,
    public readonly status: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    if (jobId) {
      this.tooltip = `Job: ${jobId}\nStatus: ${status}`;
      this.description = jobId.substring(0, 8);
    }
  }
}

function statusIcon(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "✅";
    case "FAILED":
      return "❌";
    case "PENDING":
    case "MERGING_MD":
    case "CONVERTING_DOCX":
    case "CONVERTING_PDF":
      return "⏳";
    default:
      return "•";
  }
}
