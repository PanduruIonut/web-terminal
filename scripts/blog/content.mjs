/**
 * Reading and checking blog posts. Shared by the build (scripts/blog/plugin.mjs),
 * the import from the writing folder (scripts/import-blog.mjs) and the tests.
 *
 * Everything that reaches content/blog/ is public twice over: this repo is open
 * source, and the site serves it. So the checks here are not style rules. They
 * are what keeps private things off the site, and they fail the build instead
 * of warning:
 *
 *   - `draft: true`, or a TODO / PHOTO: still in the text
 *   - raw HTML of any kind, which is how a <!-- note --> would ride along unseen
 *   - an image that is not a publishable copy at images/NN/ (the originals one
 *     level up carry their GPS), or one marked _PRIVATE
 *   - an image carrying metadata beyond the few harmless fields ImageIO writes,
 *     an embedded thumbnail (it can show what the pixelation covers), or a
 *     second image hidden after the first one ends, which iPhone originals do
 *
 * The Markdown is a small subset, rendered here rather than by a library. The
 * lockfile is pnpm 7's, so any new dependency rewrites it, and a gate is better
 * served by a renderer that refuses what it does not recognise than by one that
 * passes it through.
 */
import fs from "node:fs";
import path from "node:path";

export class ContentError extends Error {
    constructor(message) {
        super(message);
        this.name = "ContentError";
    }
}

