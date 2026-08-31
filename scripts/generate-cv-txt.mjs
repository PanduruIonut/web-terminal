#!/usr/bin/env node
/**
 * Renders public/cv.txt from src/data/cv.json.
 *
 * cv.txt is what `curl ionut.codes` returns and the CV page is what a browser
 * gets; both used to hold their own copy of the same content and were free to
 * drift. This is the one that is generated, so the JSON is the single source.
 *
 * Runs as part of `pnpm build`. Every line is hard-wrapped to 80 columns.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const cv = JSON.parse(fs.readFileSync(path.join(root, "src/data/cv.json"), "utf8"));

const WIDTH = 76;

const BANNER = `
   ____                    _
  |  _ \\  __ _  _ __    __| | _   _  _ __  _   _
  | |_) |/ _\` || '_ \\  / _\` || | | || '__|| | | |
  |  __/| (_| || | | || (_| || |_| || |   | |_| |
  |_|    \\__,_||_| |_| \\__,_| \\__,_||_|    \\__,_|
   ___                      _
  |_ _| ___   _ __   _   _ | |_
   | | / _ \\ | '_ \\ | | | || __|
   | || (_) || | | || |_| || |_
  |___|\\___/ |_| |_| \\__,_| \\__|
`.replace(/^\n/, "");

/** Greedy wrap. Words longer than the width are left alone rather than broken. */
function wrap(text, width, indent = "") {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";

    for (const word of words) {
        if (!line) line = word;
        else if ((line + " " + word).length <= width) line += " " + word;
        else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);

    return lines.map((l) => indent + l);
}

/** Left text and right text on one line, padded apart, never exceeding WIDTH. */
function spread(left, right, width = WIDTH) {
    const gap = width - left.length - right.length;
    return gap >= 1 ? left + " ".repeat(gap) + right : `${left} ${right}`;
}

const rule = (label) =>
    label
        ? `-- ${label} ${"-".repeat(Math.max(0, WIDTH - 4 - label.length))}`
        : "-".repeat(WIDTH);

const out = [];
out.push("", ...BANNER.split("\n").filter((l) => l !== ""));
out.push("");
out.push("  " + spread(cv.title, cv.location, WIDTH - 2));
out.push(rule());
out.push(`  email      ${cv.contact.email}`);
out.push(`  web        ${cv.contact.web}`);
out.push(`  github     ${cv.contact.github}`);
out.push(`  linkedin   ${cv.contact.linkedin}`);

out.push("", rule("PROFILE"), "");
out.push(...wrap(cv.profile, WIDTH - 2, "  "));

out.push("", rule("STACK"), "");
for (const [key, value] of cv.stack) {
    const label = ("  " + key.toLowerCase()).padEnd(13);
    const [first, ...rest] = wrap(value, WIDTH - 13);
    out.push(label + first);
    for (const line of rest) out.push(" ".repeat(13) + line);
}

out.push("", rule("EXPERIENCE"), "");
for (const role of cv.roles) {
    out.push("  " + spread(`${role.title} · ${role.place}`, `${role.whenShort} · Sibiu`, WIDTH - 2));
    for (const line of wrap(role.detail, WIDTH - 4)) out.push("  │ " + line.trimStart());
    const [first, ...rest] = wrap(role.stack, WIDTH - 4);
    out.push("  └ " + first);
    for (const line of rest) out.push("    " + line);
    out.push("");
}

out.push(rule("PROJECTS"), "");
for (const project of cv.projects) {
    out.push("  " + (project.link ? spread(project.name, project.link, WIDTH - 2) : project.name));
    const lines = wrap(project.detail, WIDTH - 4);
    lines.forEach((line, i) => out.push((i === lines.length - 1 ? "  └ " : "  │ ") + line.trimStart()));
    out.push("");
}

out.push(rule("EDUCATION"), "");
for (const item of cv.education) {
    out.push("  " + spread(item.degree, item.whenShort, WIDTH - 2));
    out.push("  └ " + item.place);
    out.push("");
}

out.push(rule("CERTIFICATES"), "");
for (const cert of cv.certificates) out.push("  · " + cert);

out.push("", rule(), "");
out.push(...wrap(cv.closing, WIDTH - 2, "  "));
out.push("");

const text = out.join("\n");

const tooWide = text.split("\n")
    .map((line, i) => ({ line: i + 1, bytes: Buffer.byteLength(line, "utf8"), cols: [...line].length }))
    .filter((l) => l.bytes > 80 || l.cols > 80);

if (tooWide.length) {
    console.error("Lines exceed 80 columns/bytes:", tooWide);
    process.exit(1);
}

fs.writeFileSync(path.join(root, "public/cv.txt"), text);
console.log(`cv.txt generated — ${text.split("\n").length} lines, max ${Math.max(...text.split("\n").map(l => [...l].length))} cols`);
