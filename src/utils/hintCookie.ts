/**
 * The `hints` command tells players to inspect cookies, so there has to be
 * something in there. Base64 matches the style of the decoy file in the virtual
 * filesystem and stops the hint being readable at a glance in devtools.
 *
 * It points at the second flag: `cat secret.txt` needs execute permission on
 * /top_secret_clown_business, and those permission bits are restored from
 * localStorage on every `cd`, so that is where they can be changed.
 */
const HINT = "chmod isn't a command here. The filesystem remembers its permissions somewhere else in your browser.";

export function setHintCookie() {
    // Secure is conditional so the cookie is still set over http on localhost.
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `hint=${btoa(HINT)}; path=/; max-age=31536000; SameSite=Lax${secure}`;
}
