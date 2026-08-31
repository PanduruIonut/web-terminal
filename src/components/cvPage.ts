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

const ROLES: Role[] = [
    {
        title: "Software Engineer",
        place: "Betfair",
        when: "04/2024 — present",
        detail: "Multi-game compatibility layer standardising workflows across 64 slot and roulette games. Owns 7 microservices end to end, supports external game studios onboarding titles, and debugs production issues across Kubernetes. On-call with Grafana and Prometheus.",
        stack: "React · Node.js · Java Spring Boot · NestJS · gRPC · Cassandra · Kafka · Docker · AWS · ArgoCD · Kubernetes",
    },
    {
        title: "Full Stack Developer",
        place: "Thiele & Close",
        when: "09/2022 — 04/2024",
        detail: "Backend for news content, subscriptions and regional preferences across multiple sites. Article recommendations and dynamic feeds, SSO, chatbot integration.",
        stack: "Vue.js · Node.js · GraphQL · Solr · TypeScript · Cypress · Jest",
    },
    {
        title: "Full Stack Developer",
        place: "Evo Primes / Plutus Inc.",
        when: "01/2022 — 09/2022",
        detail: "Main developer on a Laravel backend powering the Aureus POS system: orders, purchases, inventory and gold transactions. eBay marketplace API integration, MySQL query optimisation and full-page caching.",
        stack: "PHP · Laravel · Vue.js · Docker · MySQL",
    },
    {
        title: "Full Stack Developer",
        place: "Graffino",
        when: "09/2020 — 01/2022",
        detail: "Primary full-stack developer across several projects: a task management app, a parcel distribution system for international warehouses, and factory worker scheduling.",
        stack: "PHP · Laravel · Vue.js · TypeScript · MySQL · Docker · Nginx",
    },
    {
        title: "Full Stack Developer",
        place: "EdelCode",
        when: "03/2020 — 08/2020",
        detail: "Company management app and a sports meetup platform, with unit and integration tests.",
        stack: "React.js · TypeScript · NestJS · TypeORM · GraphQL · RxJS",
    },
    {
        title: "Android Developer",
        place: "KeepCalling",
        when: "09/2018 — 03/2020",
        detail: "Features, UI and performance work across multiple Android apps.",
        stack: "Java · Android SDK · Dagger · RxJava · Firebase · ButterKnife",
    },
];

const PROJECTS: Project[] = [
    {
        name: "Moto-Tracker",
        detail: "IoT motorcycle tracking. Custom ESP32/ESPHome firmware, Node.js and Express, PostgreSQL, MQTT, OSRM road-matching, and a MapLibre GL PWA. Live GPS, trip history, crash and theft detection, geofencing, and a BLE anti-theft key fob with HMAC-SHA256 rolling-code auth. Self-hosted on a Raspberry Pi.",
    },
    {
        name: "Stiu.ai",
        link: "https://stiu.ai",
        detail: "News intelligence platform. Scrapes, deduplicates and AI-enriches Romanian news, roughly 96,000 articles from 6 major sources. Laravel REST API, Python and FastAPI scraping microservice, AWS Lambda trust scoring, Qdrant vector search, React SPA.",
    },
    {
        name: "Us",
        detail: "Real-time app for couples, native on both platforms: SwiftUI on iOS, Kotlin and Jetpack Compose on Android, Supabase with row-level security and realtime channels.",
    },
    {
        name: "Wedding-Share",
        detail: "Guest photo sharing with QR pairing and multithreaded uploads.",
    },
    {
        name: "Synctify",
        detail: "Spotify liked-songs sync with previews. Laravel and Nuxt.",
    },
    {
        name: "FC Skill Trainer",
        detail: "iOS and Android trainer for EA Sports FC skill moves, via touchscreen or a paired DualSense or Xbox controller.",
    },
];

const STACK: ReadonlyArray<readonly [string, string]> = [
    ["Front-end", "React, Vue.js (Vuex, Element UI, BootstrapVue), TypeScript, HTML, CSS, JavaScript"],
    ["Back-end", "Node.js, NestJS, PHP (Laravel), Java (Spring Boot), GraphQL, gRPC"],
    ["Data", "PostgreSQL, MySQL, Cassandra, Redis, Solr, Qdrant, Kafka"],
    ["DevOps", "Docker, Kubernetes, ArgoCD, GitHub Actions, Nginx, AWS (EC2, ECR, S3, SQS, Lambda, SES, IAM)"],
    ["Testing", "Jest, Vitest, Cypress"],
    ["Mobile", "Android (Java, RxJava, Dagger, Firebase)"],
];

