/**
 * The blog's gate. Run with `pnpm test:blog`.
 *
 * Most of these assert a refusal, and a refusal test only means something if
 * the clean case next to it passes: each group starts from one that does.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { ContentError, imageResolver, inspectImage, loadPosts, loadPublished, parsePost, prepareForPublish, renderMarkdown } from "./content.mjs";
import { buildSite } from "./site.mjs";

/* ------------------------------------------------------- image fixtures */

const segment = (marker, payload) => {
    const head = Buffer.from([0xff, marker, 0, 0]);
    head.writeUInt16BE(payload.length + 2, 2);
    return Buffer.concat([head, payload]);
};
const latin1 = (text) => Buffer.from(text, "latin1");

const jfif = (thumbnail = 0) => Buffer.concat([
    latin1("JFIF\0"), Buffer.from([1, 1, 0, 0, 72, 0, 72, thumbnail, thumbnail]), Buffer.alloc(thumbnail * thumbnail * 3),
]);

/** A big-endian Exif block: IFD0 tags, then an Exif IFD reached through 0x8769. */
function exif({ ifd0 = [], exifIfd = [0xa001, 0xa002, 0xa003], thumbnail = false } = {}) {
    const first = exifIfd.length ? [...ifd0, 0x8769] : ifd0;
    const firstSize = 2 + 12 * first.length + 4;
    const exifAt = 8 + firstSize;
    const tiff = Buffer.alloc(exifAt + (exifIfd.length ? 2 + 12 * exifIfd.length + 4 : 0));
    tiff.write("MM", 0, "latin1");
    tiff.writeUInt16BE(42, 2);
    tiff.writeUInt32BE(8, 4);
    const ifd = (at, tags) => {
        tiff.writeUInt16BE(tags.length, at);
        tags.forEach((tag, k) => {
            const entry = at + 2 + 12 * k;
            tiff.writeUInt16BE(tag, entry);
            tiff.writeUInt16BE(4, entry + 2);
            tiff.writeUInt32BE(1, entry + 4);
            tiff.writeUInt32BE(tag === 0x8769 ? exifAt : 1, entry + 8);
        });
        return at + 2 + 12 * tags.length;
    };
    tiff.writeUInt32BE(thumbnail ? 8 : 0, ifd(8, first));
    if (exifIfd.length) tiff.writeUInt32BE(0, ifd(exifAt, exifIfd));
    return Buffer.concat([latin1("Exif\0\0"), tiff]);
}

/** What ImageIO writes: an empty IPTC record and its digest. */
function photoshop(blocks = [[0x0404, 0], [0x0425, 16]]) {
    const parts = [latin1("Photoshop 3.0\0")];
    for (const [id, size] of blocks) {
        const head = Buffer.alloc(12);
        head.write("8BIM", 0, "latin1");
        head.writeUInt16BE(id, 4);
        head.writeUInt32BE(size, 8);
        parts.push(head, Buffer.alloc(size + (size % 2)));
    }
    return Buffer.concat(parts);
}

/** Shaped like a tools/redact.swift copy: JFIF, the bare Exif, the empty Photoshop block. */
function jpeg({ segments = [segment(0xe0, jfif()), segment(0xe1, exif()), segment(0xed, photoshop())], after = Buffer.alloc(0) } = {}) {
    const frame = Buffer.from([8, 0x05, 0xdc, 0x07, 0xd0, 1, 1, 0x11, 0]); // 1500 high, 2000 wide
    return Buffer.concat([
        Buffer.from([0xff, 0xd8]),
        ...segments,
        segment(0xc0, frame),
        segment(0xda, Buffer.from([1, 1, 0, 0, 63, 0])),
        Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd0, 0x78]),
        Buffer.from([0xff, 0xd9]),
        after,
    ]);
}

const chunk = (type, data = Buffer.alloc(0)) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, latin1(type), data, Buffer.alloc(4)]);
};
function png(extra = []) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(640, 0);
    header.writeUInt32BE(480, 4);
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", header), ...extra, chunk("IDAT", Buffer.from([1, 2, 3])), chunk("IEND"),
    ]);
}

const refuses = (fn, pattern) => assert.throws(fn, (error) => error instanceof ContentError && pattern.test(error.message));

/* ------------------------------------------------------------- images */

test("a redact.swift-shaped JPEG passes and reports its size", () => {
    assert.deepEqual(inspectImage(jpeg(), "a.jpg"), { width: 2000, height: 1500, type: "image/jpeg" });
});

