
interface FileEntry {
    type: "file";
    content: string;
    permissions: {
        owner: {
            read: boolean;
            write: boolean;
            execute: boolean;
        };
        group: {
            read: boolean;
            write: boolean;
            execute: boolean;
        };
        others: {
            read: boolean;
            write: boolean;
            execute: boolean;
        };
    };
}

export interface DirectoryEntry {
    type: "directory";
    content: {
        [fileName: string]: Entry;
    };
    permissions: {
        owner: {
            read: boolean;
            write: boolean;
            execute: boolean;
        };
        group: {
            read: boolean;
            write: boolean;
            execute: boolean;
        };
        others: {
            read: boolean;
            write: boolean;
            execute: boolean;
        };
    };
}

export type Entry = FileEntry | DirectoryEntry;

export interface VirtualFileSystem {
    [path: string]: DirectoryEntry;
}

export interface FolderEntry {
    type: "directory";
    content: {
        [folderName: string]: FolderEntry;
    };
    permissions: {
        owner: {
            read: boolean;
            write: boolean;
            execute: boolean;
        };
        group: {
            read: boolean;
            write: boolean;
            execute: boolean;
        };
        others: {
            read: boolean;
            write: boolean;
            execute: boolean;
        };
    };
}

export let virtualFileSystem: VirtualFileSystem = {
    "/": {
        type: "directory",
        content: {
            clown_zone: {
                type: "directory",
                content: {
                    "not_the_flag_folder": {
                        type: "directory",
                        content: {
                            "not_the_flag_file.txt": {
                                type: "file",
                                content: "Q1RGe05PVF9USEVfRkxBR30=",
                                permissions: {
                                    owner: { read: true, write: true, execute: true },
                                    group: { read: true, write: false, execute: false },
                                    others: { read: false, write: false, execute: false },
                                },
                            }
                        },
                        permissions: {
                            owner: { read: true, write: true, execute: true },
                            group: { read: true, write: true, execute: true },
                            others: { read: true, write: true, execute: true },
                        },
                    },
                    "standup-material.txt": {
                        type: "file",
                        content: "Why do programmers prefer gardening? Because they can use root access!\nWhy did the programmer stay up all night? He couldn't find the <any> key!",
                        permissions: {
                            owner: { read: true, write: true, execute: true },
                            group: { read: true, write: false, execute: false },
                            others: { read: false, write: false, execute: false },
                        },
                    },
                    "code.txt": {
                        type: "file",
                        content: "Code ipsum dolor sit amet, consectetur adipiscing elit. Null pointer exception vel nulla consequat, while(true) velit eu metus. Nulla 'semicolon' facilisi. Proin 'spaghetti code' ex eu semper 'yo dawg' sagittis. Sed varius 'yoink' mauris, ac ultrices sapien '1337' vel. Fusce eu '404 not found' ac ex 'cookie monster' congue. Vestibulum 'ba-dum-tss' nisi quis quam tempor, at 'Stack Overflow' ipsum efficitur. Nulla '404 not found', nulla at 'I haz error' fermentum, libero ante 'yo dawg' tellus, id feugiat odio quam a lorem. Nullam tincidunt 'roflcopter' quis ante iaculis, eget 'rickroll' velit posuere. Nam faucibus ipsum 'derp' quam cursus, at suscipit nunc pellentesque. Morbi 'git commit' bibendum mi, vel dignissim justo. Curabitur sed ante eget sapien fermentum laoreet at a purus. Nullam 'haxor' euismod tellus, vitae aliquet felis hendrerit vitae. Nulla quis tortor vel 'facepalm' iaculis congue ut ut lectus",
                        permissions: {
                            owner: { read: true, write: true, execute: true },
                            group: { read: true, write: false, execute: false },
                            others: { read: false, write: false, execute: false },
                        },
                    },
                },
                permissions: {
                    owner: { read: true, write: true, execute: true },
                    group: { read: true, write: true, execute: true },
                    others: { read: true, write: true, execute: true },
                },
            },
            top_secret_clown_business: {
                type: "directory",
                content: {
                    "secret.txt": {
                        type: "file",
                        content: "",
                        permissions: {
                            owner: { read: true, write: true, execute: true },
                            group: { read: false, write: false, execute: false },
                            others: { read: false, write: false, execute: false },
                        },
                    },
                },
                permissions: {
                    owner: { read: true, write: true, execute: true },
                    group: { read: false, write: false, execute: false },
                    others: { read: false, write: false, execute: false },
                },
            },
        },
        permissions: {
            owner: { read: true, write: true, execute: true },
            group: { read: false, write: false, execute: false },
            others: { read: false, write: false, execute: false },
        },
    },
};


export interface FolderSystem {
    [path: string]: FolderEntry;
}

export function convertToFolderSystem(entry: Entry) {
    if (entry.type === 'directory') {
        const newContent: { [folderName: string] } = {};

        for (const [name, childEntry] of Object.entries(entry.content)) {
            if (childEntry.type === 'directory') {
                newContent[name] = convertToFolderSystem(childEntry);
            }
        }

        return {
            type: 'directory',
            content: newContent,
            permissions: entry.permissions,
        };
    }

    return {
        type: 'directory',
        content: {},
        permissions: entry.permissions,
    };
}

export function saveVirtualFileSystemToLocalStorage() {
    const folderSystem: FolderSystem = convertToFolderSystem(virtualFileSystem['/']);
    const serializedFolderSystem = JSON.stringify(folderSystem);
    const encodedFolderSystem = btoa(serializedFolderSystem);
    localStorage.setItem('virtualFileSystem', encodedFolderSystem);
}

export function loadVirtualFileSystemFromLocalStorage() {
    const encodedFolderSystem = localStorage.getItem('virtualFileSystem');
    if (encodedFolderSystem) {
        const serializedFolderSystem = atob(encodedFolderSystem);
        const folderSystem: FolderSystem = JSON.parse(serializedFolderSystem);
        const newFileSystem = convertToVirtualFileSystem('/', folderSystem);
        mergeVirtualFileSystem(virtualFileSystem['/'], newFileSystem);
    }
}

function mergeVirtualFileSystem(existingDirEntry: DirectoryEntry, newDirEntry: DirectoryEntry) {
    existingDirEntry.permissions = newDirEntry.permissions;

    for (const [fileName, entry] of Object.entries(newDirEntry.content)) {
        if (entry.type === 'file') {
            existingDirEntry.content[fileName] = entry;
        } else if (entry.type === 'directory') {
            if (!existingDirEntry.content[fileName]) {
                existingDirEntry.content[fileName] = {
                    type: 'directory',
                    content: {},
                    permissions: {},
                };
            }
            mergeVirtualFileSystem(existingDirEntry.content[fileName] as DirectoryEntry, entry);
        }
    }
}

function convertToVirtualFileSystem(currentPath: string, folderEntry: FolderEntry): DirectoryEntry {
    const content: { [fileName: string]: Entry } = {};
    for (const [folderName, childFolderEntry] of Object.entries(folderEntry.content)) {
        content[folderName] = convertToVirtualFileSystem(`${currentPath}/${folderName}`, childFolderEntry);
    }

    return {
        type: 'directory',
        content,
        permissions: folderEntry.permissions,
    }
}






