import keySound from "../../public/sounds/keyboardTyping.mp3";
import { readFile, listFiles, changeDirectory, getCurrentPath } from "./fileSystem/functionality";
import { currentDirectory } from "./fileSystem/functionality";
import { DirectoryEntry, virtualFileSystem } from "./fileSystem/virtualFileSystem";
import { htopOutput, runMatrix, toggleCrt } from "./easterEggs";
import { applyTheme, themeNames } from "./themes";

let commandHistory: string[] = [];
let historyIndex = -1;

const REPO_URL = "https://github.com/PanduruIonut/web-terminal";

const STORE_UNAVAILABLE =
    "The scoreboard is offline right now, so this is unavailable. Everything else still works.";

type Command = {
    name: string;
    description: string;
    args?: string[];
    options?: string[];
};

let command = "";
let isCommandRunning = false;
let previousTypingSpeed = 50;
let typingSpeed = 50;
let skipKeys = [">", "<"];
let typingTimeout: ReturnType<typeof setTimeout> | undefined;

/*
 * A 3s mono loop rather than the 25s stereo wav this used to be: that file was
 * 4.5MB, downloaded on every visit before anyone had typed anything, and made
 * up 98% of the page weight. Looping means long output still types over sound,
 * which the old file did not manage either — it simply ran out after 25s.
 */
const clickSound = new Audio(keySound);
clickSound.volume = 0.4;
clickSound.playbackRate = 1.4;
clickSound.loop = true;


export const commands: Command[] = [
    { name: "clear", description: "Clear the terminal" },
    { name: "help", description: "Commands list" },
    { name: "history", description: "Professional Background" },
    { name: "mp", description: "My Projects" },
    { name: "ping", description: "Contact Me" },
    { name: "top", description: "My Main Tech Stack" },
    { name: "whoami", description: "About Me", },
    { name: "ctf", description: "CTF Challenges" },
    { name: "theme", description: themeNames().join(", "), args: ["<name>"] },
    { name: "helpctf", description: "CTF Challenges help" },
];

export const ctfCommands: Command[] = [
    { name: "ls", description: "List files in the current directory", options: ["-l"] },
    { name: "cat", description: "Display the content of a file", args: ["<filename>"] },
    { name: "cd", description: "Change directory", args: ["<dirname>"] },
    { name: "pwd", description: "Current directory path" },
    { name: "hints", description: "hints for ctf challenges" },
    { name: "owned", description: "submit flags", args: ["<flag1>", "<flag2>", "<user>"] },
    { name: "userOwns", description: "list of users that submitted flags" },
];

/**
 * Not listed by `help` or `helpctf` — found by poking around. parseInput still
 * has to know about them, otherwise they are rejected before reaching the switch
 * (which is what used to happen to `mute`, despite the hints advertising it).
 */
const hiddenCommands: Command[] = [
    { name: "mute", description: "Toggle the typing sound" },
    { name: "!!", description: "Run the previous command" },
    { name: "htop", description: "What is running" },
    { name: "ssh", description: "Connect somewhere", args: ["<user@host>"] },
    { name: "source", description: "Where this came from" },
    { name: "matrix", description: "Character rain" },
    { name: "crt", description: "Toggle the CRT effect" },
];

const socials = [
    { name: "GitHub", description: "https://github.com/PanduruIonut", text: 'PanduruIonut' },
    { name: "Twitter", description: "https://twitter.com/ThisIsIonut", text: 'ThisIsIonut' },
    {
        name: "Linkedin",
        description: "https://www.linkedin.com/in/ionut-panduru/", text: 'Ionut-Panduru'
    },
    { name: "E-mail", description: "panduru.ionut@hotmail.com" },
    { name: "Location", description: "Sibiu, Romania" },
];