/** NN-slug.md: the number orders the series, the slug becomes the URL. */
export const POST_FILE = /^(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

/**
 * `series: moto-tracker` in the front matter puts a post, and its images, under
 * /blog/moto-tracker/. A post without one sits at /blog/<slug>/. "images" is
 * taken: that is where a post without a series keeps its pictures.
 */
export const SERIES = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isSeries = (value) => typeof value === "string" && SERIES.test(value) && value !== "images";

/* ------------------------------------------------------------------ text */

export function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * What the writing folder's version of a post becomes on the site: notes in
 * <!-- comments --> are removed, and image paths lose their `../`. Each comment
 * is replaced by as many newlines as it spanned, so line numbers in any error
 * still point at the right line of the original file.
 */
export function prepareForPublish(text) {
    let notes = 0;
    const prepared = text
        .replace(/\r\n?/g, "\n")
        .replace(/<!--[\s\S]*?-->/g, (comment) => {
            notes += 1;
            return "\n".repeat((comment.match(/\n/g) ?? []).length);
        })
        .replace(/\]\(\.\.\/images\//g, "](images/");
    return { text: prepared, notes };
}

/* ----------------------------------------------------------- front matter */

function parseValue(raw) {
    const value = raw.trim();
    if (value === "true") return true;
    if (value === "false") return false;
    if (/^".*"$/.test(value)) return JSON.parse(value);
    if (/^'.*'$/.test(value)) return value.slice(1, -1).replace(/''/g, "'");
    if (/^\[.*\]$/.test(value)) {
        return value.slice(1, -1).split(",").map(parseValue).filter((item) => item !== "");
    }
    return value;
}

/** The `---` block at the top. Only `key: value` lines, which is all the posts use. */
export function splitFrontmatter(text, file) {
    const normalized = text.replace(/\r\n?/g, "\n");
    const match = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(normalized);
    if (!match) throw new ContentError(`${file}: the post must start with a --- front matter --- block`);

    const data = {};
    match[1].split("\n").forEach((line, index) => {
        if (!line.trim() || line.trim().startsWith("#")) return;
        const pair = /^([A-Za-z_][\w-]*):[ \t]*(.*)$/.exec(line);
        if (!pair) throw new ContentError(`${file}:${index + 2}: cannot read front matter line "${line}"`);
        data[pair[1]] = parseValue(pair[2]);
    });

    const lineOffset = match[0].split("\n").length - (match[0].endsWith("\n") ? 1 : 0);
    return { data, body: normalized.slice(match[0].length), lineOffset };
}

function checkMeta(data, file, preview) {
    for (const key of ["title", "description", "date"]) {
        if (typeof data[key] !== "string" || !data[key].trim()) {
            throw new ContentError(`${file}: front matter needs a "${key}"`);
        }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || Number.isNaN(Date.parse(`${data.date}T00:00:00Z`))) {
        throw new ContentError(`${file}: date "${data.date}" must be YYYY-MM-DD`);
    }
    if (typeof data.draft !== "boolean") {
        throw new ContentError(`${file}: front matter needs "draft: true" or "draft: false"`);
    }
    if (data.draft && !preview) {
        throw new ContentError(`${file}: is still "draft: true"; only finished posts are published`);
    }
    if (data.series !== undefined && !isSeries(data.series)) {
        throw new ContentError(`${file}: series "${data.series}" must be lower case with hyphens, like moto-tracker, and not "images"`);
    }
    if (data.cover !== undefined) {
        if (typeof data.cover !== "string" || !data.cover.trim()) {
            throw new ContentError(`${file}: "cover" is the path of a photo, like ../images/01/cover.jpg`);
        }
        if (typeof data.cover_alt !== "string" || !data.cover_alt.trim()) {
            throw new ContentError(`${file}: a cover needs "cover_alt": what the photo shows, for anyone who cannot see it`);
        }
    } else if (data.cover_alt !== undefined) {
        throw new ContentError(`${file}: "cover_alt" without a "cover"`);
    }
    return {
        title: data.title.trim(),
        description: data.description.trim(),
        date: data.date,
        draft: data.draft,
        series: data.series ?? null,
        // Written like a body image (../images/NN/x.jpg); resolved by parsePost through the same gate.
        cover: data.cover === undefined ? null : { src: data.cover.trim().replace(/^\.\.\//, ""), alt: data.cover_alt.trim() },
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    };
}

/* -------------------------------------------------------------- markdown */

const BLANK = /^[ \t]*$/;
const FENCE = /^```/;
const FENCE_END = /^```[ \t]*$/;
const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}>[ \t]?/;
const BULLET = /^ {0,3}[-*+][ \t]+(.*)$/;
const NUMBERED = /^ {0,3}\d{1,9}[.)][ \t]+(.*)$/;
const RAW_HTML = /^[ \t]*</;
const FIGURE = /^!\[([^\]]*)\]\(([^()\s]+)\)$/;
const LIVE = /^@\[([^\]]*)\]\(([^()\s]+)\)$/;
const SAFE_HREF = /^(?:https?:\/\/|mailto:|\/(?!\/)|#)/i;

/**
 * The only sites a post may show live, in a frame: `@[what it is](https://…)` on
 * a line of its own. A frame runs that site's code inside the post, so it is a
 * list, not a pattern, and anything off it is refused rather than linked.
 */
export const LIVE_ORIGINS = new Set(["https://mototracker.ionut.codes"]);
// What the framed page may do. Never allow-top-navigation: the page must not be
// able to send the reader's tab somewhere else.
const LIVE_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";
const HARD_BREAK = "\u0001";

function startsBlock(line) {
    return FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line)
        || BULLET.test(line) || NUMBERED.test(line) || RAW_HTML.test(line);
}

function emphasis(html) {
    return html
        .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^\w*])\*(?=[^\s*])([\s\S]*?[^\s*])\*(?![\w*])/g, "$1<em>$2</em>")
        .replace(/(^|[^\w])_(?=\S)([\s\S]*?\S)_(?!\w)/g, "$1<em>$2</em>");
}

