export function randomizeText(text: HTMLElement) {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let iterationsNr = 0;
    let intervalId: ReturnType<typeof setInterval>;

    if (!text) return;

    text.onmouseover = () => {
        if (!text.dataset.value) return;
        intervalId = setInterval(() => {
            text.innerText = text.innerText.split("")
                .map((_letter, index) => {
                    if (index < iterationsNr && text.dataset.value) {
                        return text.dataset.value[index];
                    }
                    return letters[Math.floor(Math.random() * 26)];
                })
                .join("");

            if (iterationsNr >= 7) clearInterval(intervalId);
            iterationsNr += 1;
        }, 60);
    };

    text.onmouseout = () => {
        clearInterval(intervalId);
        iterationsNr = 0;
    };
}
