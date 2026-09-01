/**
 * Window controls for the terminal: drag it by the title bar, collapse it to
 * that bar, blow it up to nearly the whole viewport. The red light is already
 * wired in terminal.ts and is deliberately left alone here.
 *
 * Two facts about the existing markup shape most of what follows.
 *
 * 1. `.terminal__buttons` is `position: fixed`. It only renders inside the
 *    title bar because `.terminal` carries a transform and is therefore its
 *    containing block; the moment that transform resolves to `none` the three
 *    lights fly to the corner of the viewport. So nothing here ever writes
 *    `transform` on `.terminal` — the drag offset goes through the individual
 *    `translate` property, which composes into the same matrix.
 * 2. terminal.ts owns `.terminal`'s inline transform for the load nudge
 *    (`translateY(10px)`, then `translateY(0)` a second later). Using
 *    `translate` means a drag started inside that first second is not wiped
 *    when the nudge lands, and the two never write the same property.
 *
 * Every style the module needs is injected once into document.head, guarded by
 * an id, so no stylesheet has to know this exists.
 */

const STYLE_ID = "window-controls-style";

/** dataset key, so a second init() call is a no-op instead of double listeners. */
const READY_KEY = "windowControls";

const DRAGGING_CLASS = "window-is-dragging"; // on <body>, for the cursor
const MAXIMIZED_CLASS = "window-maximized"; // the rest on .terminal
const MINIMIZED_CLASS = "window-minimized";
const RESIZING_CLASS = "window-resizing";

/**
 * Movement that still counts as a click. Below this the press is a click on the
 * title bar — which matters, because that click is what restores a collapsed
 * window — and above it the window starts moving.
 */
const DRAG_THRESHOLD_PX = 4;

/**
 * A click or double-click landing this soon after a drag ends is the tail of
 * that drag, not a new intent, and is ignored.
 */
const CLICK_GRACE_MS = 400;

/** Breathing room left around a maximised window, so it still reads as one. */
const EDGE_GAP_PX = 12;

/**
 * How much of the window has to stay inside the viewport horizontally. The
 * title bar spans the window's full width, so keeping this much of the width on
 * screen keeps that much of the bar grabbable.
 */
const MIN_VISIBLE_PX = 120;

/** Shared by the CSS below and by the code that has to wait for it to finish. */
const SIZE_TRANSITION_MS = 180;

/** Floor for a maximised window on a very small or very short viewport. */
const MIN_SIZE_PX = 160;

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Injected lazily and once. Everything that has to beat a rule from the
 * component's own <style> is written with two or three classes rather than
 * `!important`: that block lives in the <body>, so it comes later in document
 * order and wins every specificity tie.
 */
