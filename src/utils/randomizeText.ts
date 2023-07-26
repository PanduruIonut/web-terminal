export function randomizeText(text){
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let iterationsNr = 0;
    let intervalId;

    if (!text) return;

    text.onmouseover = () => {
        intervalId = setInterval(() => {
            text.innerText = text.innerText.split("")
                .map((letter, index) => {
                    if (index < iterationsNr) {
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