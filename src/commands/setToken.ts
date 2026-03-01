import * as vscode from "vscode";
import { ApiClient } from "../api/client";
import * as T from "../localization/texts";

export async function setTokenCommand(api: ApiClient): Promise<void> {
  const token = await vscode.window.showInputBox({
    prompt: T.TOKEN_PROMPT,
    placeHolder: T.TOKEN_PLACEHOLDER,
    password: true,
    ignoreFocusOut: true,
  });

  if (!token) {
    return; // Cancelled
  }

  await api.setToken(token.trim());
  vscode.window.showInformationMessage(T.TOKEN_SAVED_MSG);
}

export async function setEndpointCommand(): Promise<void> {
  const config = vscode.workspace.getConfiguration("gostforge");
  const current = config.get<string>("serverUrl") ?? "http://localhost:8080";

  const url = await vscode.window.showInputBox({
    prompt: T.ENDPOINT_PROMPT,
    value: current,
    ignoreFocusOut: true,
  });

  if (!url) {
    return;
  }

  await config.update("serverUrl", url.trim(), vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage(T.ENDPOINT_SAVED_MSG(url.trim()));
}