const CSS = `
#${PAGE_ID} {
    position: fixed;
    inset: 0;
    overflow-y: auto;
    background: #1a1b26;
    color: #a9b1d6;
    font-size: 15px;
    line-height: 1.65;
    opacity: 0;
    transition: opacity .35s ease;
    z-index: 50;
}
#${PAGE_ID}.is-open { opacity: 1; }
#${PAGE_ID} .cv-inner { max-width: 760px; margin: 0 auto; padding: 72px 24px 96px; }
#${PAGE_ID} h1 { color: #c0caf5; font-size: 30px; margin: 0; letter-spacing: -.4px; }
#${PAGE_ID} .cv-role { color: #ff9e64; margin: 6px 0 2px; }
#${PAGE_ID} .cv-where { color: #565f89; font-size: 14px; }
#${PAGE_ID} .cv-links { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 14px; }
#${PAGE_ID} a { color: #2ac3de; text-decoration: none; border-bottom: 1px solid rgba(42,195,222,.35); }
#${PAGE_ID} a:hover { border-bottom-color: #2ac3de; }
#${PAGE_ID} h2 {
    color: #af91e8; font-size: 12px; font-weight: 700; letter-spacing: 1.6px;
    text-transform: uppercase; margin: 46px 0 4px;
    padding-bottom: 8px; border-bottom: 1px solid #2a2b3d;
}
#${PAGE_ID} .cv-entry { margin-top: 24px; }
#${PAGE_ID} .cv-head { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; align-items: baseline; }
#${PAGE_ID} .cv-title { color: #c0caf5; font-weight: 700; }
#${PAGE_ID} .cv-at { color: #7aa2f7; }
#${PAGE_ID} .cv-when { color: #565f89; font-size: 13px; white-space: nowrap; }
#${PAGE_ID} .cv-detail { margin: 6px 0 0; }
#${PAGE_ID} .cv-stack { color: #565f89; font-size: 13px; margin-top: 6px; }
#${PAGE_ID} .cv-grid { display: grid; grid-template-columns: 116px 1fr; gap: 10px 18px; margin-top: 18px; font-size: 14px; }
#${PAGE_ID} .cv-key { color: #7aa2f7; }
#${PAGE_ID} .cv-certs { margin: 14px 0 0; padding-left: 18px; }
#${PAGE_ID} .cv-certs li { margin-bottom: 4px; }
#${PAGE_ID} .cv-back {
    margin-top: 64px; padding-top: 22px; border-top: 1px solid #2a2b3d;
    display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
    font-size: 14px; color: #565f89;
}
#${PAGE_ID} .cv-reopen { background: none; border: 0; padding: 0; cursor: pointer;
    font: inherit; color: #2ac3de; border-bottom: 1px solid rgba(42,195,222,.35); }
#${PAGE_ID} .cv-reopen:hover { border-bottom-color: #2ac3de; }
@media (max-width: 620px) {
    #${PAGE_ID} .cv-inner { padding: 48px 18px 72px; }
    #${PAGE_ID} .cv-grid { grid-template-columns: 1fr; gap: 2px 0; }
    #${PAGE_ID} .cv-key { margin-top: 10px; }
}
@media (prefers-reduced-motion: reduce) {
    #${PAGE_ID} { transition: none; }
}
`;

function escape(value: string): string {
    const node = document.createElement("span");
    node.textContent = value;
    return node.innerHTML;
}

function build(): HTMLElement {
    const page = document.createElement("div");
    page.id = PAGE_ID;
    page.hidden = true;

    page.innerHTML = `
<div class="cv-inner">
  <header>
    <h1>Panduru Ionut</h1>
    <div class="cv-role">Full Stack Developer</div>
    <div class="cv-where">Sibiu, Romania</div>
    <div class="cv-links">
      <a href="mailto:panduru.ionut@hotmail.com">panduru.ionut@hotmail.com</a>
      <a href="https://github.com/PanduruIonut" target="_blank" rel="noopener">github.com/PanduruIonut</a>
      <a href="https://www.linkedin.com/in/ionut-panduru/" target="_blank" rel="noopener">linkedin.com/in/ionut-panduru</a>
    </div>
  </header>

  <h2>Profile</h2>
  <p class="cv-detail">Full-stack developer based in Sibiu. Involved in every step from planning
  and design through to solving real problems in code. Rides a motorbike when not at a keyboard.</p>

  <h2>Stack</h2>
  <div class="cv-grid">
    ${STACK.map(([k, v]) => `<div class="cv-key">${escape(k)}</div><div>${escape(v)}</div>`).join("")}
  </div>

  <h2>Experience</h2>
  ${ROLES.map((r) => `
    <div class="cv-entry">
      <div class="cv-head">
        <div><span class="cv-title">${escape(r.title)}</span> <span class="cv-at">${escape(r.place)}</span></div>
        <div class="cv-when">${escape(r.when)}</div>
      </div>
      <p class="cv-detail">${escape(r.detail)}</p>
      <div class="cv-stack">${escape(r.stack)}</div>
    </div>`).join("")}

  <h2>Projects</h2>
  ${PROJECTS.map((p) => `
    <div class="cv-entry">
      <div class="cv-head">
        <div class="cv-title">${escape(p.name)}</div>
        ${p.link ? `<div class="cv-when"><a href="${escape(p.link)}" target="_blank" rel="noopener">${escape(p.link.replace("https://", ""))}</a></div>` : ""}
      </div>
      <p class="cv-detail">${escape(p.detail)}</p>
    </div>`).join("")}

  <h2>Education</h2>
  <div class="cv-entry">
    <div class="cv-head">
      <div><span class="cv-title">M.Sc. Advanced Informatics Systems</span></div>
      <div class="cv-when">2018 — 2020</div>
    </div>
    <div class="cv-stack">Lucian Blaga University of Sibiu</div>
  </div>
  <div class="cv-entry">
    <div class="cv-head">
      <div><span class="cv-title">B.Sc. Computer Science</span></div>
      <div class="cv-when">graduated 2018</div>
    </div>
    <div class="cv-stack">Lucian Blaga University of Sibiu</div>
  </div>

  <h2>Certificates</h2>
  <ul class="cv-certs">
    <li>AWS Cloud Practitioner Essentials</li>
    <li>Developing on AWS</li>
    <li>AWS Cost Optimization</li>
    <li>CompTIA Pentest+ learning path, TryHackMe</li>
    <li>Security Engineer learning path, TryHackMe</li>
  </ul>

  <div class="cv-back">
    <span>Also available as plain text: <a href="/cv.txt">curl ionut.codes</a></span>
    <button type="button" class="cv-reopen">reopen the terminal</button>
  </div>
</div>`;

    const reopen = page.querySelector(".cv-reopen");
    reopen?.addEventListener("click", () => closeCv());

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
