import keySound from "../../public/sounds/keyboardTyping.wav";

type Command = {
    name: string;
    description: string;
    text?: string;
}

let command = "";
let isCommandRunning = false;
let previousTypingSpeed = 50;
let typingSpeed = 50;
let skipKeys = [">", "<"];
let typingTimeout: ReturnType<typeof setTimeout>;

const clickSound = new Audio(keySound);
clickSound.volume = 0.4;
clickSound.playbackRate = 1.4;


export const commands: Command[] = [
    { name: "clear", description: "Clear the terminal" },
    { name: "help", description: "Commands list" },
    { name: "history", description: "Professional Background" },
    { name: "ls", description: "My Projects" },
    { name: "ping", description: "Contact Me" },
    { name: "top", description: "My Main Tech Stack" },
    { name: "whoami", description: "About Me", },
];
const socials: Command[] = [
    { name: "GitHub", description: "https://github.com/PanduruIonut", text: 'PanduruIonut' },
    { name: "Twitter", description: "https://twitter.com/ThisIsIonut", text: 'ThisIsIonut' },
    {
        name: "Linkedin",
        description: "https://www.linkedin.com/in/ionut-panduru/", text: 'Ionut-Panduru'
    },
    { name: "E-mail", description: "panduru.ionut@hotmail.com" },
];
export function animateText(
    element: HTMLElement,
    text: string,
    terminalDisplayContainer: HTMLElement,
): Promise<void> {
    clickSound.play().catch((error) => {
        console.error("Audio playback error:", error);
    });

    return new Promise((resolve) => {
        let index = 0;

        function type() {
            if (index < text.length) {
                element.innerHTML += text.charAt(index);
                index++;

                terminalDisplayContainer.scrollTop =
                    terminalDisplayContainer.scrollHeight;

                if (index === text.length) {
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
    const links = text.match(/https?:\/\/[^\s]+/g);
    const mail = text.match(/\S+@\S+\.\S+/g);
    if (links) {
        links.forEach((link) => {
            const anchorTag = document.createElement("a");
            anchorTag.href = link;
            anchorTag.textContent = link;
            anchorTag.style.color = "#2498AF";
            anchorTag.style.textDecoration = "underline";
            anchorTag.style.cursor = "pointer";
            anchorTag.style.fontWeight = "bold";
            anchorTag.textContent = socials.find(
                (social) => social.description === link
            )?.text || link;
            element.innerHTML = element.innerHTML.replace(
                link,
                anchorTag.outerHTML
            );

        });
    }
    if (mail) {
        mail.forEach((email) => {
            const anchorTag = document.createElement("a");
            anchorTag.href = `mailto:${email}`;
            anchorTag.textContent = email;
            anchorTag.style.color = "#2498AF";
            anchorTag.style.textDecoration = "underline";
            anchorTag.style.cursor = "pointer";
            anchorTag.style.fontWeight = "bold";
            element.innerHTML = element.innerHTML.replace(
                email,
                anchorTag.outerHTML
            );
        });
    }
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
function handleCommand(command: string): string {
    const selectedCommand = commands.find(
        (cmd) => cmd.name === command
    );
    if (selectedCommand) {
        switch (selectedCommand.name) {
            case "help":
                return "";
            case "whoami":
                return `My name is Panduru Ionut\n\nI'm 26 and I'm currently a fullstack web developer.\n\nI love coding and CTF's.`;
            case "history":
                return `2018 - Graduated from University of Lucian Blaga Sibiu (B.Sc. in ComputerScience)\n\n2018 - Android Developer @ KeepCalling\n\n2020 - Web Developer @ EdelCode\n\n2020 - Graduated from University of Lucian Blaga Sibiu (M.Sc. in ComputerScience)\n\n2020 - Full Stack Web Developer @ Graffino\n\n2022 - Now Working as Freelancer`;
            case "ls":
                return `Projects i'm currenlty proud of:\n\nWeb app to schedule & organize teams for multiple sports https://sprint-scape.vercel.app\n\nAttempt to recreate apple scroll animation effect https://panduruionut.github.io/leap-of-faith\n\nMore @ https://github.com/PanduruIonut`;
            case "ping":
                return ``;
            case "top":
                return `My current main tech stack is VueJs with Typescript for fronted & Laravel for backend.\n\nI'm currently trying out NextJS with Typescript & TailwindCSS.\n\nI'm also trying to learn more about AWS & Docker.`;
            case "clear":
                return "";
            case "mute":
                return "";
            default:
                return `sh: Unknown command: ${command}. See 'help' for info.`;
        }
    } else {
        return `sh: Unknown command: ${command}. See 'help' for info.`;
    }
}

export function displayWelcomeText(terminalDisplay: HTMLDivElement, terminalDisplayContainer: HTMLDivElement, input: HTMLInputElement) {
    const welcomeText = `Welcome to my personal website!\n\nType "help" to see the list of available commands.\n\nFeel free to explore!\n\n`;
    isCommandRunning = true;
    animateText(terminalDisplay, welcomeText, terminalDisplayContainer).then(() => {
        input.focus();
        isCommandRunning = false;
    });
}
function getCommandSuggestions(inputValue: string) {
    return commands
        .map((cmd) => cmd.name)
        .filter((cmd) => cmd.startsWith(inputValue));
}

export function handleKeyUp(event: KeyboardEvent, input: HTMLInputElement, terminalDisplay: HTMLDivElement, terminalDisplayContainer: HTMLDivElement) {
    if (event.keyCode === 39) {
        event.preventDefault();
        event.stopPropagation();
        command = input.value.trim();
        command = command.toLowerCase();
        if (command === "") return;
        const suggestions = getCommandSuggestions(command);
        if (suggestions.length > 0) {
            const matchedSuggestion = suggestions.find((suggestion) => suggestion !== command);
            if (matchedSuggestion) {
                const inputWithSuggestion = command + matchedSuggestion.slice(command.length);
                input.value = inputWithSuggestion;
            }
        }
    }

    if (event.key === "Enter") {
        if (isCommandRunning) {
            console.log("isCommandRunning", isCommandRunning)
            if (previousTypingSpeed !== typingSpeed) return;
            previousTypingSpeed = typingSpeed;
            typingSpeed = 1;
            return;
        }
        if (input.value === "") return;
        isCommandRunning = true;
        input.value = "";
        const output = handleCommand(command);

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

        const commandInput = document.createElement("span");
        commandInput.classList.add("command-input");
        commandInput.style.color = "#7699C4";
        commandInput.style.marginLeft = "10px";
        commandInput.textContent = command;

        outputContainer.appendChild(promptSpan1);
        outputContainer.appendChild(promptSpan2);
        outputContainer.appendChild(promptSpan3);
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
            displaySidesBlock(cmds, terminalDisplay, terminalDisplayContainer);
        }
        if (command === "ping") {
            displaySidesBlock(socials, terminalDisplay, terminalDisplayContainer);
        }

        input.value = "";
        input.focus();

        command = "";
        terminalDisplayContainer.scrollTop =
            terminalDisplayContainer.scrollHeight;
    } else {
        command = input.value.trim();
        command = command.toLocaleLowerCase();
        if (commands.find((cmd) => cmd.name === command)) {
            input.classList.add("valid-command");
        } else {
            input.classList.remove("valid-command");
        }
    }
}

export function handleKeyDown(event: KeyboardEvent, terminalDisplay: HTMLDivElement, input: HTMLInputElement) {
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