function parseInput(input: string) {
    const [rawCommandName, ...rest] = input.trim().split(/\s+/);
    // Only the command name is case-insensitive. Arguments keep their original
    // case, because flags and usernames are matched verbatim by the store.
    const commandName = rawCommandName.toLowerCase();
    const command = commands.find(cmd => cmd.name.toLowerCase() === commandName)
        || ctfCommands.find(cmd => cmd.name.toLowerCase() === commandName)
        || hiddenCommands.find(cmd => cmd.name.toLowerCase() === commandName);

    if (!command) {
        return { command: "Invalid command" }
    }

    const parsedInput: { command: string; options?: string[]; args?: string[] } = {
        command: commandName,
    };

    if (command.options) {
        parsedInput.options = rest.filter(arg => command.options!.includes(arg));
    }

    if (command.args) {
        parsedInput.args = rest;
    }

    return parsedInput;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

export function animateText(
    element: HTMLElement,
    text: string | null | undefined,
    terminalDisplayContainer: HTMLElement,
): Promise<void> {
    const content = text ?? "";

    // The typing animation is the dominant motion on this site. Someone who has
    // asked for less of it gets the text at once, and no keystroke sound either.
    if (window.matchMedia(REDUCED_MOTION).matches) {
        element.innerHTML += content;
        terminalDisplayContainer.scrollTop = terminalDisplayContainer.scrollHeight;
        return Promise.resolve();
    }

    clickSound.play().catch((error) => {
        console.error("Audio playback error:", error);
    });

    return new Promise((resolve) => {
        let index = 0;

        if (content.length === 0) {
            clickSound.pause();
            typingSpeed = previousTypingSpeed;
            resolve();
            return;
        }

        function type() {
            if (index < content.length) {
                element.innerHTML += content.charAt(index);
                index++;

                terminalDisplayContainer.scrollTop =
                    terminalDisplayContainer.scrollHeight;

                if (index === content.length) {
                    clickSound.pause();
                    typingSpeed = previousTypingSpeed;
                    resolve();
                } else {
                    setTimeout(type, typingSpeed);
                }
            }
        }
        type();
    });
}

function displaySidesBlock(content: Command[], terminalDisplay: HTMLElement, terminalDisplayContainer: HTMLElement) {
    const helpContainer = document.createElement("div");
    helpContainer.style.display = "flex";
    helpContainer.style.flexDirection = "column";
    helpContainer.style.paddingLeft = "10px";
    helpContainer.style.paddingRight = "10px";
    helpContainer.style.paddingTop = "5px";
    helpContainer.style.paddingBottom = "5px";

    content.forEach((cmd) => {
        const commandElement = document.createElement("div");
        commandElement.style.display = "flex";
        commandElement.style.justifyContent = "space-between";
        commandElement.style.marginBottom = "5px";
        commandElement.style.color = "#83abda";

        const commandName = document.createElement("span");
        commandName.style.flexGrow = "1";
        commandName.style.textAlign = "left";

        const descriptionElement = document.createElement("span");
        descriptionElement.style.color = "#2290a4";
        descriptionElement.style.textAlign = "right";

        commandElement.appendChild(commandName);
        commandElement.appendChild(descriptionElement);
        helpContainer.appendChild(commandElement);

        animateText(commandName, cmd.name, terminalDisplayContainer);
        animateText(descriptionElement, cmd.description, terminalDisplayContainer).then(() => {
            highlightLinks(descriptionElement, cmd.description);
            isCommandRunning = false;
        });
    });

    terminalDisplay.appendChild(helpContainer);
}

function highlightLinks(element: HTMLElement, text: string) {
    if (!/https?:\/\/[^\s]+/.test(text) && !/\S+@\S+\.\S+/.test(text)) return;

    // Replaced in a single pass over the text. Substituting one match at a time
    // let a short URL match inside the href of a longer one already linkified
    // (github.com/PanduruIonut inside github.com/PanduruIonut/synctify-nuxt).
    const anchor = (href: string, label: string) => {
        const anchorTag = document.createElement("a");
        anchorTag.href = href;
        anchorTag.textContent = label;
        anchorTag.style.color = "#2498AF";
        anchorTag.style.textDecoration = "underline";
        anchorTag.style.cursor = "pointer";
        anchorTag.style.fontWeight = "bold";
        return anchorTag.outerHTML;
    };

    element.innerHTML = element.innerHTML
        .replace(/https?:\/\/[^\s]+/g, (link) => {
            const label = socials.find((social) => social.description === link)?.text || link;
            return anchor(link, label);
        })
        .replace(/\S+@\S+\.\S+/g, (email) => anchor(`mailto:${email}`, email));
}
function stopTyping(clickSound: HTMLAudioElement, terminalDisplay: HTMLElement) {
    clearTimeout(typingTimeout);
    clickSound.pause();
    terminalDisplay.innerHTML = "";
    isCommandRunning = false;
}
function preventTyping(event: KeyboardEvent) {
    if (skipKeys.includes(event.key)) {
        event.preventDefault();
        return;
    }
}
function changePromptLocation() {
    const inputPromptElement = document.querySelector('.terminal__input_container-promt-4');
    if (!inputPromptElement) return;
    inputPromptElement.textContent = getCurrentPath();
    if(currentDirectory === "/") inputPromptElement.textContent = "";

}
async function handleCommand(command: string, args?: string[], opts?: string[]): Promise<string> {

    console.log(command)
    let selectedCommand = commands.find(
        (cmd) => cmd.name.toLowerCase() === command
    );
    console.log(selectedCommand)
    if (!selectedCommand) {
        selectedCommand = ctfCommands.find(
            (cmd) => cmd.name.toLowerCase() === command
        );
    }
    if (!selectedCommand) {
        selectedCommand = hiddenCommands.find(
            (cmd) => cmd.name.toLowerCase() === command
        );
    }
    if (selectedCommand) {
        if (selectedCommand.args && (!args || args.length !== selectedCommand.args.length)) {
            return `Command '${command}' requires args: ${selectedCommand.args.join(", ")}`;
        }

        if (selectedCommand.options && (!opts || opts.some(opt => !selectedCommand?.options!.includes(opt)))) {
            return `Invalid option(s) for '${command}'. Available options: ${selectedCommand.options.join(", ")}`;
        }

        switch (selectedCommand.name) {
            case "pwd": return getCurrentPath();
            case "ls":
                if (selectedCommand.options && selectedCommand.options[0] === "-l") {
                    return listFiles();
                } else {
                    return "";
                }
            case "cat":
                if (args && args.length > 0) {
                    const filename = args[0];
                    if (filename === "/proc/self") {
                        return `You are reading it.\n\n${REPO_URL}`;
                    }
                    const result = await readFile(filename)
                    return result ?? STORE_UNAVAILABLE;

                } else {
                    return "Missing filename. Usage: cat <filename>";
                }
            case "help":
                return "";
            case "whoami":
                return `Panduru Ionut, ${new Date().getFullYear() - 1996}, full stack developer in Sibiu.\n\nPaid to build game integration services.\nUnpaid, I build side products. One of them tracks motorbikes.\n\nI ride one, which is how it started.`;
            case "history":
                return `2018 - Graduated from Lucian Blaga University of Sibiu (B.Sc. in Computer Science)\n\n2018 - Android Developer @ KeepCalling\n\n2020 - Graduated from Lucian Blaga University of Sibiu (M.Sc. in Advanced Informatics Systems)\n\n2020 - Full Stack Developer @ EdelCode\n\n2020 - Full Stack Developer @ Graffino\n\n2022 - Full Stack Developer @ Evo Primes / Plutus Inc\n\n2022 - Full Stack Developer @ Thiele & Close\n\n2024 - Now Software Engineer @ Betfair`;
            case "mp":
                return `Projects I'm currently proud of:\n\nMoto-Tracker - IoT motorcycle tracking platform: custom ESP32 firmware, Node.js/Express, PostgreSQL, MQTT and a MapLibre GL PWA with live GPS, trip history, crash & theft detection.\n\nStiu.ai - News intelligence platform that scrapes, deduplicates and AI-enriches Romanian news, with summaries, Q&A and a credibility trust score. https://stiu.ai\n\nUs - Real-time app for couples, shipped natively on both platforms: SwiftUI on iOS, Kotlin & Jetpack Compose on Android, Supabase behind it.\n\nWedding Share - Guest photo sharing with QR pairing and multithreaded uploads. https://github.com/PanduruIonut/wedding-share\n\nSynctify - Spotify liked-songs sync with previews, built with Laravel and Nuxt. https://github.com/PanduruIonut/synctify-nuxt\n\nSprint Scape - Venue booking and team scheduling for sports activities. https://sprint-scape.vercel.app\n\nFC Skill Trainer - iOS & Android trainer teaching EA Sports FC skill moves through real input practice, on touchscreen or a paired DualSense/Xbox controller.\n\nLeap of Faith - A creative attempt to recreate Apple's smooth scroll animation effects. https://panduruionut.github.io/leap-of-faith\n\nMore experiments and open-source work @ https://github.com/PanduruIonut`;
            case "ping":
                return ``;
            case "top":
                return `Front-End: React, Vue.js, TypeScript, JavaScript, HTML, CSS\n\nBack-End: Node.js, NestJS, Java (Spring Boot), PHP (Laravel), GraphQL, gRPC\n\nData: PostgreSQL, MySQL, Cassandra, Redis, Kafka, Solr, Qdrant\n\nDevOps & Cloud: Docker, Kubernetes, ArgoCD, GitHub Actions, Nginx, AWS (EC2, ECR, S3, SQS, Lambda, SES, IAM)\n\nTesting: Jest, Vitest, Cypress\n\nMobile: Android (Java, RxJava, Dagger, Firebase)`;
            case "clear":
                return "";
            case "mute":
                return "";
            case "cd":
                if (args && args.length > 0) {
                    const directory = args[0];
                    const result = changeDirectory(directory);
                    changePromptLocation();
                    if (result) {
                        return result;
                    } else {
                        return `Directory not found: '${directory}'`;
                    }
                } else {
                    return "Missing directory name. Usage: cd <directory>";
                }
            case "Invalid command":
                return "Invalid command.";
            case "Invalid options":
                return "Invalid options.";
            case "Invalid number of args":
                return "Invalid number of args.";
            case "ctf":
                return "2 flags are hidden on this website. Find them and submit them in the 'owned' command.\n\nget more info about it using 'helpctf'\n\nGood luck!";
            case "hints":
                return "Make use of the developer tools to inspect source code, network requests, cookies."
            case "userOwns": {
                const users = await getUsers();
                return users ?? STORE_UNAVAILABLE;
            }
            case "owned": {
                if (args && args.length !== 3) return "Invalid number of args";
                const result = await submitFlags(args![0], args![1], args![2]);
                return result;
            }
            case "theme":
                return applyTheme(args![0]);
            case "htop":
                return htopOutput();
            case "matrix":
                return runMatrix();
            case "crt":
                return toggleCrt();
            case "ssh":
                return "Permission denied (publickey).";
            case "source":
                return `This terminal is open source.\n\n${REPO_URL}`;
            case "!!":
                // Reached only with an empty history; otherwise handleKeyUp has
                // already swapped !! for the previous command.
                return "sh: !!: event not found";
            case "helpctf":
                return ''
            default:
                return `sh: Unknown command: ${command}. See 'help' for info.`;
        }
    } else {
        return `sh: Unknown command: ${command}. See 'help' for info.`;
    }
}

const IDLE_DELAY = 120000;
const idleLines = [
    "Still there?",
    "The cursor has been blinking on its own for a while now.",
    "'help' is still there, if you have run out of ideas.",
    "Two minutes of nothing. That is a kind of dedication.",
    "This terminal has nowhere else to be.",
    "The flags are still hidden. They keep well.",
    "You can type into this. That is the entire interface.",
    "Still nothing. The cursor is starting to take it personally.",
    "The sky above the port is the colour of a dead channel.",
    "Somewhere a side project is still marked defunct.",
    "No input detected. No judgement either.",
    "Nothing is happening. Technically that is still a state.",
    "The uptime counter and the productivity counter disagree.",
    "You found a terminal on a website and then stopped. Fair enough.",
];
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let idleIndex = 0;

/**
 * Prints a line after a couple of minutes of silence. Rescheduled on every
 * keystroke, and skipped while a command is still typing itself out.
 */
function scheduleIdleNudge(terminalDisplay: HTMLDivElement, terminalDisplayContainer: HTMLDivElement) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        if (isCommandRunning) {
            scheduleIdleNudge(terminalDisplay, terminalDisplayContainer);
            return;
        }

        const line = document.createElement("div");
        line.style.color = "#565f89";
        line.style.marginTop = "10px";
        terminalDisplay.appendChild(line);

        isCommandRunning = true;
        animateText(line, idleLines[idleIndex % idleLines.length], terminalDisplayContainer).then(() => {
            isCommandRunning = false;
            idleIndex += 1;
            scheduleIdleNudge(terminalDisplay, terminalDisplayContainer);
        });
    }, IDLE_DELAY);
}