test("JPEG: GPS is refused", () => {
    refuses(() => inspectImage(jpeg({ segments: [segment(0xe1, exif({ ifd0: [0x8825] }))] }), "a.jpg"), /GPS/);
});

test("JPEG: any Exif tag off the list is refused (camera make)", () => {
    refuses(() => inspectImage(jpeg({ segments: [segment(0xe1, exif({ ifd0: [0x010f] }))] }), "a.jpg"), /0x010f/);
});

test("JPEG: an off-list tag inside the Exif IFD is refused (date taken)", () => {
    refuses(() => inspectImage(jpeg({ segments: [segment(0xe1, exif({ exifIfd: [0xa001, 0x9003] }))] }), "a.jpg"), /0x9003/);
});

test("JPEG: an Exif thumbnail is refused", () => {
    refuses(() => inspectImage(jpeg({ segments: [segment(0xe1, exif({ thumbnail: true }))] }), "a.jpg"), /thumbnail/);
});

test("JPEG: a JFIF thumbnail is refused", () => {
    refuses(() => inspectImage(jpeg({ segments: [segment(0xe0, jfif(2))] }), "a.jpg"), /thumbnail/);
});

test("JPEG: XMP is refused", () => {
    refuses(() => inspectImage(jpeg({ segments: [segment(0xe1, latin1("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>"))] }), "a.jpg"), /XMP/);
});

test("JPEG: an MPF second image is refused", () => {
    refuses(() => inspectImage(jpeg({ segments: [segment(0xe2, latin1("MPF\0MM\0*"))] }), "a.jpg"), /second image/);
});

test("JPEG: an IPTC record with content is refused", () => {
    refuses(() => inspectImage(jpeg({ segments: [segment(0xed, photoshop([[0x0404, 10]]))] }), "a.jpg"), /IPTC/);
});

test("JPEG: a comment is refused", () => {
    refuses(() => inspectImage(jpeg({ segments: [segment(0xfe, latin1("shot at home"))] }), "a.jpg"), /comment/);
});

test("JPEG: bytes after the end of the image are refused", () => {
    refuses(() => inspectImage(jpeg({ after: Buffer.from([0xff, 0xd8, 0xff, 0xe1]) }), "a.jpg"), /after the image ends/);
});

test("JPEG: a truncated file is refused, not crashed on", () => {
    refuses(() => inspectImage(jpeg().subarray(0, 30), "a.jpg"), /truncated|malformed|ends before/);
});

test("a plain PNG passes; text and Exif chunks are refused", () => {
    assert.deepEqual(inspectImage(png(), "a.png"), { width: 640, height: 480, type: "image/png" });
    refuses(() => inspectImage(png([chunk("tEXt", latin1("Comment\0home"))]), "a.png"), /tEXt/);
    refuses(() => inspectImage(png([chunk("eXIf", Buffer.alloc(8))]), "a.png"), /eXIf/);
});

/* ------------------------------------------------------- image paths */

function writingFolder() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blog-test-"));
    fs.mkdirSync(path.join(dir, "images/01"), { recursive: true });
    fs.writeFileSync(path.join(dir, "images/01/board.jpg"), jpeg());
    fs.writeFileSync(path.join(dir, "images/01/meta.jpg"), jpeg({ segments: [segment(0xe1, exif({ ifd0: [0x8825] }))] }));
    fs.writeFileSync(path.join(dir, "images/original.jpg"), jpeg());
    return dir;
}

test("image paths: a copy in images/NN/ resolves; everything else is refused", () => {
    const dir = writingFolder();
    const resolve = imageResolver(dir);
    assert.deepEqual(resolve("images/01/board.jpg", "p.md:1"), { url: "/blog/images/01/board.jpg", width: 2000, height: 1500 });
    refuses(() => resolve("images/original.jpg", "p.md:1"), /not a publishable copy/);
    refuses(() => resolve("../images/01/board.jpg", "p.md:1"), /not a publishable copy/);
    refuses(() => resolve("images/01/../original.jpg", "p.md:1"), /not a publishable copy/);
    refuses(() => resolve("images/01/board_PRIVATE.jpg", "p.md:1"), /_PRIVATE/);
    refuses(() => resolve("images/01/missing.jpg", "p.md:1"), /does not exist/);
    refuses(() => resolve("images/01/meta.jpg", "p.md:1"), /GPS/);
});

