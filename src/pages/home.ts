import { MyHints } from "../components/hints";
import { MyTerminal } from "../components/terminal";
import { MyLayout } from "../layouts/layout";

export class Home extends HTMLElement {
    constructor(){
        super();
    }
    connectedCallback() {
        this.innerHTML = `
        <style>
            html {
                background-color: #1a1b26;
            }

            body {
                margin: 0;
                padding: 0;
                overflow: auto;
            }

            main {
                width: 100vw;
                height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                display: flex;
                justify-content: center;
                align-items: center;
            }


            .content-container {
                justify-content: center;
                display: flex;
                flex-direction: column;
                align-items: center;
            }

            .hints {
                color: white;
                opacity: 0.7;
                font-size: 0.9rem;
                margin-top: 1rem;
                text-align: center;
                height: 10px;
                transition: opacity 2s;
                margin-top: 40px;
                justify-content: center;
            }
        </style>
        
        `;
        const mainElement = document.createElement("main");
        this.appendChild(mainElement);
        const contentContainerElement = document.createElement("div");
        contentContainerElement.classList.add("content-container");
        mainElement.appendChild(contentContainerElement);

        const myTerminalElement = new MyTerminal();
        const myLayout = new MyLayout();
        myLayout.appendChild(myTerminalElement);
        const hintsElement = new MyHints();
        contentContainerElement.innerHTML = myLayout.outerHTML;
        contentContainerElement.appendChild(hintsElement);
    }
}

customElements.define('my-home', Home);