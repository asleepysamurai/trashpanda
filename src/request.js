/*!
 * TrashPanda
 * Copyright(c) 2016 - Balaganesh Damodaran <trashpanda@bgdam.com>
 * ISC Licensed
 */

'use strict';

/**
 * TrashPanda Request
 */

import pathToRegex from 'path-to-regexp';
import merge from 'utils-merge';
import utils from './utils';

function factory(opts) {
	let href;

	function getMatchingBaseUrl(app, path) {
		let mountPaths = app.mountPath;
		mountPaths = utils.isArray(mountPaths) ? mountPaths : [mountPaths];

		let baseUrl;

		mountPaths.every(mountPath => {
			let params = [];
			let matcher = pathToRegex(mountPath, params, {
				sensitive: app.get('case sensitive routing'),
				strict: app.get('strict routing'),
				end: false
			});

			let matches = matcher.exec(path);
			if (matches[0] && path.indexOf(matches[0]) == 0)
				baseUrl = matches[0];

			return !baseUrl;
		});

		return baseUrl;
	};

	function TrashPandaRequest(opts) {
		href = opts.url;
		this.app = opts.app;

		let parsedUrl = url.parse(href, true);
		merge(this, parsedUrl);

		this.method = opts.method;
		this.baseUrl = getMatchingBaseUrl(app, this.path);

		this.originalUrl = this.path;
		this.path = this.path.replace(this.baseUrl, '');
		this.url = this.path;

		this.pathname = this.pathname.replace(this.baseUrl, '');
		this.body = data;
	};

	TrashPandaRequest.prototype.update(opts) {
		merge(this, opts);
	};

	return new TrashPandaRequest(opts);
};

export
default factory;
