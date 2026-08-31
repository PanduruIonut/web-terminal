/**
 * The page behind the terminal.
 *
 * Closing the terminal window reveals this in place — same URL, no navigation,
 * so the address bar never changes and the back button is not involved. Built
 * lazily on first open and then reused, since most visitors never open it.
 *
 * Content is kept in step with public/cv.txt, which is what `curl ionut.codes`
 * returns. If you edit one, edit the other.
 */

import cvData from "../data/cv.json";

const PAGE_ID = "cv-page";
const STYLE_ID = "cv-page-style";

interface Role {
    readonly title: string;
    readonly place: string;
    readonly when: string;
    readonly detail: string;
    readonly stack: string;
}

interface Project {
    readonly name: string;
    readonly link?: string;
    readonly detail: string;
}

interface Education {
    readonly degree: string;
    readonly when: string;
    readonly place: string;
}

interface CvData {
    readonly name: string;
    readonly title: string;
    readonly location: string;
    readonly contact: { email: string; web: string; github: string; linkedin: string };
    readonly profile: string;
    readonly stack: ReadonlyArray<readonly string[]>;
    readonly roles: readonly Role[];
    readonly projects: readonly Project[];
    readonly education: readonly Education[];
    readonly certificates: readonly string[];
}

// JSON, so scripts/generate-cv-txt.mjs can read the same file without needing
// to run TypeScript. The cast gives the shape back; JSON inference alone turns
// the optional project link into an awkward union.
const cv = cvData as unknown as CvData;

const CSS = `
/*
 * Three-state theming. Bare #cv-page carries the dark palette; the media query
 * swaps it for light unless the reader has explicitly asked for dark; the
 * [data-theme] rules let the toggle win over the OS in both directions. Every
 * colour is defined on the bare selector first, so nothing is only ever set
 * inside a media query.
 */
#${PAGE_ID} {
    --cv-bg: #1a1b26;
    --cv-text: #a9b1d6;
    --cv-heading: #c0caf5;
    --cv-role: #ff9e64;
    --cv-muted: #565f89;
    --cv-section: #af91e8;
    --cv-key: #7aa2f7;
    --cv-link: #2ac3de;
    --cv-link-underline: rgba(42, 195, 222, .35);
    --cv-rule: #2a2b3d;
    --cv-chip: rgba(255, 255, 255, .04);
}

@media (prefers-color-scheme: light) {
    #${PAGE_ID}:not([data-theme="dark"]) {
        --cv-bg: #f7f7fb;
        --cv-text: #3d4059;
        --cv-heading: #191a24;
        --cv-role: #c2410c;
        --cv-muted: #6e7391;
        --cv-section: #7c3aed;
        --cv-key: #2563eb;
        --cv-link: #0e7490;
        --cv-link-underline: rgba(14, 116, 144, .35);
        --cv-rule: #e2e2ee;
        --cv-chip: rgba(0, 0, 0, .03);
    }
}

#${PAGE_ID}[data-theme="light"] {
    --cv-bg: #f7f7fb;
    --cv-text: #3d4059;
    --cv-heading: #191a24;
    --cv-role: #c2410c;
    --cv-muted: #6e7391;
    --cv-section: #7c3aed;
    --cv-key: #2563eb;
    --cv-link: #0e7490;
    --cv-link-underline: rgba(14, 116, 144, .35);
    --cv-rule: #e2e2ee;
    --cv-chip: rgba(0, 0, 0, .03);
}

#${PAGE_ID} {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    background: var(--cv-bg);
    color: var(--cv-text);
    font-size: 15px;
    line-height: 1.65;
    opacity: 0;
    transition: opacity .35s ease;
    z-index: 50;
}
#${PAGE_ID}.is-open { opacity: 1; }
#${PAGE_ID} .cv-inner { position: relative; max-width: 760px; margin: 0 auto; padding: 72px 24px 96px; }
#${PAGE_ID} h1 { color: var(--cv-heading); font-size: 30px; margin: 0; letter-spacing: -.4px; }
#${PAGE_ID} .cv-role { color: var(--cv-role); margin: 6px 0 2px; }
#${PAGE_ID} .cv-where { color: var(--cv-muted); font-size: 14px; }
#${PAGE_ID} .cv-links { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 14px; }
#${PAGE_ID} a { color: var(--cv-link); text-decoration: none; border-bottom: 1px solid var(--cv-link-underline); }
#${PAGE_ID} a:hover { border-bottom-color: var(--cv-link); }
#${PAGE_ID} h2 {
    color: var(--cv-section); font-size: 12px; font-weight: 700; letter-spacing: 1.6px;
    text-transform: uppercase; margin: 46px 0 4px;
    padding-bottom: 8px; border-bottom: 1px solid var(--cv-rule);
}
#${PAGE_ID} .cv-entry { margin-top: 24px; }
#${PAGE_ID} .cv-head { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; align-items: baseline; }
#${PAGE_ID} .cv-title { color: var(--cv-heading); font-weight: 700; }
#${PAGE_ID} .cv-at { color: var(--cv-key); }
#${PAGE_ID} .cv-when { color: var(--cv-muted); font-size: 13px; white-space: nowrap; }
#${PAGE_ID} .cv-detail { margin: 6px 0 0; }
#${PAGE_ID} .cv-stack { color: var(--cv-muted); font-size: 13px; margin-top: 6px; }
#${PAGE_ID} .cv-grid { display: grid; grid-template-columns: 116px 1fr; gap: 10px 18px; margin-top: 18px; font-size: 14px; }
#${PAGE_ID} .cv-key { color: var(--cv-key); }
#${PAGE_ID} .cv-certs { margin: 14px 0 0; padding-left: 18px; }
#${PAGE_ID} .cv-certs li { margin-bottom: 4px; }
#${PAGE_ID} .cv-back {
    margin-top: 64px; padding-top: 22px; border-top: 1px solid var(--cv-rule);
    display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
    font-size: 14px; color: var(--cv-muted);
}
#${PAGE_ID} .cv-theme {
    background: none; border: 0; padding: 0; cursor: pointer;
    font: inherit; color: var(--cv-link); border-bottom: 1px solid var(--cv-link-underline);
}
#${PAGE_ID} .cv-theme:hover { border-bottom-color: var(--cv-link); }
#${PAGE_ID} .cv-theme {
    position: absolute; top: 26px; right: 24px;
    font-size: 13px; color: var(--cv-muted);
    border: 1px solid var(--cv-rule); border-radius: 999px;
    padding: 5px 12px; background: var(--cv-chip);
}
#${PAGE_ID} .cv-theme:hover { color: var(--cv-text); border-color: var(--cv-muted); }
/*
 * The way back to the terminal, pinned to the right edge at every size. Once
 * the CV is open the terminal's own close button is gone with it, so this is
 * the only route back — a footer link would mean scrolling to find it.
 */
#${PAGE_ID} .cv-terminal-tab {
    display: flex;
    position: fixed;
    top: 50%;
    right: max(12px, env(safe-area-inset-right));
    transform: translateY(-50%);
    z-index: 60;
    align-items: center;
    gap: 7px;
    padding: 13px 16px;
    border-radius: 999px;
    border: 1px solid var(--cv-rule);
    background: var(--cv-bg);
    color: var(--cv-link);
    font: inherit;
    font-size: 15px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 6px 22px rgba(0, 0, 0, .3);
}

@media (max-width: 620px) {
    #${PAGE_ID} .cv-inner { padding: 58px 18px 72px; }
    #${PAGE_ID} .cv-grid { grid-template-columns: 1fr; gap: 2px 0; }
    #${PAGE_ID} .cv-key { margin-top: 10px; }
    #${PAGE_ID} .cv-theme { top: 14px; right: 18px; }
}
@media (prefers-reduced-motion: reduce) {
    #${PAGE_ID} { transition: none; }
}
`;