export function displayWelcomeText(terminalDisplay: HTMLDivElement, terminalDisplayContainer: HTMLDivElement, _input: HTMLInputElement) {
    const hour = new Date().getHours();
    const lateNight = hour < 5;
    const welcomeText = lateNight
        ? `It's ${hour === 0 ? 12 : hour}am. This site will still be here tomorrow.\n\n'help' lists what it does. Not all of it.\n\n`
        : `A terminal pretending to be a homepage.\n\n'help' lists what it does. Not all of it.\n\n`;

    isCommandRunning = true;
    animateText(terminalDisplay, welcomeText, terminalDisplayContainer).then(() => {
        isCommandRunning = false;
        scheduleIdleNudge(terminalDisplay, terminalDisplayContainer);
    });
}

function getCurrentDirectoryEntry(currentDirectory: string): DirectoryEntry {
    const pathParts = currentDirectory.split('/').filter(part => part.trim() !== '');
    let currentEntry = virtualFileSystem['/'];

    for (const pathPart of pathParts) {
        if (currentEntry.type === 'directory' && currentEntry.content[pathPart]) {
            currentEntry = currentEntry.content[pathPart] as DirectoryEntry;
        } else {
            throw new Error(`Invalid path: ${currentDirectory}`);
        }
    }

    return currentEntry;
}
function getFolderFileSuggestions(
    inputValue: string,
    currentDirEntry: DirectoryEntry
): string[] {
    const suggestions: string[] = [];
    if (!inputValue) return suggestions;
    const inputValueLower = inputValue.toLowerCase();

    for (const folderName in currentDirEntry.content) {
        const entry = currentDirEntry.content[folderName];
        if (entry.type === "directory" &&
            folderName.toLowerCase().startsWith(inputValueLower)) {
            suggestions.push(folderName);
        }
    }

    for (const fileName in currentDirEntry.content) {
        const entry = currentDirEntry.content[fileName];
        if (entry.type === "file" &&
            fileName.toLowerCase().startsWith(inputValueLower)) {
            suggestions.push(fileName);
        }
    }

    return suggestions;
}

