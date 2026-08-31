/**
 * A block cursor, the way a real terminal has one, instead of the browser's
 * thin I-beam caret.
 *
 * The native caret is hidden with caret-color and a block is drawn at the same
 * spot. Position is measured with a canvas using the input's own computed font
 * rather than assuming a character width, so it stays correct if the font or
 * size ever changes — and it follows the actual caret rather than the end of
 * the line, so arrow keys and clicks move it properly.
 */
const CURSOR_CLASS = "terminal__cursor";

let measurer: CanvasRenderingContext2D | null = null;

function textWidth(value: string, font: string): number {
    if (!measurer) measurer = document.createElement("canvas").getContext("2d");
    if (!measurer) return 0;
    measurer.font = font;
    return measurer.measureText(value).width;
}

export function initBlockCursor(input: HTMLInputElement): void {
    const host = input.parentElement;
    if (!host) return;

    const cursor = document.createElement("span");
    cursor.className = CURSOR_CLASS;
    cursor.setAttribute("aria-hidden", "true");
    host.appendChild(cursor);

    const place = () => {
        const style = getComputedStyle(input);
        const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

        // selectionStart, not value.length: the caret can sit mid-string.
        const caretIndex = input.selectionStart ?? input.value.length;
        const offset = textWidth(input.value.slice(0, caretIndex), font);
        const charWidth = textWidth("0", font);

        cursor.style.width = `${charWidth}px`;
        cursor.style.height = style.fontSize;
        cursor.style.left = `${input.offsetLeft + offset}px`;
        cursor.style.top = `${input.offsetTop + (input.offsetHeight - parseFloat(style.fontSize)) / 2}px`;
    };

    // Called directly rather than through requestAnimationFrame: rAF does not
    // fire in a backgrounded tab, which would leave the block stranded at the
    // start of the line until the tab came forward again. `keyup` rather than
    // `keydown`, so selectionStart has already moved by the time we read it.
    for (const event of ["input", "keyup", "click", "focus", "select"]) {
        input.addEventListener(event, place);
    }

    // Arrow keys and drag-selection move the caret without firing `input`.
    document.addEventListener("selectionchange", () => {
        if (document.activeElement === input) place();
    });
    window.addEventListener("resize", place);

    // The prompt grows a path segment on `cd`, which shifts the input sideways.
    new MutationObserver(place).observe(host, {
        childList: true,
        subtree: true,
        characterData: true,
    });

    place();
}
