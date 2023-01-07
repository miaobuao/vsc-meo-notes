import * as fs from "fs";
import * as path from "path";
import * as mkdirp from "mkdirp";
import * as rimraf from "rimraf";
import * as vscode from "vscode";

class LocFileBase {
	public readonly root: string;

	constructor(root: vscode.Uri| string) {
		this.root = this.UritoPath(root)
	}

	public UritoPath(uri: vscode.Uri| string) {
		return uri instanceof vscode.Uri ? uri.fsPath : uri
	}

	get(...paths: string[]) {
		return path.join(this.root, ...paths)
	}

	join(...paths: string[]) {
		return new LocFileBase(path.join(this.root, ...paths))
	}
}

export class LocExtension extends LocFileBase {

	get assets() {
		return this.join("assets")
	}
	
	get templates() {
		return this.get("assets", "templates")
	}
	
	get pages() {
		return this.join("assets", "pages")
	}
}

export class LocWorkspace extends LocFileBase{
	get config() {
		return this.get(".meo-notes.yaml")
	}
}


export class NotesFS {
	private _extension: LocExtension
	private _workspace: LocWorkspace

	constructor(workspace: string | vscode.Uri, extension: string|vscode.Uri) {
		this._extension = new LocExtension(extension)
		this._workspace = new LocWorkspace(workspace)
	}

	get initialized() {
		return _.exists(this._workspace.config);
	}

	setup() {
		return _.deepCopy(this._extension.templates, this._workspace.root);
	}
}

export interface IStatAndLink {
	stat: fs.Stats;
	isSymbolicLink: boolean;
}

namespace _ {
	function handleResult<T>(
		resolve: (result: T) => void,
		reject: (error: Error) => void,
		error: Error | null | undefined,
		result: T | undefined
	): void {
		if (error) {
			reject(messageError(error));
		} else {
			resolve(result!);
		}
	}

	function messageError(error: Error & { code?: string }): Error {
		if (error.code === "ENOENT") {
			return vscode.FileSystemError.FileNotFound();
		}

		if (error.code === "EISDIR") {
			return vscode.FileSystemError.FileIsADirectory();
		}

		if (error.code === "EEXIST") {
			return vscode.FileSystemError.FileExists();
		}

		if (error.code === "EPERM" || error.code === "EACCESS") {
			return vscode.FileSystemError.NoPermissions();
		}

		return error;
	}

	export function checkCancellation(token: vscode.CancellationToken): void {
		if (token.isCancellationRequested) {
			throw new Error("Operation cancelled");
		}
	}

	export function normalizeNFC(items: string): string;
	export function normalizeNFC(items: string[]): string[];
	export function normalizeNFC(items: string | string[]): string | string[] {
		if (process.platform !== "darwin") {
			return items;
		}

		if (Array.isArray(items)) {
			return items.map((item) => item.normalize("NFC"));
		}

		return items.normalize("NFC");
	}

	export function readdir(path: string): Promise<string[]> {
		return new Promise<string[]>((resolve, reject) => {
			fs.readdir(path, (error, children) =>
				handleResult(resolve, reject, error, normalizeNFC(children))
			);
		});
	}

	export function readfile(path: string): Promise<Buffer> {
		return new Promise<Buffer>((resolve, reject) => {
			fs.readFile(path, (error, buffer) =>
				handleResult(resolve, reject, error, buffer)
			);
		});
	}

	export function writefile(path: string, content: Buffer): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			fs.writeFile(path, content, (error) =>
				handleResult(resolve, reject, error, void 0)
			);
		});
	}

	export function exists(path: string): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			fs.access(path, (error) =>
				handleResult(resolve, reject, error, void 0)
			);
		});
	}

	export function rmrf(path: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			rimraf(path, (error) =>
				handleResult(resolve, reject, error, void 0)
			);
		});
	}

	export function mkdir(path: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			mkdirp(path, (error) =>
				handleResult(resolve, reject, error, void 0)
			);
		});
	}

	export function rename(oldPath: string, newPath: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			fs.rename(oldPath, newPath, (error) =>
				handleResult(resolve, reject, error, void 0)
			);
		});
	}

	export function copy(src: string, dest: string) {
		return new Promise((resolve, reject) => {
			fs.copyFile(src, dest, (error) =>
				handleResult(resolve, reject, error, void 0)
			);
		});
	}

	export function stat(path: string) {
		return new Promise<fs.Stats>((resolve, reject) => {
			fs.stat(path, (error, stats) =>
				handleResult(resolve, reject, error, stats)
			);
		});
	}

	export function unlink(path: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			fs.unlink(path, (error) =>
				handleResult(resolve, reject, error, void 0)
			);
		});
	}

	export function statLink(path: string): Promise<IStatAndLink> {
		return new Promise<IStatAndLink>((resolve, reject) => {
			fs.lstat(path, (error, lstat) => {
				if (error || lstat.isSymbolicLink()) {
					fs.stat(path, (error, stat) => {
						if (error) {
							return handleResult(resolve, reject, error, void 0);
						}

						handleResult(resolve, reject, error, {
							stat,
							isSymbolicLink: lstat && lstat.isSymbolicLink(),
						});
					});
				} else {
					handleResult(resolve, reject, error, {
						stat: lstat,
						isSymbolicLink: false,
					});
				}
			});
		});
	}

	// copy file and dirs in `from` to `to`
	export function deepCopy(from: string, to: string) {
		return new Promise((resolve, reject) => {
			// apply `callback` for each file or dir in `src`
			const mapdir = (src: string, callback: (src: string) => void) => {
				readdir(src)
					.then((files) =>
						files.forEach((f) => callback(path.join(src, f)))
					)
					.catch(reject);
			};

			const cp = (src: string) => {
				stat(src).then((stats) => {
					let dest = path.join(to, path.relative(from, src));
					if (stats.isFile()) {
						copy(src, dest).catch(reject);
						// .then(()=>console.log(src, " ===> ", dest))
						return;
					}
					exists(dest)
						.catch(() => {
							mkdir(dest)
								.then(() => mapdir(src, cp))
								.catch(reject);
						})
						.then(() => mapdir(src, cp));
				});
			};
			mapdir(from, cp);
			resolve(void 0);
		});
	}
}

export class FileStat implements vscode.FileStat {
	constructor(private fsStat: fs.Stats, private _isSymbolicLink: boolean) {}

	get type(): vscode.FileType {
		let type: number;
		if (this._isSymbolicLink) {
			type =
				vscode.FileType.SymbolicLink |
				(this.fsStat.isDirectory()
					? vscode.FileType.Directory
					: vscode.FileType.File);
		} else {
			type = this.fsStat.isFile()
				? vscode.FileType.File
				: this.fsStat.isDirectory()
				? vscode.FileType.Directory
				: vscode.FileType.Unknown;
		}

		return type;
	}

	get isFile(): boolean | undefined {
		return this.fsStat.isFile();
	}

	get isDirectory(): boolean | undefined {
		return this.fsStat.isDirectory();
	}

	get isSymbolicLink(): boolean | undefined {
		return this._isSymbolicLink;
	}

	get size(): number {
		return this.fsStat.size;
	}

	get ctime(): number {
		return this.fsStat.ctime.getTime();
	}

	get mtime(): number {
		return this.fsStat.mtime.getTime();
	}
}