test("image paths in preview: a missing image is a placeholder, nothing else is let through", () => {
    const dir = writingFolder();
    const resolve = imageResolver(dir, undefined, { preview: true });
    assert.match(resolve("images/11/not-taken-yet.jpg", "p.md:1").url, /^data:image\/svg\+xml,/);
    refuses(() => resolve("images/original.jpg", "p.md:1"), /not a publishable copy/);
    refuses(() => resolve("images/01/meta.jpg", "p.md:1"), /GPS/);
    refuses(() => resolve("images/01/x_PRIVATE.jpg", "p.md:1"), /_PRIVATE/);
    refuses(() => imageResolver(dir)("images/11/not-taken-yet.jpg", "p.md:1"), /does not exist/);
});

/* ------------------------------------------------------------- posts */

const POST = `---
title: "Where it started"
description: "February 2026: a board out of its box."
date: 2026-11-15
draft: false
tags: [motorcycle, build-log]
---

The first line,${"  " /* a hard break; written like this so no editor strips it */}
and a *second* with **strong** and \`code\` and a [link](https://example.com).

## 3 February

![The board on the table](images/01/board.jpg)
*3 February, 13:55. The blurred square is the label.*

- one
- two

> quoted

Text with a <script>alert(1)</script> in the middle stays text.
`;

const resolveStub = (src, where, base = "/blog/") => ({ url: `${base}${src}`, width: 2000, height: 1500 });
const parse = (text, options = {}) => parsePost(text, { file: "01-where-it-started.md", resolveImage: resolveStub, ...options });
const swap = (from, to) => POST.replace(from, to);

test("a finished post renders", () => {
    const post = parse(POST);
    assert.equal(post.slug, "where-it-started");
    assert.equal(post.url, "/blog/where-it-started/");
    assert.equal(post.dateLabel, "15 November 2026");
    assert.deepEqual(post.tags, ["motorcycle", "build-log"]);
    assert.equal(post.figures.length, 1);
    for (const fragment of [
        "The first line,<br>\nand a <em>second</em> with <strong>strong</strong> and <code>code</code>",
        '<a href="https://example.com" rel="noopener">link</a>',
        '<h2 id="3-february">3 February</h2>',
        '<figure class="b-fig-wide"><img src="/blog/images/01/board.jpg" alt="The board on the table" width="2000" height="1500" decoding="async"><figcaption>3 February, 13:55. The blurred square is the label.</figcaption></figure>',
        "<ul><li>one</li><li>two</li></ul>",
        "<blockquote><p>quoted</p></blockquote>",
        "a &lt;script&gt;alert(1)&lt;/script&gt; in the middle",
    ]) {
        assert.ok(post.html.includes(fragment), `missing: ${fragment}\n\n${post.html}`);
    }
});

test("posts: still a draft is refused, unless previewing", () => {
    refuses(() => parse(swap("draft: false", "draft: true")), /draft: true/);
    assert.equal(parse(swap("draft: false", "draft: true"), { preview: true }).draft, true);
});

test("posts: a TODO or PHOTO: left in is refused, unless previewing", () => {
    refuses(() => parse(swap("quoted", "[TODO: the Cluj line]")), /TODO/);
    refuses(() => parse(swap("quoted", "PHOTO: the meter")), /PHOTO:/);
    assert.ok(parse(swap("quoted", "[TODO: x]"), { preview: true }).html.includes("[TODO: x]"));
});

test("posts: HTML comments and raw HTML lines are refused, even when previewing", () => {
    refuses(() => parse(swap("quoted", "quoted <!-- trim this -->")), /HTML comment/);
    refuses(() => parse(swap("quoted", "x <!-- trim this -->"), { preview: true }), /HTML comment/);
    refuses(() => parse(swap("- one", '<img src="/x.jpg">\n\n- one')), /raw HTML/);
});

test("posts: an image not on its own line is refused (the stray :w)", () => {
    refuses(() => parse(swap("(images/01/board.jpg)", "(images/01/board.jpg):w")), /line of its own/);
});

test("posts: text under an image that is not an italic caption is refused", () => {
    refuses(() => parse(swap("*3 February, 13:55. The blurred square is the label.*", "3 February, plain")), /caption/);
});

test("posts: an image needs alt text", () => {
    refuses(() => parse(swap("![The board on the table]", "![]")), /alt text/);
});

