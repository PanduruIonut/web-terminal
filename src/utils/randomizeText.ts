import { getFlag } from '../utils/terminal-utils'

export async function randomizeText(text: HTMLElement) {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let iterationsNr = 0;
    let intervalId: ReturnType<typeof setInterval>;
    let flag: string | null = null;

    if (!text) return;

    text.onmouseover = async () => {
        if (!text.dataset.value) return;

        if (flag === null) {
            try {
                flag = await getFlag('flag-1');
            } catch (error) {
                console.error("Error fetching flag:", error);
                return;
            }
        }

        intervalId = setInterval(() => {
            text.innerText = text.innerText
                .split("")
                .map(() => letters[Math.floor(Math.random() * 26)])
                .join("");

            if (iterationsNr >= 7 && flag !== null) {
                text.innerText = flag;
                clearInterval(intervalId);
            }

            iterationsNr += 1;
        }, 60);
    };

    text.onmouseout = () => {
        clearInterval(intervalId);
        iterationsNr = 0;
    };
}
