/**
 * Undocumented commands. Nothing here is listed by `help`, which is the point.
 *
 * All three exports are self-contained: the CSS they need is injected once into
 * document.head (guarded by an id), so no other stylesheet has to know about
 * them. Every effect cleans up after itself, listeners included.
 */

const STYLE_ID = "easter-eggs-style";
const CRT_CLASS = "crt-effect";
const MATRIX_CLASS = "matrix-rain";
const TERMINAL_SELECTOR = ".terminal__content";

/**
 * Layer order matters when both effects are on. The rain repaints a dark fill
 * every frame to draw its trails, so it turns nearly opaque within a second or
 * two; if it sat above the CRT it would bury it. The canvas is fixed-position on
 * body and the CRT overlays are absolutely positioned inside .terminal__content,
 * but neither ancestor creates a stacking context, so both resolve against the
 * root and a plain z-index comparison decides the winner.
 */
const MATRIX_Z_INDEX = 900;
const CRT_TINT_Z_INDEX = 901;
const CRT_SCANLINE_Z_INDEX = 902;

const MATRIX_DURATION = 8000;
const MATRIX_FONT_SIZE = 14;
const MATRIX_FRAME_INTERVAL = 55;
const MATRIX_GLYPHS =
    "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ<>/*+-";

let matrixStop: (() => void) | null = null;

/**
 * Injected lazily so the styles only exist once someone actually finds one of
 * these commands. The id guard makes repeated calls a no-op.
 */