const THEME_KEY = "cv-theme";
const DARK_PREFERRED = "(prefers-color-scheme: dark)";

/** Storage throws in private mode, and a colour scheme is not worth an error. */
function storedTheme(): string | null {
    try {
        const value = localStorage.getItem(THEME_KEY);
        return value === "light" || value === "dark" ? value : null;
    } catch {
        return null;
    }
}

function rememberTheme(theme: string): void {
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch {
        /* ignore */
    }
}

/** What is actually on screen: the explicit choice, else the OS preference. */
function effectiveTheme(page: HTMLElement): "light" | "dark" {
    const chosen = page.dataset.theme;
    if (chosen === "light" || chosen === "dark") return chosen;
    return window.matchMedia(DARK_PREFERRED).matches ? "dark" : "light";
}

function paintThemeButton(page: HTMLElement): void {
    const button = page.querySelector<HTMLButtonElement>(".cv-theme");
    if (!button) return;

    // The label names where the click leads, not where you are.
    const next = effectiveTheme(page) === "dark" ? "light" : "dark";
    button.textContent = next;
    button.setAttribute("aria-label", `Switch to the ${next} theme`);
    button.title = `Switch to the ${next} theme`;
}

function applyStoredTheme(page: HTMLElement): void {
    const stored = storedTheme();
    if (stored) page.dataset.theme = stored;
    else delete page.dataset.theme;
    paintThemeButton(page);
}

function escape(value: string): string {
    const node = document.createElement("span");
    node.textContent = value;
    return node.innerHTML;
}