export async function handleKeyUp(event: KeyboardEvent, input: HTMLInputElement, terminalDisplay: HTMLDivElement, terminalDisplayContainer: HTMLDivElement) {
    scheduleIdleNudge(terminalDisplay, terminalDisplayContainer);

    switch (event.key) {
        case 'ArrowUp':
            navigateHistory(-1);
            break;
        case 'ArrowDown':
            navigateHistory(1);
            break;
    }
    if (event.key === "Enter") {
        if (isCommandRunning) {
            if (previousTypingSpeed !== typingSpeed) return;
            previousTypingSpeed = typingSpeed;
            typingSpeed = 1;
            return;
        }
        if (input.value === "") return;
        isCommandRunning = true;
        let tempCommand = input.value.trim();
        if (tempCommand === "!!") {
            const previous = commandHistory[commandHistory.length - 1];
            // With no history it falls through to the "!!" case, which reports
            // the same thing bash does.
            if (previous) tempCommand = previous;
        }
        input.value = "";
        input.focus();
        const parsedInput = parseInput(tempCommand);
        if (parsedInput) {
            const { command: cmd, options, args } = parsedInput;
            command = cmd;

            const output = await handleCommand(command, args, options);
            const formattedCommand = command + (args ? " " + args.join(" ") : "") + (options ? " " + options.join(" ") : "");
            addToCommandHistory(formattedCommand)


            const outputContainer = document.createElement("div");
            outputContainer.classList.add("output-container");
            outputContainer.style.marginTop = "10px";
            outputContainer.style.marginBottom = "10px";

            const promptSpan1 = document.createElement("span");
            promptSpan1.classList.add("terminal__input_container-promt-2");
            promptSpan1.textContent = "λ";
            promptSpan1.style.color = "#ff9e64";
            promptSpan1.style.marginBottom = "25px";

            const promptSpan2 = document.createElement("span");
            promptSpan2.classList.add("terminal__input_container-promt-2");
            promptSpan2.textContent = "~";
            promptSpan2.style.color = "#AF91E8";
            promptSpan2.style.marginLeft = "5px";
            promptSpan2.style.marginBottom = "25px";

            const promptSpan3 = document.createElement("span");
            promptSpan3.classList.add("terminal__input_container-promt-3");
            promptSpan3.textContent = ">>";
            promptSpan3.style.color = "#2ac3de";
            promptSpan3.style.marginBottom = "25px";
            promptSpan3.style.marginLeft = "5px";
            promptSpan3.style.fontSize = "12px";

            const promptSpan4 = document.createElement("span");
            promptSpan4.classList.add("terminal__input_container-promt-location");
            promptSpan4.textContent = currentDirectory === "/" ? '' : currentDirectory;
            promptSpan4.style.color = "#2ac3de";
            promptSpan4.style.marginBottom = "25px";
            promptSpan4.style.marginLeft = "5px";
            promptSpan4.style.fontSize = "12px";

            const commandInput = document.createElement("span");
            commandInput.classList.add("command-input");
            commandInput.style.color = "#7699C4";
            commandInput.style.marginLeft = "10px";
            commandInput.textContent = formattedCommand;

            outputContainer.appendChild(promptSpan1);
            outputContainer.appendChild(promptSpan2);
            outputContainer.appendChild(promptSpan3);
            outputContainer.appendChild(promptSpan4);
            outputContainer.appendChild(commandInput);

            if (command === "clear") {
                terminalDisplay.innerHTML = "";
                isCommandRunning = false;
                return;
            }
            if (command === "mute") {
                clickSound.muted = !clickSound.muted;
                isCommandRunning = false;
                return;
            }
            terminalDisplay.appendChild(outputContainer);

            const outputText = document.createElement("div");
            terminalDisplay.appendChild(outputText);
            animateText(outputText, output, terminalDisplayContainer).then(() => {
                highlightLinks(outputText, output);
                isCommandRunning = false;
            });

            if (command === "help") {
                let cmds = commands.filter((cmd) => cmd.name !== "clear");
                cmds = cmds.filter((cmd) => cmd.name !== "helpctf");
                displaySidesBlock(cmds, terminalDisplay, terminalDisplayContainer);
            }
            if (command === "helpctf") {
                displaySidesBlock(ctfCommands, terminalDisplay, terminalDisplayContainer);
            }
            if (command === "ping") {
                displaySidesBlock(socials, terminalDisplay, terminalDisplayContainer);
            }

            input.value = "";

            command = "";
            terminalDisplayContainer.scrollTop =
                terminalDisplayContainer.scrollHeight;
        }
    } else {
        command = input.value.trim().split(" ")[0].toLowerCase();
        if (commands.find((cmd) => cmd.name.toLowerCase() === command) || ctfCommands.find((cmd) => cmd.name.toLowerCase() === command)) {
            input.classList.add("valid-command");
        } else {
            input.classList.remove("valid-command");
        }
    }
}