function renderInline(text, where) {
    const slots = [];
    const hold = (html) => `\u0000${slots.push(html) - 1}\u0000`;

    let out = text.replace(/`([^`\n]+)`/g, (_, code) => hold(`<code>${escapeHtml(code)}</code>`));

    if (/!\[[^\]]*\]\(/.test(out)) {
        throw new ContentError(`${where}: an image goes on a line of its own, with only its *caption* on the lines under it`);
    }
    if (/@\[[^\]]*\]\(/.test(out)) {
        throw new ContentError(`${where}: a live page goes on a line of its own, with only its *caption* on the lines under it`);
    }

    out = out.replace(/\[([^\]\n]+)\]\(([^()\s]+)\)/g, (_, label, href) => {
        if (!SAFE_HREF.test(href)) {
            throw new ContentError(`${where}: link "${href}" must start with https://, http://, mailto:, / or #`);
        }
        const external = /^https?:/i.test(href) ? ' rel="noopener"' : "";
        return hold(`<a href="${escapeHtml(href)}"${external}>${emphasis(escapeHtml(label))}</a>`);
    });

    // Link syntax that did not match above (spaces or brackets in the URL) would
    // otherwise be shown as typed. Refused instead, so it gets fixed, not shipped.
    if (/\]\(/.test(out)) {
        throw new ContentError(`${where}: cannot read this link; write it as [text](url), with no spaces or brackets in the url`);
    }

    out = emphasis(escapeHtml(out));
    const restore = (html) => html.replace(/\u0000(\d+)\u0000/g, (_, n) => restore(slots[Number(n)]));
    return restore(out);
}

function slugify(text) {
    return text
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/[\s-]+/g, "-") || "section";
}

