import './style.css'
import { Home } from './pages/home.ts'
import { openCv } from './components/cvPage'

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

const appElement = document.querySelector<HTMLDivElement>('#app');
if (appElement) {
  const home = new Home();
  appElement.appendChild(home);

  addSkipToCvLink();

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