export async function getFlag(flagNumber: string) {
    try {
        const response = await fetch(`/api/flag?id=${encodeURIComponent(flagNumber)}`);
        if (!response.ok) {
            throw new Error(`Flag request failed with ${response.status}`);
        }

        const data = await response.json();
        return data.flag as string;
    } catch (error) {
        console.error("Error fetching flag:", error);
        return null;
    }
}

export async function getUsers() {
    try {
        const response = await fetch("/api/users");
        if (!response.ok) {
            throw new Error(`User request failed with ${response.status}`);
        }

        const data = await response.json();
        const users = (data.users ?? []) as string[];
        if (users.length === 0) {
            return "Nobody has submitted the flags yet. Be the first.";
        }

        return users.join("\n");
    } catch (error) {
        console.error("Error fetching users:", error);
        return null;
    }
}

export async function submitFlags(flag1: string, flag2: string, user: string) {
    try {
        const response = await fetch("/api/owned", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ flag1, flag2, user }),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            return data?.error ?? "There was an error submitting the flag(s), please try again.";
        }

        if (!data?.ok) {
            return data?.reason ?? "Invalid flag(s), please try again.";
        }

        return 'Flag submitted successfully, you can check the list of users that submitted flags with the "userOwns" command.';
    } catch (error) {
        console.error("Error submitting flags:", error);
        return "There was an error submitting the flag(s), please try again.";
    }
}

