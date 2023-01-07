import * as vscode from 'vscode';
import * as fs from 'fs';
import { NotesFS } from "./lib/notes-fs"
import { SettingView } from "./lib/webview"


  
export function activate(context: vscode.ExtensionContext) {

	const CMD_LIST = {
		Init: "Init",
		OpenSettingView: "OpenSettingView",
	}
	for(let k in CMD_LIST) {
		(CMD_LIST as any)[k] = `${context.extension.packageJSON.name}.${(CMD_LIST as any)[k]}`
	}
	
	const EXTENSION_VERSION = context.extension.packageJSON.version;
	const EXTENSION_PATH = context.extensionPath
	
	console.log(`Congratulations, your extension "meo-notes ${EXTENSION_VERSION}" is now active!`);

	let fs = vscode.workspace.workspaceFolders
		? new NotesFS(
			vscode.workspace.workspaceFolders[0].uri.fsPath,
			EXTENSION_PATH
		)
		: undefined;

	context.subscriptions.push(vscode.commands.registerCommand(CMD_LIST.Init, () => {
		// Create notes template.

		function init() {
			console.log("init.")
			fs?.initialized
				.catch(()=>{
					fs?.setup()
				})
		}

		if(fs !== undefined) {
			// a folder or workspace has been opened
			init()
		} else {
			vscode.window.showInformationMessage('请先打开一个文件夹.');
			
			// Select a folder for initialization
			vscode.window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
			}).then(uri=>{
				if(uri) {
					fs = new NotesFS(uri[0].fsPath, EXTENSION_PATH)
					init()
					vscode.workspace.updateWorkspaceFolders(0, 0, {
						name: "✨Notes",
						uri: uri[0]
					})
				}
			})
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand(CMD_LIST.OpenSettingView, () => {
		fs?.initialized.then(()=>{
			let view = SettingView.createOrShow(context.extensionUri)
		}).catch(()=>{
			vscode.window.showInformationMessage(`请先执行${CMD_LIST.Init}`)
		})
	}))
}

// this method is called when your extension is deactivated
export function deactivate() {}