function countWords(text) {
    return text.replace(/[`*_[\]()!#>]/g, " ").split(/\s+/).filter(Boolean).length;
}

/**
 * Block level: ## to #### headings, paragraphs, figures, live pages from
 * LIVE_ORIGINS, - and 1. lists, > quotes, ``` code, --- rules. Inline: *em*, **strong**, `code`, [links](/x),
 * and a line ending in two spaces breaks. Anything else that looks like markup
 * is either shown as typed (escaped) or refused, never passed through.
 */
export function renderMarkdown(body, { file, lineOffset = 0, resolveImage }) {
    const lines = body.split("\n");
    const where = (index) => `${file}:${lineOffset + index + 1}`;
    const html = [];
    const figures = [];
    const ids = new Set();
    let words = 0;

    const inline = (text, index) => {
        words += countWords(text);
        return renderInline(text, where(index));
    };

    const paragraphText = (group, index) => {
        const joined = group
            .map((line, k) => (k < group.length - 1 && / {2,}$/.test(line) ? line.trim() + HARD_BREAK : line.trim()))
            .join("\n");
        return inline(joined, index).split(HARD_BREAK).join("<br>");
    };

    // The lines under an image or a live page: one *italic* run, or nothing.
    const captionOf = (captionLines, index, what) => {
        const captionText = captionLines.map((line) => line.trim()).join(" ");
        if (!captionText) return "";
        const italic = /^\*(?!\*)([\s\S]+)\*$/.exec(captionText) ?? /^_([\s\S]+)_$/.exec(captionText);
        if (!italic) {
            throw new ContentError(`${where(index + 1)}: the lines under ${what} are its caption and must be one *italic* run; found "${captionText.slice(0, 60)}"`);
        }
        return inline(italic[1], index + 1);
    };

    const live = (match, captionLines, index) => {
        const [, title, src] = match;
        if (!title.trim()) throw new ContentError(`${where(index)}: ${src} needs a title, as in @[what it is](${src})`);
        let url;
        try {
            url = new URL(src);
        } catch {
            throw new ContentError(`${where(index)}: cannot read "${src}" as an address`);
        }
        if (!LIVE_ORIGINS.has(url.origin) || url.username || url.password) {
            throw new ContentError(`${where(index)}: ${url.origin} is not on the list of sites a post may show live (LIVE_ORIGINS in scripts/blog/content.mjs)`);
        }
        const caption = captionOf(captionLines, index, "a live page");
        const href = escapeHtml(url.href);
        // The frame is lazy: a reader who never scrolls this far never loads the page.
        // Its address is printed under it as a plain link, for anyone the frame fails.
        const open = `<a class="b-live-open" href="${href}" rel="noopener">${escapeHtml(url.host)} ↗</a>`;
        return `<figure class="b-fig-wide b-live"><div class="b-live-frame"><iframe src="${href}" title="${escapeHtml(title)}" loading="lazy" sandbox="${LIVE_SANDBOX}"></iframe></div><figcaption>${caption ? `${caption} ` : ""}${open}</figcaption></figure>`;
    };

    const figure = (match, captionLines, index) => {
        const [, alt, src] = match;
        if (!alt.trim()) throw new ContentError(`${where(index)}: ${src} needs alt text, as in ![what it shows](${src})`);

        const captionHtml = captionOf(captionLines, index, "an image");
        const caption = captionHtml ? `<figcaption>${captionHtml}</figcaption>` : "";

        const image = resolveImage(src, where(index));
        figures.push({ ...image, alt });
        const lazy = figures.length > 1 ? ' loading="lazy"' : "";
        // The page lays a figure out by its shape: landscape photos can run wider than the
        // text, phone screenshots sit beside it. Anything in between stays in the column.
        const shape = image.width > image.height * 1.15 ? "wide" : image.height > image.width * 1.6 ? "tall" : "normal";
        return `<figure class="b-fig-${shape}"><img src="${escapeHtml(image.url)}" alt="${escapeHtml(alt)}" width="${image.width}" height="${image.height}" decoding="async"${lazy}>${caption}</figure>`;
    };

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        if (BLANK.test(line)) {
            i += 1;
            continue;
        }

        if (RAW_HTML.test(line)) {
            throw new ContentError(`${where(i)}: raw HTML is never published (that includes <!-- notes -->); remove it`);
        }

        if (FENCE.test(line)) {
            const start = i;
            const code = [];
            i += 1;
            while (i < lines.length && !FENCE_END.test(lines[i])) code.push(lines[i++]);
            if (i === lines.length) throw new ContentError(`${where(start)}: this code block is never closed with \`\`\``);
            i += 1;
            html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
            continue;
        }

        const heading = HEADING.exec(line);
        if (heading) {
            const level = heading[1].length;
            if (level === 1) {
                throw new ContentError(`${where(i)}: "#" is the post's title, which comes from the front matter; sections start at "##"`);
            }
            if (level > 4) throw new ContentError(`${where(i)}: headings go from ## to ####`);
            let id = slugify(heading[2]);
            for (let n = 2; ids.has(id); n += 1) id = `${slugify(heading[2])}-${n}`;
            ids.add(id);
            html.push(`<h${level} id="${id}">${inline(heading[2], i)}</h${level}>`);
            i += 1;
            continue;
        }

        if (RULE.test(line)) {
            html.push("<hr>");
            i += 1;
            continue;
        }

        if (QUOTE.test(line)) {
            const start = i;
            const quoted = [];
            while (i < lines.length && QUOTE.test(lines[i])) quoted.push(lines[i++].replace(QUOTE, ""));
            // A quote that opens with a line of only **bold** is a number callout:
            //   > **5–7 days**
            //   > That number was an estimate.
            const stat = /^\*\*([^*]+)\*\*$/.exec(quoted[0].trim());
            const paragraphs = [];
            let group = [];
            for (const text of [...(stat ? quoted.slice(1) : quoted), ""]) {
                if (BLANK.test(text)) {
                    if (group.length) paragraphs.push(`<p>${paragraphText(group, start)}</p>`);
                    group = [];
                } else {
                    group.push(text);
                }
            }
            html.push(stat
                ? `<blockquote class="b-stat"><p class="b-stat-n">${inline(stat[1], start)}</p>${paragraphs.join("")}</blockquote>`
                : `<blockquote>${paragraphs.join("")}</blockquote>`);
            continue;
        }

        if (BULLET.test(line) || NUMBERED.test(line)) {
            const marker = BULLET.test(line) ? BULLET : NUMBERED;
            const tag = marker === BULLET ? "ul" : "ol";
            const start = i;
            const items = [];
            while (i < lines.length) {
                const item = marker.exec(lines[i]);
                if (item) {
                    items.push([item[1]]);
                    i += 1;
                } else if (BLANK.test(lines[i])) {
                    // A blank line ends the list, unless another item follows it.
                    if (i + 1 < lines.length && marker.test(lines[i + 1])) i += 1;
                    else break;
                } else if (startsBlock(lines[i]) && !/^[ \t]/.test(lines[i])) {
                    break;
                } else {
                    items[items.length - 1].push(lines[i]);
                    i += 1;
                }
            }
            html.push(`<${tag}>${items.map((item) => `<li>${paragraphText(item, start)}</li>`).join("")}</${tag}>`);
            continue;
        }

        const start = i;
        const group = [line];
        i += 1;
        while (i < lines.length && !BLANK.test(lines[i]) && !startsBlock(lines[i])) group.push(lines[i++]);

        const image = FIGURE.exec(group[0].trim());
        const page = LIVE.exec(group[0].trim());
        html.push(image ? figure(image, group.slice(1), start)
            : page ? live(page, group.slice(1), start)
            : `<p>${paragraphText(group, start)}</p>`);
    }

    return { html: html.join("\n"), figures, words };
}

/* ---------------------------------------------------------------- images */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_FRAME = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/**
 * The only Exif fields allowed through, which are exactly what ImageIO writes
 * for a bare CGImage (tools/redact.swift): a pointer to the Exif IFD, and in it
 * the colour space and the pixel size. Orientation and resolution are allowed
 * too, as they say nothing about where or by whom. Everything else is refused
 * by name, so a new field is a decision rather than a leak.
 */
const EXIF_ALLOWED = {
    ifd0: new Set([0x0112, 0x011a, 0x011b, 0x0128, 0x8769]),
    exif: new Set([0xa001, 0xa002, 0xa003]),
};

const PNG_ALLOWED = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "pHYs", "bKGD"]);