function ensureStyles(): void {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        .${CRT_CLASS} {
            position: relative;
        }

        /* Scanlines. Absolutely positioned, so it never becomes a flex item
           of .terminal__content and never pushes the input around. */
        .${CRT_CLASS}::before {
            content: "";
            position: absolute;
            inset: 0;
            z-index: ${CRT_SCANLINE_Z_INDEX};
            pointer-events: none;
            border-radius: inherit;
            background: repeating-linear-gradient(
                to bottom,
                rgba(0, 0, 0, 0.16) 0px,
                rgba(0, 0, 0, 0.16) 1px,
                rgba(0, 0, 0, 0) 1px,
                rgba(0, 0, 0, 0) 3px
            );
            animation: crtFlicker 4s steps(1, end) infinite;
        }

        /* Phosphor tint plus vignette. Kept faint on purpose: the text under
           it still has to be readable. */
        .${CRT_CLASS}::after {
            content: "";
            position: absolute;
            inset: 0;
            z-index: ${CRT_TINT_Z_INDEX};
            pointer-events: none;
            border-radius: inherit;
            background:
                radial-gradient(
                    ellipse at center,
                    rgba(0, 0, 0, 0) 52%,
                    rgba(0, 0, 0, 0.38) 100%
                ),
                linear-gradient(
                    rgba(90, 247, 142, 0.05),
                    rgba(42, 195, 222, 0.05)
                );
        }

        @keyframes crtFlicker {
            0%, 46%, 100% { opacity: 0.9; }
            47% { opacity: 0.62; }
            48% { opacity: 0.95; }
            84% { opacity: 0.9; }
            85% { opacity: 0.7; }
        }

        @media (prefers-reduced-motion: reduce) {
            .${CRT_CLASS}::before {
                animation: none;
            }
        }

        .${MATRIX_CLASS} {
            position: fixed;
            z-index: ${MATRIX_Z_INDEX};
            pointer-events: none;
            border-bottom-left-radius: 7px;
            border-bottom-right-radius: 7px;
        }
    `;

    document.head.appendChild(style);
}

/**
 * A process table for a machine that has clearly been left running too long.
 * Typed out character by character by animateText, so it stays short and does
 * not depend on colour. No angle brackets either: the caller writes into
 * innerHTML, and `<defunct>` would be parsed as a tag and vanish.
 */
export function htopOutput(): string {
    return [
        "  1[|||||||||||||||||||||||99.4%]  Tasks: 42, 3 running",
        "  2[|||                     5.1%]  Load: 7.02 6.94 6.88",
        "Mem[|||||||||||||||||  6.8G/8.0G]  Uptime: 412 days",
        "",
        "  PID USER  PRI NI CPU% MEM%     TIME+ COMMAND",
        " 1101 ionut  20  0 99.4  4.2  71h04:19 impostor_syndrome --verbose",
        " 1337 root   10 -5  0.2  0.1   9h12:44 coffeed --refill=pending",
        " 2048 ionut  20  0  0.0  0.0   0:00.00 side_project_v3 (defunct)",
        " 3072 ionut  20  0 62.8 18.6 612h07:33 cargo build --release",
        " 4096 ionut  20  0  0.0 11.3 999h59:59 git branch feature/tmp-fix",
        " 5150 ionut  20  0  1.1  0.4   0:15.30 standup.sh --recall",
        " 6006 ionut  20  0  0.3 33.7 901h44:12 tech_debt --accrue",
    ].join("\n");
}

/**
 * Toggles the CRT look on the terminal box. Returns the line the caller should
 * print, rather than printing anything itself.
 */
export function toggleCrt(): string {
    const terminal = document.querySelector(TERMINAL_SELECTOR);

    if (!terminal) {
        return "No terminal element to degrade. The effect stays off.";
    }

    ensureStyles();

    const enabled = terminal.classList.toggle(CRT_CLASS);

    return enabled
        ? "CRT mode on. Scanlines added, resolution unaffected."
        : "CRT mode off. Back to a display made this century.";
}

/**
 * Falling glyphs over the terminal box. Runs for eight seconds, or until the
 * first keypress or click, and then removes itself completely: canvas, frame
 * request, timer and every listener it registered.
 */
export function runMatrix(): string {
    const terminal = document.querySelector(TERMINAL_SELECTOR);

    if (!terminal) {
        return "No terminal element to rain on. Nothing was rendered.";
    }

    ensureStyles();

    // A second call restarts the effect instead of stacking a second loop on
    // top of the first one.
    stopMatrix();

    const canvas = document.createElement("canvas");
    canvas.classList.add(MATRIX_CLASS);
    const context = canvas.getContext("2d");

    if (!context) {
        return "This browser declined to give up a 2d context. Nothing was rendered.";
    }

    document.body.appendChild(canvas);

    let drops: number[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastFrame = 0;

    // The canvas is positioned against the viewport, so it has to follow the
    // terminal box on both resize and scroll.
    const syncSize = () => {
        const rect = terminal.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;

        width = rect.width;
        height = rect.height;

        canvas.style.left = `${rect.left}px`;
        canvas.style.top = `${rect.top}px`;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(height * ratio));

        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.font = `${MATRIX_FONT_SIZE}px monospace`;
        context.textBaseline = "top";

        const columns = Math.max(1, Math.floor(width / MATRIX_FONT_SIZE));
        drops = [];
        for (let i = 0; i < columns; i++) {
            drops.push(Math.floor(Math.random() * -30));
        }
    };

    const draw = (time: number) => {
        frame = window.requestAnimationFrame(draw);

        if (time - lastFrame < MATRIX_FRAME_INTERVAL) return;
        lastFrame = time;

        // The trail is the background painted back over the previous frame at
        // low alpha, which is what fades the older glyphs out.
        context.fillStyle = "rgba(26, 27, 38, 0.13)";
        context.fillRect(0, 0, width, height);

        for (let i = 0; i < drops.length; i++) {
            const glyph = MATRIX_GLYPHS.charAt(
                Math.floor(Math.random() * MATRIX_GLYPHS.length)
            );

            context.fillStyle = Math.random() > 0.82 ? "#d8fff0" : "#5af78e";
            context.fillText(glyph, i * MATRIX_FONT_SIZE, drops[i] * MATRIX_FONT_SIZE);

            if (drops[i] * MATRIX_FONT_SIZE > height && Math.random() > 0.975) {
                drops[i] = 0;
            } else {
                drops[i] += 1;
            }
        }
    };

    const end = () => stopMatrix();

    syncSize();
    frame = window.requestAnimationFrame(draw);

    const timer = setTimeout(end, MATRIX_DURATION);

    window.addEventListener("resize", syncSize);
    window.addEventListener("scroll", syncSize, true);
    window.addEventListener("keydown", end);
    window.addEventListener("click", end);

    matrixStop = () => {
        window.cancelAnimationFrame(frame);
        clearTimeout(timer);
        window.removeEventListener("resize", syncSize);
        window.removeEventListener("scroll", syncSize, true);
        window.removeEventListener("keydown", end);
        window.removeEventListener("click", end);
        canvas.remove();
    };

    return "Rain running for 8 seconds. Any key ends it. Nothing was decoded.";
}

/**
 * Idempotent: the handle is cleared before it runs, so the timeout and the
 * keydown listener firing in the same tick cannot tear the same canvas down
 * twice.
 */
function stopMatrix(): void {
    if (!matrixStop) return;

    const stop = matrixStop;
    matrixStop = null;
    stop();
}
