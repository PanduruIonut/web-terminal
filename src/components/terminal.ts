import { displayWelcomeText, handleKeyUp, handleKeyDown } from "../utils/terminal-utils";
import { getCurrentPath } from "../utils/fileSystem/functionality";
import { saveVirtualFileSystemToLocalStorage } from "../utils/fileSystem/virtualFileSystem";
export class MyTerminal extends HTMLElement {

    constructor() {
        super();
    }

    connectedCallback() {
        saveVirtualFileSystemToLocalStorage();
        document.addEventListener("DOMContentLoaded", () => {
            const input = document.querySelector(
                ".terminal__input"
            ) as HTMLInputElement;
            const currentPathElement = document.querySelector(
                ".terminal__input_container-promt-4"
            ) as HTMLInputElement;
            currentPathElement.innerText = getCurrentPath();
            const terminal = document.querySelector(".terminal") as HTMLDivElement;
            const terminalDisplay = document.querySelector(
                ".terminal__display"
            ) as HTMLDivElement;
            const terminalDisplayContainer = document.querySelector(
                ".terminal__display-container"
            ) as HTMLDivElement;

            terminal.style.transform = "translateY(10px)";
            setTimeout(() => {
                terminal.style.transform = "translateY(0)";
                displayWelcomeText(terminalDisplay, terminalDisplayContainer, input)
            }, 1000);

            input.addEventListener("keyup", (event) => handleKeyUp(event, input, terminalDisplay, terminalDisplayContainer));
            document.addEventListener("keydown", (event) => handleKeyDown(event, terminalDisplay, input,));
            terminal.addEventListener("click", () => {
                input.focus();
            });

        });
        this.innerHTML = `
        <style>
        .terminal__content {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background-color: rgba(0, 0, 0, 0.6);
            height: 400px;
            width: 800px;
            box-shadow: rgba(0, 0, 0, 0.35) 0px 5px 15px;
            border-bottom-left-radius: 7px;
            border-bottom-right-radius: 7px;
        }
        @media only screen and (max-width: 800px) {
            .terminal__content {
                width: 90vw;
                height: 60vh;
            }
    }

        .terminal__title-container {
            background-color: #c8c8c8;
            border-top-left-radius: 7px;
            border-top-right-radius: 7px;
            color: black;
            font-weight: bold;
            width: 100%;
            align-items: center;
            display: flex;
            padding-top: 5px;
            padding-bottom: 5px;
            justify-content: center;
            font-size: 12px;
            border-bottom: black 1px solid;
        }

        .terminal__display-container {
            flex: 1;
            overflow: auto;
            margin-left: 10px;
            margin-top: 20px;
        }

        .terminal__display {
            color: white;
            padding: 10px;
            white-space: pre-wrap;
            font-size: 14px;
        }

        .terminal__input {
            font-family: monospace;
            margin: 0 auto;
            bottom: 0%;
            width: 90%;
            background-color: rgba(0, 0, 0, 0);
            border: none;
            color: #83abda;
            margin-bottom: 25px;
            font-size: 14px;
        }

        .terminal__input:focus {
            outline: none;
        }
        .terminal__input_container {
        display: flex;
        overflow: hidden;
        align-items: center;
        white-space: nowrap;
        margin-bottom: 5px;
    }

        .terminal__input_container-promt-1 {
            color: #ff9e64;
            margin-left: 20px;
            margin-bottom: 25px;
        }

        .terminal__input_container-promt-2 {
            color: #af91e8;
            margin-left: 5px;
            margin-bottom: 25px;
        }

        .terminal__input_container-promt-3 {
            color: #2ac3de;
            margin-bottom: 25px;
            margin-left: 5px;
            font-size: 12px;
        }
        .terminal__input_container-promt-4 {
            color: #2ac3de;
            margin-bottom: 25px;
            font-size: 12px;
        }

        .close-button {
            width: 12px;
            height: 12px;
            margin-left: 10px;
            border-radius: 50%;
            box-shadow: rgba(100, 100, 111, 0.2) 0px 7px 29px 0px;
            background-color: #ff605c;
        }

        .hide-button {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-left: 8px;
            margin-right: 8px;
            background-color: #ffbd44;
        }

        .resize-button {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background-color: #00ca4e;
        }

        .terminal__title {
            flex-grow: 1;
            text-align: center;
        }

        .terminal__input.valid-command {
            color: rgb(36, 170, 36);
        }

        @keyframes moveTerminal {
            0% {
                transform: translateY(0);
            }
            50% {
                transform: translateY(10px);
            }
            100% {
                transform: translateY(0);
            }
        }

        .terminal {
            animation: moveTerminal 1s ease-in-out;
        }
        .terminal__buttons {
            display: flex;
            position: fixed;
            left: 0;
        }
    </style>
        <div class="terminal">
            <div class="terminal__title-container">
                <div class="terminal__buttons">
                    <div class="close-button"></div>
                    <div class="hide-button"></div>
                    <div class="resize-button"></div>
                </div>
                <div class="terminal__title">ionut@MacBook-Air:~</div>
            </div>
            <div class="terminal__content">
                <div class="terminal__display-container">
                    <div class="terminal__display"></div>
                </div>
                <div class="terminal__input_container">
                    <div class="terminal___input_container-prompt">
                        <span class="terminal__input_container-promt-1">λ</span>
                        <span class="terminal__input_container-promt-2">~</span>
                        <span class="terminal__input_container-promt-3">&gt;&gt;</span>
                        <span class="terminal__input_container-promt-4"></span>
                        <input
                            class="terminal__input"
                            id="input-field"
                            autofocus
                            spellcheck="false"
                        />
                    </div>
                </div>
            </div>
        </div
        `;
    }

}

customElements.define('my-terminal', MyTerminal);