export class MyLayout extends HTMLElement {
	constructor() {
		super();

		this.attachShadow({ mode: 'open' });

		if (!this.shadowRoot) return;
		this.shadowRoot.innerHTML = `
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
				<slot></slot>
			</body>
		</html>
		`;
	}
}

customElements.define('my-layout', MyLayout);