function ensureStyles(): void {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        /* The one rule this module cannot live without. .terminal__buttons is
           position: fixed and only stays in the title bar while .terminal is a
           containing block for it, which needs a transform other than none.
           terminal.ts sets one inline, but not before DOMContentLoaded has run
           and not if that handler ever changes; this makes it unconditional.
           It is composited-only, so it moves nothing. */
        .terminal {
            transform: translateZ(0);
        }

        .terminal__title-container {
            cursor: grab;
            /* Without this the browser claims the gesture as a scroll on touch
               and the pointer stream dies halfway through the drag. */
            touch-action: none;
            /* Window chrome: selecting the hostname is never the intent, and a
               stray selection under a drag looks broken. */
            user-select: none;
            -webkit-user-select: none;
        }

        /* Two of the three lights do something now, so they get the affordance
           the close button already had. */
        .terminal__buttons .hide-button,
        .terminal__buttons .resize-button {
            cursor: pointer;
        }

        /* The cursor has to follow the pointer rather than whatever is under
           it: during a fast drag the pointer outruns the title bar constantly.
           Text selection is killed page-wide for the same reason. */
        .${DRAGGING_CLASS},
        .${DRAGGING_CLASS} * {
            cursor: grabbing !important;
            user-select: none !important;
            -webkit-user-select: none !important;
        }

        /* Adding size to the transition means restating the shorthand, so the
           component's box-shadow and opacity transitions are repeated here. */
        .terminal .terminal__content {
            transition: width ${SIZE_TRANSITION_MS}ms ease,
                height ${SIZE_TRANSITION_MS}ms ease,
                box-shadow 0.25s ease,
                opacity 0.25s ease;
        }

        /* The component's own reduced-motion rule is a single class and would
           now lose to the line above, so it has to be restated at this weight
           or the opt-out silently stops working. */
        @media (prefers-reduced-motion: reduce) {
            .terminal .terminal__content {
                transition: none;
            }
        }

        /* A window sized to the viewport should track the viewport, not trail
           a transition behind every resize event. */
        .terminal.${RESIZING_CLASS} .terminal__content {
            transition: none;
        }

        /* Pixels from JS rather than vw/vh: documentElement.clientWidth
           excludes a scrollbar where vw does not, and the height has to give
           back whatever else shares the centred column (the hints line) or
           maximising scrolls the page. The fallbacks only ever apply if the
           custom properties have not been written yet. */
        .terminal.${MAXIMIZED_CLASS} .terminal__content {
            width: var(--window-max-width, 90vw);
            height: var(--window-max-height, 70vh);
        }

        /* Collapsed to the bar. Height rather than display: none, because the
           content box is what gives the window its width — hiding it outright
           would shrink the bar to the width of the hostname, and would drop the
           clamp() that restore depends on. !important on the shadow only:
           themes.ts sets that one with !important of its own, and a 0px-high
           box still paints its blur. */
        .terminal.${MINIMIZED_CLASS} .terminal__content {
            height: 0;
            overflow: hidden;
            box-shadow: none !important;
        }

        .terminal.${MINIMIZED_CLASS} .terminal__title-container {
            border-bottom-left-radius: 7px;
            border-bottom-right-radius: 7px;
            box-shadow: rgba(0, 0, 0, 0.35) 0px 5px 15px;
        }
    `;

    document.head.appendChild(style);
}

/** Presses on the traffic lights are clicks on buttons, never grabs. */
function isTrafficLight(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(".terminal__buttons") !== null;
}

export function initWindowControls(terminal: HTMLElement): void {
    // Idempotent: a second call would otherwise register a second set of
    // listeners and every toggle would fire twice, cancelling itself out.
    if (terminal.dataset[READY_KEY]) return;

    const titleBar = terminal.querySelector<HTMLElement>(".terminal__title-container");
    // The size toggles are meaningless without the content box, and its clamp()
    // is what restore leans on, so bail rather than half-wire the window.
    const content = terminal.querySelector<HTMLElement>(".terminal__content");
    if (!titleBar || !content) return;

    const input = terminal.querySelector<HTMLInputElement>(".terminal__input");
    const minimizeButton = terminal.querySelector<HTMLElement>(".hide-button");
    const maximizeButton = terminal.querySelector<HTMLElement>(".resize-button");

    terminal.dataset[READY_KEY] = "true";
    ensureStyles();

    // Where the window sits relative to the position the page's flex centring
    // gives it. Applied as `translate`, never as `transform`.
    let offsetX = 0;
    let offsetY = 0;

    // The drop position at the moment of maximising, handed back untouched
    // when the window comes back down.
    let restoreX = 0;
    let restoreY = 0;

    let maximized = false;
    let minimized = false;

    let activePointer: number | null = null;
    let dragging = false;
    let pressX = 0;
    let pressY = 0;
    let pressOffsetX = 0;
    let pressOffsetY = 0;

    let dragEndedAt = 0;
    let restoredAt = 0;
    let settleTimer = 0;
    let resizeSettleTimer = 0;

    const justDragged = (): boolean => Date.now() - dragEndedAt < CLICK_GRACE_MS;
    const justRestored = (): boolean => Date.now() - restoredAt < CLICK_GRACE_MS;

    /**
     * Focus goes back to the input after anything the user meant as "I am using
     * this window". Without it a drag or a toggle can leave `.terminal` outside
     * :focus-within, which dims the content and sends the next keystroke
     * nowhere.
     */
    const focusInput = (): void => {
        input?.focus({ preventScroll: true });
    };

    const applyOffset = (x: number, y: number): void => {
        offsetX = x;
        offsetY = y;
        terminal.style.translate = `${x}px ${y}px`;
    };

    /**
     * The off-screen rule: the title bar is the only handle this window has, so
     * it always has to be reachable. Vertically the whole bar stays inside the
     * viewport; horizontally at least MIN_VISIBLE_PX of the window's width —
     * and therefore of the bar — stays inside it.
     */
    const clampToViewport = (x: number, y: number): { x: number; y: number } => {
        const rect = terminal.getBoundingClientRect();
        // The rect already carries the offset in force, so take it back out to
        // get the resting position the page's own centring would give.
        const restingLeft = rect.left - offsetX;
        const restingTop = rect.top - offsetY;
        const barHeight = titleBar.getBoundingClientRect().height;
        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;

        return {
            x: clamp(
                x,
                MIN_VISIBLE_PX - rect.width - restingLeft,
                viewportWidth - MIN_VISIBLE_PX - restingLeft
            ),
            y: clamp(y, -restingTop, viewportHeight - barHeight - restingTop),
        };
    };

    const keepInView = (): void => {
        const next = clampToViewport(offsetX, offsetY);
        if (next.x !== offsetX || next.y !== offsetY) applyOffset(next.x, next.y);
    };

    /**
     * The content box animates for SIZE_TRANSITION_MS, and anything measured
     * before it settles describes the box on its way out rather than the one
     * the window ends up with — so a size change checks its bounds afterwards.
     */
    const keepInViewWhenSettled = (): void => {
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(keepInView, SIZE_TRANSITION_MS + 20);
    };

    /**
     * Whatever else shares the centred column with the window — the hints line
     * lives directly under it — has to keep its height, or a window sized to
     * the full viewport pushes the page into a scrollbar. Measured rather than
     * guessed, so it stays right if the hints ever change.
     */
    const columnExtra = (): number => {
        const column = terminal.closest(".content-container");
        if (!column) return 0;
        return Math.max(
            0,
            column.getBoundingClientRect().height - terminal.getBoundingClientRect().height
        );
    };

    const applyMaximizedSize = (): void => {
        const barHeight = titleBar.getBoundingClientRect().height;
        const width = document.documentElement.clientWidth - EDGE_GAP_PX * 2;
        const height =
            document.documentElement.clientHeight -
            barHeight -
            EDGE_GAP_PX * 2 -
            columnExtra();

        terminal.style.setProperty("--window-max-width", `${Math.max(width, MIN_SIZE_PX)}px`);
        terminal.style.setProperty("--window-max-height", `${Math.max(height, MIN_SIZE_PX)}px`);
    };

    const setMaximized = (next: boolean): void => {
        if (next === maximized) return;
        maximized = next;

        if (next) {
            // A maximised window sits centred, so the drop position is parked
            // here and handed back untouched on the way down.
            restoreX = offsetX;
            restoreY = offsetY;
            applyOffset(0, 0);
            applyMaximizedSize();
            terminal.classList.add(MAXIMIZED_CLASS);
        } else {
            // No inline width or height was ever written, so dropping the class
            // is what returns the box to whatever its clamp() currently gives.
            terminal.classList.remove(MAXIMIZED_CLASS);
            applyOffset(restoreX, restoreY);
        }

        maximizeButton?.setAttribute("title", next ? "Restore" : "Maximise");
        // Exactly where it was — unless the viewport shrank meanwhile.
        keepInViewWhenSettled();
        focusInput();
    };

    const setMinimized = (next: boolean): void => {
        if (next === minimized) return;
        minimized = next;
        terminal.classList.toggle(MINIMIZED_CLASS, next);

        if (next) {
            // Keystrokes should not disappear into a window that is not there.
            input?.blur();
        } else {
            restoredAt = Date.now();
            focusInput();
        }

        minimizeButton?.setAttribute("title", next ? "Restore" : "Minimise");
        // Growing back re-centres the window around its middle, which can carry
        // the title bar off the top edge if it was dragged high.
        keepInViewWhenSettled();
    };

    minimizeButton?.setAttribute("title", "Minimise");
    maximizeButton?.setAttribute("title", "Maximise");

    /**
     * Keeps the caret in the input. A mousedown on the title bar would blur it,
     * which both dims the window and drops the next keystroke. preventDefault
     * on mousedown rather than on pointerdown: it reliably suppresses the focus
     * change and the text selection while leaving click and dblclick — which
     * the toggles below depend on — intact.
     */
    titleBar.addEventListener("mousedown", (event) => {
        if (isTrafficLight(event.target)) return;
        event.preventDefault();
    });

    titleBar.addEventListener("pointerdown", (event) => {
        // Primary button, first contact: a right-click or a second finger is
        // not a drag. Pointer Events report button 0 for touch and pen too, so
        // this is the same check for every input device.
        if (!event.isPrimary || event.button !== 0) return;
        if (isTrafficLight(event.target)) return;

        activePointer = event.pointerId;
        pressX = event.clientX;
        pressY = event.clientY;
        pressOffsetX = offsetX;
        pressOffsetY = offsetY;
        dragging = false;

        // Captured up front so the drag survives the pointer leaving the title
        // bar, which it does the instant the window starts moving.
        titleBar.setPointerCapture(event.pointerId);
    });

    titleBar.addEventListener("pointermove", (event) => {
        if (activePointer !== event.pointerId) return;

        const dx = event.clientX - pressX;
        const dy = event.clientY - pressY;

        if (!dragging) {
            if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
            // A maximised window is pinned to the viewport. Dropping the
            // pointer here also means the rest of this gesture is ignored.
            if (maximized) {
                activePointer = null;
                return;
            }
            dragging = true;
            document.body.classList.add(DRAGGING_CLASS);
        }

        const next = clampToViewport(pressOffsetX + dx, pressOffsetY + dy);
        applyOffset(next.x, next.y);
    });

    const endDrag = (event: PointerEvent): void => {
        if (activePointer !== event.pointerId) return;
        activePointer = null;
        if (titleBar.hasPointerCapture(event.pointerId)) {
            titleBar.releasePointerCapture(event.pointerId);
        }
        if (!dragging) return;

        dragging = false;
        document.body.classList.remove(DRAGGING_CLASS);
        dragEndedAt = Date.now();
        // The click handlers below sat this one out, so focus is handed back by
        // hand instead.
        focusInput();
    };

    titleBar.addEventListener("pointerup", endDrag);
    titleBar.addEventListener("pointercancel", endDrag);

    /**
     * A drag ends in a click event, and three separate handlers would act on
     * it: the focus handler terminal.ts puts on `.terminal`, the restore below,
     * and the double-click toggle. Swallowing it in the capture phase, before
     * it reaches any of them, is what keeps a drag from being indistinguishable
     * from a click.
     */
    terminal.addEventListener(
        "click",
        (event) => {
            if (!justDragged()) return;
            event.stopPropagation();
        },
        true
    );

    titleBar.addEventListener("click", (event) => {
        // The lights run their own handlers, including the close button's.
        if (isTrafficLight(event.target)) return;
        // A collapsed window has nothing else left to click, so its own bar is
        // the way back up.
        if (minimized) setMinimized(false);
    });

    titleBar.addEventListener("dblclick", (event) => {
        if (isTrafficLight(event.target)) return;
        // Either this double-click is the tail of a drag, or its first click
        // has already been spent restoring a collapsed window.
        if (justDragged() || justRestored() || minimized) return;
        setMaximized(!maximized);
    });

    minimizeButton?.addEventListener("click", (event) => {
        // Same as the close button in terminal.ts: this is the button's click,
        // not the window's, so it must not reach the focus handler on
        // `.terminal`.
        event.stopPropagation();
        setMinimized(!minimized);
    });

    maximizeButton?.addEventListener("click", (event) => {
        event.stopPropagation();
        // Nothing to resize while the window is collapsed to its bar.
        if (minimized) return;
        setMaximized(!maximized);
    });

    window.addEventListener("resize", () => {
        // Sizing tracks the viewport during a resize instead of easing after
        // it; the transition comes back once the dragging of the browser edge
        // has stopped.
        terminal.classList.add(RESIZING_CLASS);
        window.clearTimeout(resizeSettleTimer);
        resizeSettleTimer = window.setTimeout(
            () => terminal.classList.remove(RESIZING_CLASS),
            SIZE_TRANSITION_MS
        );

        if (maximized) applyMaximizedSize();
        // A viewport that shrank can leave the window — and with it the only
        // handle it has — outside the visible area.
        keepInView();
    });
}