function checkExif(tiff, refuse) {
    const order = tiff.toString("latin1", 0, 2);
    if (order !== "II" && order !== "MM") refuse("carries an Exif block it cannot read");
    const little = order === "II";
    const u16 = (offset) => (little ? tiff.readUInt16LE(offset) : tiff.readUInt16BE(offset));
    const u32 = (offset) => (little ? tiff.readUInt32LE(offset) : tiff.readUInt32BE(offset));

    const walk = (offset, allowed, name) => {
        const count = u16(offset);
        for (let k = 0; k < count; k += 1) {
            const entry = offset + 2 + 12 * k;
            const tag = u16(entry);
            if (tag === 0x8825) refuse("carries GPS coordinates");
            if (!allowed.has(tag)) {
                refuse(`carries Exif tag 0x${tag.toString(16).padStart(4, "0")} in ${name}, which is not one of the harmless ones`);
            }
            if (tag === 0x8769) walk(u32(entry + 8), EXIF_ALLOWED.exif, "the Exif IFD");
        }
        if (u32(offset + 2 + 12 * count) !== 0) {
            refuse("carries an embedded thumbnail, which can show what the pixelation covers");
        }
    };

    walk(u32(4), EXIF_ALLOWED.ifd0, "IFD0");
}

/** Allowed: resolution info, the IPTC digest, and an IPTC record only if it is empty. */
function checkPhotoshop(block, refuse) {
    if (block.toString("latin1", 0, 14) !== "Photoshop 3.0\0") refuse("carries an APP13 block it cannot read");
    let q = 14;
    while (q < block.length) {
        if (block.toString("latin1", q, q + 4) !== "8BIM") refuse("carries a Photoshop block it cannot read");
        const id = block.readUInt16BE(q + 4);
        const nameLength = block[q + 6];
        let r = q + 7 + nameLength;
        if ((nameLength + 1) % 2) r += 1;
        const size = block.readUInt32BE(r);
        const harmless = id === 0x0425 || id === 0x03ed || (id === 0x0404 && size === 0);
        if (!harmless) refuse(`carries Photoshop/IPTC block 0x${id.toString(16)} (${size} bytes)`);
        r += 4 + size;
        if (size % 2) r += 1;
        q = r;
    }
}

