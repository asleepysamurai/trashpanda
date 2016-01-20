/*!
 * TrashPanda
 * Copyright(c) 2016 - Balaganesh Damodaran <trashpanda@bgdam.com>
 * ISC Licensed
 */

'use strict';

/**
 * TrashPanda Request
 */

let pathToRegex = require('path-to-regexp');
let urlUtils = require('url');
let merge = require('utils-merge');
let utils = require('./utils');

function addLeadingSlashIfNotPresent(str) {
	if (str[0] != '/')
		return '/' + str;
	return str;
};

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

		let parsedUrl = urlUtils.parse(href, true);
		merge(this, parsedUrl);

		this.method = opts.method;
		this.baseUrl = getMatchingBaseUrl(this.app, this.path);

		this.originalUrl = this.path;
		this.path = addLeadingSlashIfNotPresent(this.path.replace(this.baseUrl, ''));
		this.url = this.path;

		//If cross domain call, then reset originalUrl and url
		if (!(this.protocol == window.location.protocol && this.host == window.location.host)) {
			this.originalUrl = href;
			this.url = href;
		}

		this.pathname = addLeadingSlashIfNotPresent(this.pathname.replace(this.baseUrl, ''));
		this.body = opts.data;

		this.target = opts.target;
	};

	TrashPandaRequest.prototype.update = function(opts) {
		merge(this, opts);
	};

	return new TrashPandaRequest(opts);
};

module.exports = factory;