test("posts: unsafe links are refused", () => {
    refuses(() => parse(swap("(https://example.com)", "(javascript:alert(1))")), /link/);
    refuses(() => parse(swap("(https://example.com)", "(//evil.example)")), /link/);
});

test("posts: a # heading is refused (the title comes from the front matter)", () => {
    refuses(() => parse(swap("## 3 February", "# 3 February")), /title/);
});

test("posts: the file name and front matter are checked", () => {
    refuses(() => parsePost(POST, { file: "Where It Started.md", resolveImage: resolveStub }), /NN-slug\.md/);
    refuses(() => parse(swap('title: "Where it started"\n', "")), /title/);
    refuses(() => parse(swap("date: 2026-11-15", "date: 15 Nov")), /YYYY-MM-DD/);
    refuses(() => parse(POST.replace(/^---\n/, "")), /front matter/);
});

test("errors point at the line in the file", () => {
    // The stray :w is on line 14 of POST.
    refuses(() => parse(swap("(images/01/board.jpg)", "(images/01/board.jpg):w")), /01-where-it-started\.md:14:/);
});

/* -------------------------------------------------- writing folder */

test("prepareForPublish drops notes, keeps line numbers, and rewrites ../images/", () => {
    const original = "a\n<!-- note\nover two lines -->\nb ![x](../images/01/a.jpg)\n";
    const { text, notes } = prepareForPublish(original);
    assert.equal(notes, 1);
    assert.equal(text, "a\n\n\nb ![x](images/01/a.jpg)\n");
    assert.equal(text.split("\n").length, original.split("\n").length);
});

test("renderMarkdown never passes markup through", () => {
    const { html } = renderMarkdown('a "quote" & <b>bold</b>', { file: "x.md", resolveImage: resolveStub });
    assert.equal(html, "<p>a &quot;quote&quot; &amp; &lt;b&gt;bold&lt;/b&gt;</p>");
});

/* ------------------------------------------------------------ series */

const SERIES_POST = swap("draft: false", "draft: false\nseries: moto-tracker");