function checkJpegSegment(marker, payload, refuse) {
    const id = (length) => payload.toString("latin1", 0, length);
    if (marker === 0xfe) return refuse("carries a JPEG comment");
    if (marker < 0xe0 || marker > 0xef) return undefined;

    switch (marker) {
        case 0xe0:
            if (id(5) !== "JFIF\0") return refuse("carries an APP0 block other than JFIF (JFXX holds a thumbnail)");
            if (payload[12] !== 0 || payload[13] !== 0) return refuse("carries a JFIF thumbnail");
            return undefined;
        case 0xe1:
            if (id(6) === "Exif\0\0") return checkExif(payload.subarray(6), refuse);
            return refuse(id(29) === "http://ns.adobe.com/xap/1.0/\0" ? "carries XMP metadata" : "carries an unknown APP1 block");
        case 0xe2:
            if (id(12) === "ICC_PROFILE\0") return undefined;
            return refuse(id(4) === "MPF\0" ? "carries a second image (MPF)" : "carries an unknown APP2 block");
        case 0xed:
            return checkPhotoshop(payload, refuse);
        case 0xee:
            if (id(5) === "Adobe") return undefined;
            return refuse("carries an unknown APP14 block");
        default:
            return refuse(`carries an APP${marker - 0xe0} block, which holds metadata`);
    }
}

function inspectJpeg(buf, refuse) {
    let p = 2;
    let size = null;
    for (;;) {
        if (p + 1 >= buf.length) refuse("ends before its end-of-image marker");
        if (buf[p] !== 0xff) refuse("is not a well-formed JPEG");
        const marker = buf[p + 1];
        if (marker === 0xff) { p += 1; continue; }
        if (marker === 0xd9) { p += 2; break; }
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { p += 2; continue; }

        const length = buf.readUInt16BE(p + 2);
        const payload = buf.subarray(p + 4, p + 2 + length);
        if (payload.length !== length - 2) refuse("is truncated");
        checkJpegSegment(marker, payload, refuse);
        if (JPEG_FRAME.has(marker)) size = { height: payload.readUInt16BE(1), width: payload.readUInt16BE(3) };
        p += 2 + length;

        // Scan data runs to the next marker that is not a stuffed 0xFF00 or a
        // restart marker. Walking it means segments between progressive scans
        // are checked too, and the real end of the image is found.
        if (marker === 0xda) {
            while (p + 1 < buf.length && !(buf[p] === 0xff && buf[p + 1] !== 0x00 && !(buf[p + 1] >= 0xd0 && buf[p + 1] <= 0xd7))) p += 1;
        }
    }
    if (p !== buf.length) refuse(`has ${buf.length - p} bytes after the image ends (iPhone originals keep a second image there)`);
    if (!size) refuse("has no frame header");
    return { ...size, type: "image/jpeg" };
}

function inspectPng(buf, refuse) {
    let p = 8;
    let size = null;
    for (;;) {
        if (p + 8 > buf.length) refuse("ends before its IEND chunk");
        const length = buf.readUInt32BE(p);
        const type = buf.toString("latin1", p + 4, p + 8);
        if (!PNG_ALLOWED.has(type)) refuse(`carries a "${type}" chunk, which can hold metadata`);
        if (type === "IHDR") size = { width: buf.readUInt32BE(p + 8), height: buf.readUInt32BE(p + 12) };
        p += 12 + length;
        if (type === "IEND") break;
    }
    if (p !== buf.length) refuse(`has ${buf.length - p} bytes after the image ends`);
    if (!size) refuse("has no IHDR chunk");
    return { ...size, type: "image/png" };
}

/** Width, height and type of a publishable image, or a ContentError saying why it is not one. */
export function inspectImage(buf, label) {
    const refuse = (why) => {
        throw new ContentError(`${label} ${why}. Publish the copy tools/redact.swift makes, not the original`);
    };
    try {
        if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return inspectJpeg(buf, refuse);
        if (buf.subarray(0, 8).equals(PNG_SIGNATURE)) return inspectPng(buf, refuse);
    } catch (error) {
        if (error instanceof RangeError) refuse("is malformed");
        throw error;
    }
    return refuse("is neither a JPEG nor a PNG");
}

const IMAGE_SRC = /^images\/(\d{2})\/([a-z0-9][a-z0-9-]*)\.(jpg|jpeg|png)$/;

