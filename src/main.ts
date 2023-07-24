import './style.css'
import { Home } from './pages/home.ts'

const appElement = document.querySelector<HTMLDivElement>('#app');
if (appElement) {
  const home = new Home();
  appElement.appendChild(home);
}