function build(): HTMLElement {
    const page = document.createElement("div");
    page.id = PAGE_ID;
    page.hidden = true;
    // While it is open the terminal is hidden, so this is the main landmark.
    page.setAttribute("role", "main");
    page.setAttribute("aria-label", "CV");

    page.innerHTML = `
<div class="cv-inner">
  <button type="button" class="cv-theme"></button>
  <button type="button" class="cv-terminal-tab" aria-label="Open the terminal">&gt;_</button>
  <header>
    <h1>${escape(cv.name)}</h1>
    <div class="cv-role">${escape(cv.title)}</div>
    <div class="cv-where">${escape(cv.location)}</div>
    <div class="cv-links">
      <a href="mailto:${escape(cv.contact.email)}">${escape(cv.contact.email)}</a>
      <a href="https://${escape(cv.contact.github)}" target="_blank" rel="noopener">${escape(cv.contact.github)}</a>
      <a href="https://www.${escape(cv.contact.linkedin)}/" target="_blank" rel="noopener">${escape(cv.contact.linkedin)}</a>
    </div>
  </header>

  <h2>Profile</h2>
  <p class="cv-detail">${escape(cv.profile)}</p>

  <h2>Stack</h2>
  <div class="cv-grid">
    ${cv.stack.map(([k, v]) => `<div class="cv-key">${escape(k)}</div><div>${escape(v)}</div>`).join("")}
  </div>

  <h2>Experience</h2>
  ${cv.roles.map((r) => `
    <div class="cv-entry">
      <div class="cv-head">
        <div><span class="cv-title">${escape(r.title)}</span> <span class="cv-at">${escape(r.place)}</span></div>
        <div class="cv-when">${escape(r.when)}</div>
      </div>
      <p class="cv-detail">${escape(r.detail)}</p>
      <div class="cv-stack">${escape(r.stack)}</div>
    </div>`).join("")}

  <h2>Projects</h2>
  ${cv.projects.map((p) => `
    <div class="cv-entry">
      <div class="cv-head">
        <div class="cv-title">${escape(p.name)}</div>
        ${p.link ? `<div class="cv-when"><a href="${escape(p.link)}" target="_blank" rel="noopener">${escape(p.link.replace("https://", ""))}</a></div>` : ""}
      </div>
      <p class="cv-detail">${escape(p.detail)}</p>
    </div>`).join("")}

  <h2>Education</h2>
  ${cv.education.map((e) => `
    <div class="cv-entry">
      <div class="cv-head">
        <div><span class="cv-title">${escape(e.degree)}</span></div>
        <div class="cv-when">${escape(e.when)}</div>
      </div>
      <div class="cv-stack">${escape(e.place)}</div>
    </div>`).join("")}

  <h2>Certificates</h2>
  <ul class="cv-certs">
    ${cv.certificates.map((c) => `<li>${escape(c)}</li>`).join("")}
  </ul>

  <div class="cv-back">
    <span>Also available as plain text: <a href="/cv.txt">curl ionut.codes</a></span>
  </div>
</div>`;

    const terminalTab = page.querySelector(".cv-terminal-tab");
    terminalTab?.addEventListener("click", () => closeCv());

    const themeButton = page.querySelector(".cv-theme");
    themeButton?.addEventListener("click", () => {
        const next = effectiveTheme(page) === "dark" ? "light" : "dark";
        page.dataset.theme = next;
        rememberTheme(next);
        paintThemeButton(page);
    });

    // Follow the OS while no explicit choice has been made.
    window.matchMedia(DARK_PREFERRED).addEventListener("change", () => {
        if (!storedTheme()) paintThemeButton(page);
    });

    applyStoredTheme(page);

    return page;
}

function ensureStyles(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

/** The terminal, its hint line, and anything else the layout put on screen. */
function terminalShell(): HTMLElement | null {
    return document.querySelector("main");
}

export function openCv(): void {
    ensureStyles();

    let page = document.getElementById(PAGE_ID);
    if (!page) {
        page = build();
        document.body.appendChild(page);
    }

    const shell = terminalShell();
    if (shell) shell.hidden = true;

    page.hidden = false;
    // Force a reflow so the transition has a start value to animate from.
    // requestAnimationFrame would do the same, except it never fires in a
    // backgrounded tab, which would leave the page stuck at opacity 0.
    void page.offsetWidth;
    page.classList.add("is-open");
    page.scrollTop = 0;
}

/**
 * Touch devices get no autofocus: focusing the input pops the soft keyboard
 * over half the screen the instant the terminal reappears. Tapping the terminal
 * still focuses it, which is the deliberate act that should raise the keyboard.
 */
const RAISES_SOFT_KEYBOARD = "(pointer: coarse)";

export function closeCv(): void {
    const page = document.getElementById(PAGE_ID);
    const shell = terminalShell();

    if (shell) shell.hidden = false;
    if (!page) return;

    page.classList.remove("is-open");
    window.setTimeout(() => {
        page.hidden = true;
    }, 350);

    if (!window.matchMedia(RAISES_SOFT_KEYBOARD).matches) {
        document.querySelector<HTMLInputElement>(".terminal__input")?.focus();
    }
}
