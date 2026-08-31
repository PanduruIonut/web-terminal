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

const appElement = document.querySelector<HTMLDivElement>('#app');
if (appElement) {
  const home = new Home();
  appElement.appendChild(home);

  // The terminal is still mounted behind it, so "reopen the terminal" on the
  // CV works on mobile exactly as it does everywhere else.
  if (window.matchMedia(PREFERS_PLAIN_PAGE).matches) {
    openCv();
  }
}