/**
 * Turns an image path written in a post into the URL it is served at, after
 * checking that it is a publishable copy. `root` holds the images/ folder;
 * `base` is where the post's own pages live (/blog/ or /blog/<series>/).
 * `onImage` hears about every image used, so the caller can copy or serve it.
 *
 * In `preview`, an image that does not exist yet becomes a labelled
 * placeholder: a draft names photos before they are taken. Everything else
 * (a wrong path, _PRIVATE, metadata) is refused in preview too.
 */
export function imageResolver(root, onImage, { preview = false } = {}) {
    return (src, where, base = "/blog/") => {
        if (/private/i.test(src)) throw new ContentError(`${where}: ${src} is marked _PRIVATE, and those are never published`);
        const match = IMAGE_SRC.exec(src);
        if (!match) {
            throw new ContentError(`${where}: "${src}" is not a publishable copy. Only images/NN/name.jpg is published (lower-case); the originals in images/ itself carry their GPS`);
        }
        const file = path.join(root, src);
        if (!fs.existsSync(file) && preview) {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="100%" height="100%" fill="#ff9e64" fill-opacity=".12" stroke="#ff9e64" stroke-dasharray="12 10" stroke-width="6"/><text x="50%" y="50%" fill="#ff9e64" font-family="monospace" font-size="44" text-anchor="middle">not there yet: ${escapeHtml(src)}</text></svg>`;
            return { url: `data:image/svg+xml,${encodeURIComponent(svg)}`, width: 1600, height: 900 };
        }
        if (!fs.existsSync(file)) throw new ContentError(`${where}: ${src} does not exist`);
        const body = fs.readFileSync(file);
        const info = inspectImage(body, `${where}: ${src}`);
        const expected = match[3] === "png" ? "image/png" : "image/jpeg";
        if (info.type !== expected) throw new ContentError(`${where}: ${src} is a ${info.type} with a .${match[3]} name`);
        const url = `${base}${src}`;
        onImage?.({ src, file, url, body, type: info.type });
        return { url, width: info.width, height: info.height };
    };
}

/* ----------------------------------------------------------------- posts */

const READING_SPEED = 220;

/**
 * One post, checked and rendered. `preview` lets drafts and TODOs through, for
 * the dev server's look at the writing folder; nothing built for the site
 * passes it.
 */
export function parsePost(text, { file, resolveImage, preview = false }) {
    const name = path.basename(file);
    const numbered = POST_FILE.exec(name);
    if (!numbered) throw new ContentError(`${file}: post files are named NN-slug.md, in lower case with hyphens`);
    if (/[\u0000\u0001]/.test(text)) throw new ContentError(`${file}: contains control characters`);

    text.replace(/\r\n?/g, "\n").split("\n").forEach((line, index) => {
        if (line.includes("<!--")) {
            throw new ContentError(`${file}:${index + 1}: an <!-- HTML comment --> would be published; remove it`);
        }
        const unfinished = /TODO|PHOTO:/.exec(line);
        if (unfinished && !preview) {
            throw new ContentError(`${file}:${index + 1}: "${unfinished[0]}" is still in the post; finish or remove it before publishing`);
        }
    });

    const { data, body, lineOffset } = splitFrontmatter(text, file);
    const meta = checkMeta(data, file, preview);
    const base = meta.series ? `/blog/${meta.series}/` : "/blog/";
    const cover = meta.cover && { ...resolveImage(meta.cover.src, `${file}: cover`, base), alt: meta.cover.alt };
    const rendered = renderMarkdown(body, { file, lineOffset, resolveImage: (src, where) => resolveImage(src, where, base) });
    const slug = numbered[2];

    return {
        number: Number(numbered[1]),
        slug,
        url: `${base}${slug}/`,
        ...meta,
        cover,
        dateLabel: new Date(`${meta.date}T00:00:00Z`).toLocaleDateString("en-GB", {
            day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
        }),
        minutes: Math.max(1, Math.round(rendered.words / READING_SPEED)),
        html: rendered.html,
        figures: rendered.figures,
    };
}

/**
 * Every post in a folder, in series order, with the images they use.
 * `prepare` runs each through prepareForPublish first, which is what the
 * writing folder needs and content/blog/ (already prepared) does not.
 * `series`, when given, is the series every post in the folder must name
 * (null for none): content/blog/ keeps each series in a folder of its own.
 *
 * Outside preview the first refusal throws and stops the build. In preview a
 * refused post goes into `problems` instead, so one unfinished draft does not
 * hide all the others.
 */
export function loadPosts({ postsDir, imagesRoot, preview = false, prepare = false, series }) {
    const assets = new Map();
    const problems = [];
    if (!fs.existsSync(postsDir)) return { posts: [], assets, problems };

    const resolveImage = imageResolver(imagesRoot, (image) => assets.set(image.url, { body: image.body, type: image.type }), { preview });
    const posts = [];
    for (const name of fs.readdirSync(postsDir).filter((n) => n.endsWith(".md") && n !== "README.md").sort()) {
        const file = path.join(postsDir, name);
        const shown = path.relative(process.cwd(), file) || name;
        const raw = fs.readFileSync(file, "utf8");
        const text = prepare ? prepareForPublish(raw).text : raw;
        try {
            const post = parsePost(text, { file: shown, resolveImage, preview });
            if (series !== undefined && post.series !== series) {
                throw new ContentError(`${shown}: names ${post.series ? `series "${post.series}"` : "no series"}, but sits in ${series ? `the ${series}/ folder` : "the top folder"}`);
            }
            posts.push(post);
        } catch (error) {
            if (!preview || !(error instanceof ContentError)) throw error;
            problems.push({ name, url: problemUrl(name, text), message: error.message });
        }
    }

    checkAddresses(posts, postsDir);
    return { posts: posts.sort(seriesOrder), assets, problems };
}

/**
 * content/blog/ as the site serves it. Posts in the folder itself have no
 * series; each folder in it (other than images/) is one series, laid out the
 * same way: NN-slug.md, numbered on its own, beside its own images/.
 */
export function loadPublished(dir) {
    const parts = [loadPosts({ postsDir: dir, imagesRoot: dir, series: null })];
    const folders = fs.existsSync(dir)
        ? fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name !== "images").map((entry) => entry.name).sort()
        : [];
    for (const name of folders) {
        if (!isSeries(name)) throw new ContentError(`${path.join(dir, name)}: a series folder is named in lower case with hyphens`);
        const folder = path.join(dir, name);
        parts.push(loadPosts({ postsDir: folder, imagesRoot: folder, series: name }));
    }
    const posts = parts.flatMap((part) => part.posts).sort(seriesOrder);
    checkAddresses(posts, dir);
    return { posts, assets: new Map(parts.flatMap((part) => [...part.assets])), problems: [] };
}

const seriesOrder = (a, b) => (a.series ?? "").localeCompare(b.series ?? "") || a.number - b.number;

/** Two posts at one address, two with one number in a series, or a post sitting where a series' own page goes. */
function checkAddresses(posts, where) {
    const numbers = new Set();
    const urls = new Set();
    const seriesPages = new Set(posts.filter((post) => post.series).map((post) => `/blog/${post.series}/`));
    for (const post of posts) {
        const number = `${post.series ?? ""}#${post.number}`;
        if (numbers.has(number)) {
            throw new ContentError(`${where}: two posts${post.series ? ` in ${post.series}` : ""} share the number ${String(post.number).padStart(2, "0")}`);
        }
        if (urls.has(post.url)) throw new ContentError(`${where}: two posts share the address ${post.url}`);
        if (seriesPages.has(post.url)) throw new ContentError(`${where}: ${post.url} is both a post and the page of the ${post.slug} series`);
        numbers.add(number);
        urls.add(post.url);
    }
}

/** In preview, where a refused draft's page goes: its address, as far as the file name and front matter tell. */
function problemUrl(name, text) {
    const slug = POST_FILE.exec(name)?.[2];
    if (!slug) return null;
    let series = null;
    try {
        series = splitFrontmatter(text, name).data.series;
    } catch {
        // The draft's own error is already being reported; it just goes to /blog/<slug>/.
    }
    return isSeries(series) ? `/blog/${series}/${slug}/` : `/blog/${slug}/`;
}
