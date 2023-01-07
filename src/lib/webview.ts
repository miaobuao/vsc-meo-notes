import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

import { LocExtension } from "./notes-fs";

function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
	return {
		// Enable javascript in the webview
		enableScripts: true,

		// And restrict the webview to only loading content from our extension's `assets` directory.
		localResourceRoots: [vscode.Uri.joinPath(extensionUri, "assets")],
	};
}

export class SettingView {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: SettingView | undefined;

	public static readonly viewType = "meo-notes.views.settings";

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private readonly _extension_loc: LocExtension;
	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (SettingView.currentPanel) {
			SettingView.currentPanel._panel.reveal(column);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			SettingView.viewType,
			"MeoNotes: Settings",
			column || vscode.ViewColumn.One,
			getWebviewOptions(extensionUri)
		);

		SettingView.currentPanel = new SettingView(panel, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._extension_loc = new LocExtension(extensionUri);

		// Set the webview's initial html content
		this._publish();

		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Handle messages from the webview
		// this._panel.webview.onDidReceiveMessage(
		// 	(message) => {
		// 		switch (message.command) {
		// 			case "alert":
		// 				vscode.window.showErrorMessage(message.text);
		// 				return;
		// 		}
		// 	},
		// 	null,
		// 	this._disposables
		// );
	}

	public dispose() {
		SettingView.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _publish() {
		this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		return fs.readFileSync(this._extension_loc.pages.get("settings.html"), {
			encoding: "utf8",
			flag: "r",
		});
	}
}

function getNonce() {
	let text = "";
	const possible =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
