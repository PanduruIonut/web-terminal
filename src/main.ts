import './style.css'
import { Home } from './pages/home.ts'
import { openCv } from './components/cvPage'
import posts from 'virtual:blog'

/**
 * Phones open on the CV instead of the terminal. Driving a command line from a
 * soft keyboard is miserable, and the terminal is the thing most likely to make
 * someone leave on a phone.
 *
 * Coarse pointer AND a narrow viewport, rather than width alone: a desktop
 * window dragged narrow should still get the terminal, since that is the whole
 * point of the site. Tablets in landscape are wide enough to keep it too.
 *
 * Evaluated once at load. Reacting to resize or rotation would pull the page
 * out from under someone mid-read.
 */
const PREFERS_PLAIN_PAGE = "(pointer: coarse) and (max-width: 820px)";

/**
 * The terminal is a div of animated text with no headings or landmarks, so on
 * its own it leaves assistive tech with nothing to work with. The CV page is
 * the semantic version of the same content; this puts it one Tab away. Hidden
 * until focused, which is the usual skip-link behaviour.
 */
function addSkipToCvLink(): void {
  const link = document.createElement('button');
  link.type = 'button';
  link.className = 'skip-to-cv';
  link.textContent = 'Skip the terminal and read the CV';
  link.addEventListener('click', () => openCv());
  document.body.insertBefore(link, document.body.firstChild);
}

/**
 * Blog and CV in the top corner, where people look for a site's other pages.
 * The terminal is the point of the page, but someone who doesn't want to type
 * shouldn't have to know that the red dot opens the CV.
 *
 * Inside <main>: hidden while the CV is open (see main[hidden] in style.css)
 * and left out of the printed CV with the terminal. The blog link follows the
 * CV's rule: no published posts, no link.
 *
 * The CV link is a real link to /#cv, so it can be copied or opened in a new
 * tab; a plain click opens the panel in place, without a history entry, the
 * same way the skip link does.
 */
function addSiteNav(): void {
  const main = document.querySelector('main');
  if (!main) return;

  const nav = document.createElement('nav');
  nav.className = 'site-nav';
  nav.setAttribute('aria-label', 'Site');

  if (posts.length) {
    const blog = document.createElement('a');
    blog.href = '/blog/';
    blog.textContent = 'blog';
    nav.appendChild(blog);
  }

  const cv = document.createElement('a');
  cv.href = '/#cv';
  cv.textContent = 'cv';
  cv.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openCv();
  });
  nav.appendChild(cv);

  main.insertBefore(nav, main.firstChild);
}

const appElement = document.querySelector<HTMLDivElement>('#app');
if (appElement) {
  const home = new Home();
  appElement.appendChild(home);

  addSkipToCvLink();
  addSiteNav();

  // ionut.codes/#cv opens straight onto the CV, so it can be linked to from a
  // signature or a message. The terminal stays mounted behind it either way.
  const askedForCv = window.location.hash === '#cv';

  if (askedForCv || window.matchMedia(PREFERS_PLAIN_PAGE).matches) {
    openCv();
  }

  // Someone editing the hash in the address bar of an already-open page.
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#cv') openCv();
  });
}
