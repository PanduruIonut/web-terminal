import { getFlag } from "../terminal-utils";
import { DirectoryEntry, Entry, loadVirtualFileSystemFromLocalStorage, virtualFileSystem } from "./virtualFileSystem";
type User = "owner" | "group" | "others";
export let currentDirectory = '/';

export function listFiles() {
    loadVirtualFileSystemFromLocalStorage();
    if (currentDirectory === "/") {
        const files = virtualFileSystem["/"].content;
        if (!files || typeof files !== "object") {
            return "No files found.";
        }

        return Object.keys(files).join(", ");
    }

    const pathSegments = currentDirectory.split("/").filter(segment => segment !== "");
    let currentDirEntry: DirectoryEntry | undefined = virtualFileSystem["/"];

    for (const segment of pathSegments) {
        if (!currentDirEntry || !currentDirEntry.content || !currentDirEntry.content[segment] || currentDirEntry.content[segment].type !== 'directory') {
            return `Directory '${segment}' not found in '${currentDirectory}'.`;
        }
        currentDirEntry = currentDirEntry.content[segment] as DirectoryEntry;
    }

    const files = currentDirEntry.content;
    if (!files || typeof files !== "object") {
        return "No files found.";
    }

    return Object.keys(files).join(', ');
}


export async function readFile(filename: string) {
    const currentDirEntry = getCurrentDirEntry();
    if (!currentDirEntry || currentDirEntry.type !== 'directory') {
        return 'Current directory not found.';
    }

    const file = currentDirEntry.content[filename];
    if (!file) {
        return 'File not found.';
    }

    if (file.type === 'directory') {
        return `Error: '${filename}' is a directory. Use 'ls' command to see its contents.`;
    }

    const permissions = file.permissions;
    if (!permissions.owner.read && !permissions.group.read && !permissions.others.read) {
        return 'Permission denied: You do not have read access to this file.';
    }

    if (filename === 'secret.txt' && currentDirectory === '/top_secret_clown_business') {
        return await getFlag('flag-2');
    }
    return file.content;
}

function getCurrentUser(): User {
    return "others";
}

function getCurrentUserPermissions(dirEntry: DirectoryEntry): { read: boolean; write: boolean; execute: boolean } {
    const user = getCurrentUser();
    return dirEntry.permissions[user];
}
export function changeDirectory(newDir: string) {
    loadVirtualFileSystemFromLocalStorage();

    if (newDir === '..') {
        if (currentDirectory === '/') {
            return "Cannot go back from the root directory.";
        }
        const segments = currentDirectory.split('/').filter(segment => segment !== '');
        segments.pop();
        currentDirectory = `/${segments.join('/')}`;
        return `Changed directory to: ${currentDirectory}`;
    }

    const targetDirPath = newDir.startsWith('/') ? newDir : `${currentDirectory === '/' ? '' : currentDirectory}/${newDir}`;
    const targetDirSegments = targetDirPath.split('/').filter(segment => segment !== '');

    let currentDirEntry: DirectoryEntry | undefined = virtualFileSystem['/'];
    let currentPath = '/';

    for (const segment of targetDirSegments) {
        if (!currentDirEntry?.content || !currentDirEntry.content[segment]) {
            return `Directory '${segment}' not found in '${currentDirectory}'.`;
        }

        const targetDirEntry = currentDirEntry.content[segment] as DirectoryEntry;
        const permissions = getCurrentUserPermissions(targetDirEntry);

        if (!isDirectory(targetDirEntry)) {
            return `'${segment}' is not a directory.`; // Check if the entry is a directory
        }
        
        if (!permissions.execute) {
            return `Permission denied: You do not have execute access to the '${segment}' directory.`;
        }

        currentDirEntry = targetDirEntry;
        currentPath = currentPath === '/' ? `/${segment}` : `${currentPath}/${segment}`;
    }

    currentDirectory = currentPath;
    return `Changed directory to: ${currentDirectory}`;
}

function getCurrentDirEntry() {
    const pathSegments = currentDirectory.split("/").filter(segment => segment !== "");
    let currentDirEntry: Entry = virtualFileSystem["/"];

    for (const segment of pathSegments) {
        if (!currentDirEntry || !isDirectory(currentDirEntry) || !currentDirEntry.content[segment]) {
            return undefined;
        }
        currentDirEntry = currentDirEntry.content[segment];
    }

    return currentDirEntry;
}

export function getCurrentPath() {
    return currentDirectory;
}

function isDirectory(entry: Entry): entry is DirectoryEntry {
    return (entry as DirectoryEntry).type === "directory";
}