export function handleKeyDown(event: KeyboardEvent, terminalDisplay: HTMLDivElement, input: HTMLInputElement) {
    if (event.key === "Tab") {
        event.preventDefault();
        command = input.value.trim();
        if (command === "") return;
        const parsedInput = parseInput(command);
        if (parsedInput) {
            const { command: cmd, args } = parsedInput;
            command = cmd;
            if (cmd === 'cd' || cmd === 'cat') {
                const currentDirEntry = getCurrentDirectoryEntry(currentDirectory);
                const test = getFolderFileSuggestions(args![0], currentDirEntry);
                if (test.length > 0) {
                    input.value = cmd + ' ' + test[0];
                }
            }
        }
    }
    if (event.shiftKey && event.key === "M" || event.ctrlKey && event.key === "M") {
        clickSound.muted = !clickSound.muted;
    }
    if (event.ctrlKey && event.key === "c") {
        stopTyping(clickSound, terminalDisplay);
    }
    if (event.metaKey && event.key === "k") {
        stopTyping(clickSound, terminalDisplay);
    } else if (event.ctrlKey && event.key === "l") {
        stopTyping(clickSound, terminalDisplay);
    } else if (event.shiftKey && event.key === ">") {
        if (typingSpeed < 10) return;
        typingSpeed -= 10;
        clickSound.playbackRate += 0.1;
        preventTyping(event);
    } else if (event.shiftKey && event.key === "<") {
        if (typingSpeed > 100) return;
        typingSpeed += 10;
        if (clickSound.playbackRate < 1.3) return;
        clickSound.playbackRate -= 0.1;
        preventTyping(event);
    } else if (event.shiftKey && event.key === ">") {
        if (typingSpeed < 150) return;
        typingSpeed -= 10;
        if (clickSound.playbackRate > 2.1) return;
        clickSound.playbackRate += 0.1;
        preventTyping(event);
    } else if (event.shiftKey && event.key === "<") {
        if (typingSpeed > 100) return;
        typingSpeed += 10;
        if (clickSound.playbackRate < 1.3) return;
        clickSound.playbackRate += 0.1;
        preventTyping(event);
    }
    if (event.key === "Escape") {
        input.value = "";
    }
}


function addToCommandHistory(command: string) {
    commandHistory.push(command);

    historyIndex = commandHistory.length - 1;
}
function navigateHistory(offset: number) {
    if (commandHistory.length === 0) {
        return;
    }

    historyIndex += offset;

    historyIndex = Math.min(Math.max(historyIndex, -1), commandHistory.length - 1);

    const previousCommand = historyIndex >= 0 ? commandHistory[historyIndex] : '';

    const input = document.querySelector('.terminal__input') as HTMLInputElement;
    input.value = previousCommand;
}
