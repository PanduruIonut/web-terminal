import { randomizeText } from '../utils/randomizeText';

export class MyLayout extends HTMLElement {
	constructor() {
		super();

		this.attachShadow({ mode: 'open' });

		if (!this.shadowRoot) return;
		this.shadowRoot.innerHTML = `
		<style>
			h1 {
				color:white;
				font-size:50px;
				display:flex;
				justify-content:center;
				display:none;
			}
		</style>
		<!DOCTYPE html>
		<html lang="en">
			<head>
			<meta charset="UTF-8" />
			<meta name="description" content="ionut.codes">
			<meta name="viewport" content="width=device-width" />
			<link rel="icon" type="image/svg+xml" href="/cli.svg" />
			<title>{title}</title>
			</head>
			<body>
			<!-- Hidden stuff, nothing here CTF{not_your_business} -->
				<h1 data-value='hover-me'>hover-me</h1>
				<slot></slot>
			</body>
		</html>
		`;
	}
	async connectedCallback() {
		if (!this.shadowRoot) return;
		const text = this.shadowRoot.querySelector('h1');
		if (!text) return;
		randomizeText(text);
	}

	disconnectedCallback() {
		if (!this.shadowRoot) return;
		const h1Element = this.shadowRoot.querySelector('h1');
		if (!h1Element) return;
		h1Element.onmouseover = null;
	}
}



customElements.define('my-layout', MyLayout);
