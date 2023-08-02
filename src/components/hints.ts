    export class MyHints extends HTMLElement{
        hints: string[];
        hintIndex: number;
        constructor(){
            super();
            this.hints = [
                "Press &ensp;[tab]&ensp; for autocomplete",
                "Press &ensp;[enter]&ensp; while a command is running to speed it up",
                "Press &ensp;[shift]&ensp; & &ensp;[>]&ensp; to speed up typing",
                "Press &ensp;[shift]&ensp; & &ensp;[<]&ensp; to slow down typing",
                "Press &ensp;[cmd]&ensp; & &ensp;[k]&ensp; to clear the terminal",
                "Press &ensp;[shift]&ensp; & &ensp;[m]&ensp; to toggle sounds",
                "Press &ensp;[ctrl]&ensp; & &ensp;[c]&ensp; to cancel the current command",
                "Press &ensp;[ctrl]&ensp; & &ensp;[l]&ensp; to clear the terminal",
                "Press &ensp;[cmd]&ensp; & &ensp;[esc]&ensp; to clear the input",
                "Type &ensp;[mute]&ensp; to mute the typing sound",
                "Type &ensp;[up arrow]&ensp; to navigate through the history",
                "Type &ensp;[down arrow]&ensp; to navigate through the history",
            ];
            this.hintIndex = 0;
            this.attachShadow({ mode: 'open' });
        }
        connectedCallback() {
            const hintsElement = document.createElement("div");
            hintsElement.classList.add("hints");
            if(!this.shadowRoot) return;
            this.shadowRoot.innerHTML = `
            <style>
            .hints {
                color: white;
                opacity: 0.7;
                font-size: 0.9rem;
                margin-top: 1rem;
                text-align: center;
                height: 10px;
                transition: opacity 2s;
                margin-top: 40px;
                display: flex;
                justify-content: center;
                align-items: center;
                width: 100%;
            </style>
            `;
        
            this.shadowRoot.appendChild(hintsElement);
        
            setTimeout(() => {
                requestAnimationFrame(() => this.displayNextHint());
            }, 0);
            setInterval(() => {
                requestAnimationFrame(() => this.displayNextHint());
            }, 3500);
        }
        
        displayNextHint() {
            if(!this.shadowRoot) return;
            const hintsElement = this.shadowRoot.querySelector(".hints");
            if (hintsElement) {
            hintsElement.innerHTML = this.hints[this.hintIndex] ?? "";
            this.highlightCommands(this.hints[this.hintIndex] ?? "", hintsElement);
            hintsElement.setAttribute('style', 'opacity:0.7');
            setTimeout(() => {
                hintsElement.setAttribute('style', 'opacity:0');
            }, 2000);
            this.hintIndex = (this.hintIndex + 1) % this.hints.length;
            }
        }
        
        highlightCommands(hint: string, hintElement: Element) {
            const commands = hint.match(/\[(.*?)\]/g);
            if (commands) {
                const firstKey = document.createElement("span");
                const secondKey = document.createElement("span");
                firstKey.textContent = commands[0];
                secondKey.textContent = commands[1] ? commands[1] : "";
                firstKey.setAttribute("style", "color:#ff9e64;");
                secondKey.setAttribute("style", "color:#2ac3de;");

                let highlightedHint = hint;
                if (commands) {
                    highlightedHint = highlightedHint.replace(
                        commands[0],
                        firstKey.outerHTML
                    );
                    if (commands[1]) {
                        highlightedHint = highlightedHint.replace(
                            commands[1],
                            secondKey.outerHTML
                        );
                    }
                }
                hintElement.innerHTML = highlightedHint;
            }
        }
    }
    
    customElements.define('my-hints', MyHints);