// File with helpers specifically using the VS Code Extension API
import * as vscode from "vscode";
import { adrTemplatemarkdownContent, initialMarkdownContent, readmeMarkdownContent } from "./constants";
import { matchesMadrTitleFormat } from "./utils";

// Constants for VS Code helpers
export const adrDirectoryString: string = vscode.workspace.getConfiguration("adrManager").get("adrDirectory")!;

/**
 * Returns the workspace folders opened in the current VS Code instance.
 * @returns The current workspace folders of the VS Code instance, or an empty WorkspaceFolder array if there is no folder open
 */
export function getWorkspaceFolders(): readonly vscode.WorkspaceFolder[] {
	if (isWorkspaceOpened()) {
		return vscode.workspace.workspaceFolders!;
	}
	return [];
}

/**
 * Returns true iff there is a folder opened in the current workspace of the VS Code instance.
 * @returns True iff a folder is opened in the current workspace of the VS Code instance
 */
export function isWorkspaceOpened(): boolean {
	return vscode.workspace.workspaceFolders !== undefined && vscode.workspace.workspaceFolders.length > 0;
}

/**
 * Returns true iff the current workspace is a single-root workspace, i.e. iff there is exactly one folder opened in the current workspace.
 * @returns True iff there is exactly one folder opened in the current workspace
 */
export function isSingleRootWorkspace(): boolean {
	return isWorkspaceOpened() && getWorkspaceFolders().length === 1;
}

/**
 * Initializes the ADR directory in the specified root folder.
 * Initialization includes the creation of the ADR directory, along with filling the directory with boilerplate Markdown files.
 * @param rootFolderUri The URI of the root folder where the ADR directory should be initialized
 */
export async function initializeAdrDirectory(rootFolderUri: vscode.Uri) {
	if (!(await adrDirectoryExists(rootFolderUri))) {
		const adrFolderUri = vscode.Uri.joinPath(rootFolderUri, adrDirectoryString);
		await vscode.workspace.fs.createDirectory(adrFolderUri);
		await fillAdrDirectory(adrFolderUri);
	} else {
		const selection = await vscode.window.showInformationMessage(
			"The ADR directory already exists. Do you want to fill the directory with boilerplate Markdown files?",
			"Yes",
			"No"
		);
		if (selection === "Yes") {
			const adrFolderUri = vscode.Uri.joinPath(rootFolderUri, adrDirectoryString);
			await fillAdrDirectory(adrFolderUri);
		}
	}
}

/**
 * Returns true iff there exists the ADR directory in the given workspace folder in the current VS Code instance (default: docs/decisions).
 * @param folderUri The URI to the directory in the current workspace
 * @returns True iff there exists the ADR directory in the given workspace folder in the current VS Code instance
 *
 */
export async function adrDirectoryExists(folderUri: vscode.Uri) {
	if (isWorkspaceOpened()) {
		const subDirectories = adrDirectoryString.replace("\\", "/").split("/");

		// Iterate through subdirectories
		let currentUri = folderUri;
		let currentDirectoryFound = true;
		for (let i = 0; i < subDirectories.length; i++) {
			if (currentDirectoryFound) {
				currentDirectoryFound = false;
				let currentDirectory = await vscode.workspace.fs.readDirectory(currentUri);
				for (const [name, type] of currentDirectory) {
					if (name === subDirectories[i] && type === vscode.FileType.Directory) {
						if (i === subDirectories.length - 1) {
							return true; // last subdirectory found
						} else {
							currentDirectoryFound = true;
							break; // check next subdirectory
						}
					}
				}
				currentUri = vscode.Uri.joinPath(currentUri, subDirectories[i]);
			} else {
				return false;
			}
		}
	}
	return false;
}

/**
 * Fills the specified directory with README, an ADR template and a sample ADR.
 * @param folderUri The URI of the directory to be filled
 */
export async function fillAdrDirectory(folderUri: vscode.Uri) {
	await createMarkdownFile(folderUri, "0000-use-markdown-architectural-decision-records.md", initialMarkdownContent);
	await createMarkdownFile(folderUri, "README.md", readmeMarkdownContent);
	await createMarkdownFile(folderUri, "adr-template.md", adrTemplatemarkdownContent);
}

/**
 * Creates a Markdown file in the specified URI with the specified name and content.
 * @param folderUri The URI of the folder in which the Markdown file should be created
 * @param name The name of the Markdown file
 * @param content The content of the Markdown file
 */
export async function createMarkdownFile(folderUri: vscode.Uri, name: string, content: string) {
	await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(folderUri, name), new TextEncoder().encode(content));
}

/**
 * Returns an array of the folder names that are open in the current workspace.
 * @returns A string array of all folder names currently opened in the workspace
 */
export function getWorkspaceFolderNames(): string[] {
	let names: string[] = [];
	if (isWorkspaceOpened()) {
		getWorkspaceFolders().forEach((folder) => {
			names.push(folder.name);
		});
	}
	return names;
}

/**
 * Returns an array of potential MADRs in the form of strings that are located in the root folders of the current workspace.
 * @returns A Promise which resolves in a string array of all potential MADRs in the whole workspace
 */
export async function getAllAdrs() {
	let adrs: string[] = [];
	if (isWorkspaceOpened()) {
		for (let i = 0; i < getWorkspaceFolders().length; i++) {
			if (await adrDirectoryExists(getWorkspaceFolders()[i].uri)) {
				adrs = [
					...adrs,
					...(await getAdrsFromFolder(vscode.Uri.joinPath(getWorkspaceFolders()[i].uri, adrDirectoryString))),
				];
			}
		}
	}
	return adrs;
}

/**
 * Returns an array of potential MADRs in the form of strings that are located in the specified folder.
 * @param folderUri The URI of the directory to be scanned for MADRs
 * @returns A Promise which resolves in a string array of potential MADRs
 */
export async function getAdrsFromFolder(folderUri: vscode.Uri): Promise<string[]> {
	let adrs: string[] = [];
	const directory = await vscode.workspace.fs.readDirectory(folderUri);
	for (const [name, type] of directory) {
		if (type === vscode.FileType.File && matchesMadrTitleFormat(name)) {
			const content = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(folderUri, name));
			adrs.push(new TextDecoder().decode(content));
		}
	}
	return adrs;
}