function folder(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blog-site-"));
    for (const [name, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
        fs.writeFileSync(path.join(dir, name), body);
    }
    return dir;
}

test("series: a post and its images move under /blog/<series>/", () => {
    const post = parse(SERIES_POST);
    assert.equal(post.series, "moto-tracker");
    assert.equal(post.url, "/blog/moto-tracker/where-it-started/");
    assert.match(post.html, /src="\/blog\/moto-tracker\/images\/01\/board\.jpg"/);
    assert.equal(parse(POST).series, null);
    assert.equal(parse(POST).url, "/blog/where-it-started/");
    for (const bad of ["Moto-Tracker", "moto_tracker", "moto/tracker", "../x", "images", "[a]"]) {
        refuses(() => parse(swap("draft: false", `draft: false\nseries: ${bad}`)), /series .* must be lower case/);
    }
});

test("content/blog/: each series in its own folder, numbered on its own, with its own images and pages", () => {
    const dir = folder({
        "01-a-standalone.md": POST,
        "images/01/board.jpg": jpeg(),
        "moto-tracker/01-where-it-started.md": SERIES_POST,
        "moto-tracker/02-tunnels.md": SERIES_POST.replace('"Where it started"', '"Tunnels"'),
        "moto-tracker/images/01/board.jpg": jpeg(),
    });
    const loaded = loadPublished(dir);
    assert.deepEqual(loaded.posts.map((post) => post.url), ["/blog/a-standalone/", "/blog/moto-tracker/where-it-started/", "/blog/moto-tracker/tunnels/"]);
    assert.deepEqual([...loaded.assets.keys()].sort(), ["/blog/images/01/board.jpg", "/blog/moto-tracker/images/01/board.jpg"]);

    const files = buildSite(loaded);
    const page = (url) => files.get(`${url}index.html`)?.body.toString();
    assert.match(page("/blog/moto-tracker/"), /<h1>Moto Tracker<\/h1>[\s\S]*where-it-started[\s\S]*tunnels/);
    const first = page("/blog/moto-tracker/where-it-started/");
    assert.match(first, /<a href="\/blog\/">blog<\/a><span aria-hidden="true">\/<\/span><a href="\/blog\/moto-tracker\/">Moto Tracker<\/a><\/nav>/, "the breadcrumb names the series, not its folder");
    // The blog index says which series a post is in and where; the series page doesn't repeat itself.
    const index = page("/blog/");
    const item = (slug) => index.split("<li>").find((li) => li.includes(`/${slug}/"`));
    assert.match(item("where-it-started"), /<a class="b-series" href="\/blog\/moto-tracker\/">Moto Tracker<\/a>, part&nbsp;1</);
    assert.match(item("tunnels"), /Moto Tracker<\/a>, part&nbsp;2</);
    assert.doesNotMatch(item("a-standalone"), /class="b-series"/);
    assert.doesNotMatch(page("/blog/moto-tracker/"), /class="b-list-series"/);
    assert.match(first, /class="b-meta">[^\n]*Moto Tracker<\/a>, part&nbsp;1&nbsp;of&nbsp;2</);
    assert.match(page("/blog/moto-tracker/tunnels/"), /class="b-meta">[^\n]*part&nbsp;2&nbsp;of&nbsp;2</);
    assert.doesNotMatch(page("/blog/a-standalone/"), /class="b-series"/);
    assert.match(first, /href="\/blog\/moto-tracker\/tunnels\/" rel="next"/);
    assert.doesNotMatch(first, /a-standalone/, "previous/next stay inside the series");
    assert.doesNotMatch(page("/blog/a-standalone/"), /rel="(?:next|prev)"/);
    assert.ok(files.has("/blog/moto-tracker/images/01/board.jpg"));
});

test("content/blog/: a post in the wrong folder, a shared number or address, or a bad folder name is refused", () => {
    const image = { "images/01/board.jpg": jpeg(), "moto-tracker/images/01/board.jpg": jpeg(), "other/images/01/board.jpg": jpeg() };
    refuses(() => loadPublished(folder({ ...image, "01-where-it-started.md": SERIES_POST })), /names series "moto-tracker", but sits in the top folder/);
    refuses(() => loadPublished(folder({ ...image, "other/01-where-it-started.md": SERIES_POST })), /names series "moto-tracker", but sits in the other\/ folder/);
    refuses(() => loadPublished(folder({ ...image, "moto-tracker/01-where-it-started.md": POST })), /names no series/);
    refuses(() => loadPublished(folder({ ...image, "moto-tracker/01-where-it-started.md": SERIES_POST, "moto-tracker/01-again.md": SERIES_POST })), /in moto-tracker share the number 01/);
    refuses(() => loadPublished(folder({ ...image, "moto-tracker/01-x.md": SERIES_POST, "moto-tracker/02-x.md": SERIES_POST })), /share the address \/blog\/moto-tracker\/x\//);
    refuses(() => loadPublished(folder({ ...image, "01-moto-tracker.md": POST, "moto-tracker/01-where-it-started.md": SERIES_POST })), /both a post and the page of the moto-tracker series/);
    refuses(() => loadPublished(folder({ "Moto/README.md": "x" })), /lower case with hyphens/);
});

test("preview: a refused draft's page sits at its series address, so its own link shows why", () => {
    const dir = folder({ "posts/01-where-it-started.md": SERIES_POST.replace("## 3 February", "<!-- note -->\n## 3 February"), "images/01/board.jpg": jpeg() });
    const { posts, problems } = loadPosts({ postsDir: path.join(dir, "posts"), imagesRoot: dir, preview: true });
    assert.equal(posts.length, 0);
    assert.equal(problems[0].url, "/blog/moto-tracker/where-it-started/");
    assert.ok(buildSite({ posts, assets: new Map(), problems }, { preview: true }).has("/blog/moto-tracker/where-it-started/index.html"));
});

/* ---------------------------------------------- callouts and figure shapes */

test("a quote that opens with a line of only **bold** is a number callout; other quotes stay quotes", () => {
    const post = parse(swap("> quoted", "> **5–7 days**\n> An estimate, never *measured*.\n\n> quoted"));
    assert.ok(post.html.includes('<blockquote class="b-stat"><p class="b-stat-n">5–7 days</p><p>An estimate, never <em>measured</em>.</p></blockquote>'), post.html);
    assert.ok(post.html.includes("<blockquote><p>quoted</p></blockquote>"));
    assert.ok(parse(swap("> quoted", "> **bold** and more")).html.includes("<blockquote><p><strong>bold</strong> and more</p></blockquote>"));
});

test("figures are classed by shape: landscape wide, phone screenshots tall, the rest normal", () => {
    const shape = (width, height) => parsePost(POST, { file: "01-where-it-started.md", resolveImage: (src, where, base = "/blog/") => ({ url: base + src, width, height }) })
        .html.match(/<figure class="([^"]+)"/)[1];
    assert.equal(shape(2000, 1500), "b-fig-wide");
    assert.equal(shape(2000, 1609), "b-fig-wide");
    assert.equal(shape(925, 2000), "b-fig-tall");
    assert.equal(shape(1604, 2000), "b-fig-normal");
    assert.equal(shape(1170, 1146), "b-fig-normal");
});

test("built pages carry tap-to-enlarge and the figure layout, and nothing of the look prototype", () => {
    const loaded = { posts: [parse(POST)], assets: new Map(), problems: [] };
    const built = buildSite(loaded).get("/blog/where-it-started/index.html").body.toString();
    for (const present of ['box.className="b-zoom"', ".b-zoom {", ".b-fig-wide {", ".b-fig-tall {", ".b-stat .b-stat-n {"]) {
        assert.ok(built.includes(present), `built page lacks ${present}`);
    }
    for (const gone of ["b-looks", "blog-look", "data-look", "--read"]) {
        assert.ok(!built.includes(gone), `built page still carries ${gone}`);
    }
});

const COVERED = SERIES_POST.replace("series: moto-tracker", 'series: moto-tracker\ncover: ../images/01/cover.jpg\ncover_alt: "The board in its case"');

test("a cover goes through the image gate, sits under the title, and is the link preview's picture", () => {
    const dir = folder({
        "moto-tracker/01-where-it-started.md": COVERED,
        "moto-tracker/02-uncovered.md": SERIES_POST.replace('"Where it started"', '"Uncovered"'),
        "moto-tracker/images/01/board.jpg": jpeg(),
        "moto-tracker/images/01/cover.jpg": jpeg(),
    });
    const loaded = loadPublished(dir);
    assert.ok(loaded.assets.has("/blog/moto-tracker/images/01/cover.jpg"), "the cover is published with the post");
    const files = buildSite(loaded);
    const covered = files.get("/blog/moto-tracker/where-it-started/index.html").body.toString();
    assert.match(covered, /<\/header>\n<figure class="b-cover"><img src="\/blog\/moto-tracker\/images\/01\/cover\.jpg" alt="The board in its case" width="2000" height="1500" fetchpriority="high"><\/figure>\n<div class="b-body">/);
    assert.match(covered, /<meta property="og:image" content="https:\/\/ionut\.codes\/blog\/moto-tracker\/images\/01\/cover\.jpg">/);
    assert.match(covered, /<meta property="og:image:alt" content="The board in its case">/);
    const plain = files.get("/blog/moto-tracker/uncovered/index.html").body.toString();
    assert.doesNotMatch(plain, /b-cover"><img/);
    assert.match(plain, /<meta property="og:image" content="https:\/\/ionut\.codes\/blog\/moto-tracker\/images\/01\/board\.jpg">/, "without a cover, the first figure is the preview");

    const writing = writingFolder();
    fs.writeFileSync(path.join(writing, "images/01/cover.jpg"), jpeg());
    const seen = [];
    const resolveImage = imageResolver(writing, (image) => seen.push(image.src));
    parsePost(prepareForPublish(COVERED).text, { file: "01-where-it-started.md", resolveImage });
    assert.ok(seen.includes("images/01/cover.jpg"), "the import copies the cover like any other image");
    const withCover = (cover) => () => parsePost(SERIES_POST.replace("series: moto-tracker", `series: moto-tracker\ncover: ${cover}\ncover_alt: "x"`), { file: "01-where-it-started.md", resolveImage });
    refuses(withCover("../images/01/board_PRIVATE.jpg"), /_PRIVATE/);
    refuses(withCover("../images/original.jpg"), /not a publishable copy/);
    refuses(withCover("../../images/01/board.jpg"), /not a publishable copy/);
    refuses(withCover("../images/01/meta.jpg"), /GPS/);
    refuses(withCover("../images/01/missing.jpg"), /does not exist/);
    refuses(() => parse(COVERED.replace(/\ncover_alt: .*/, "")), /needs "cover_alt"/);
    refuses(() => parse(SERIES_POST.replace("series: moto-tracker", 'series: moto-tracker\ncover_alt: "x"')), /"cover_alt" without a "cover"/);
});
