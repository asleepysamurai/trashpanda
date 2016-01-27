'use strict';

/**
 * Wrapper for rendering react in TrashPanda
 */

let ReactDOM = require('react-dom');
let ReactDOMServer = require('react-dom/server');

let utils = require('../utils');

let renderer = {
	compile: function(reactComponent) {
		return function(opts) {
			let renderable;

			if (opts.type == 'html')
				renderable = ReactDOMServer.renderToString(reactComponent);
			else if (opts.type == 'static')
				renderable = ReactDOMServer.renderToStaticMarkup(reactComponent);
			else
				renderable = reactComponent;

			return renderable;
		}
	},
	mount: function(mountNode, reactComponent) {
		if (utils.isString(reactComponent))
			mountNode.innerHTML = reactComponent;
		else
			ReactDOM.render(reactComponent, mountNode);
	}
};

module.exports = renderer;
