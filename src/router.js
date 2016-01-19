/*!
 * TrashPanda
 * Copyright(c) 2016 - Balaganesh Damodaran <trashpanda@bgdam.com>
 * ISC Licensed
 */

'use strict';

/**
 * TrashPanda Router
 */

import pathToRegex from 'path-to-regexp';
import merge from 'utils-merge';
import urlUtils from 'url';
import async from 'async';

function factory(opts) {
	let options = {};
	let routes = {};

	let methods = [
		'all',
		'get',
		'checkout',
		'connect',
		'copy',
		'delete',
		'head',
		'lock',
		'merge',
		'mkactivity',
		'mkcol',
		'move',
		'm-search',
		'notify',
		'options',
		'patch',
		'post',
		'propfind',
		'proppatch',
		'purge',
		'put',
		'report',
		'search',
		'subscribe',
		'trace',
		'unlock',
		'unsubscribe',
	];

	function addHandlerForPath(path, handler, method = 'all', matchEntirePath = false) {
		let params = [];
		let opts = {};

		merge(opts, options);
		opts.end = !matchEntirePath;

		let matcher = pathToRegex(path, params, opts);
		let matcherKey = matcher.toString();

		routes[matcherKey] = routes[matcherKey] || {};
		routes[matcherKey].matcher = routes[matcherKey].matcher || matcher;

		if (params.length)
			routes[matcherKey].params = routes[matcherKey].params || params.map(param => param.name);

		handler.route = path;
		handler.method = method;

		routes[matcherKey].handlers = routes[matcherKey].handlers || [];
		routes[matcherKey].handlers.push(handler);
	};

	function TrashPandaRouter(opts) {
		merge(options, opts);
	};

	TrashPandaRouter.prototype.use(path, handler) {
		addHandlerForPath(path, handler);
	};

	TrashPandaRouter.prototype.route(path) {
		let route = {};
		methods.forEach(methodName => route[methodName] = this[methodName].bind(this, path));
		return route;
	};

	methods.forEach((methodName) => {
		TrashPandaRouter.prototype[methodName] = function(...params) {
			addHandlerForPath(path, handler, methodName, true);
		};
	});

	TrashPandaRouter.prototype.resolve(req, res, next) {
		/**
		 * Attempts to route a req client side.
		 * Returns true if routing can be handled locally.
		 * Else returns false.
		 */

		/**
		 * NO LONGER ACCURATE
		 * TODO: Update this comment with proper algo
		 * Algorithm:
		 * 1. Run each matcher against url
		 * 2. If matcher matches concat handlers to execHandlers
		 * 3. Async series execHandlers
		 */

		let that = this;
		let execHandlers = [];
		let errorHandlers = [];
		let parsedUrl = urlUtils.parse(req.url);
		let path = parsedUrl.pathname;

		/**
		 * shouldRouteLocally - Flag which indicates that
		 * root app should perform routing instead of browser.
		 * If url to route to has a different host or if req.target
		 * is not the same as current browsing context,
		 * then routing is performed by browser. Else by app.
		 */
		let shouldRouteLocally = false;
		if ((!parsedUrl.host || parsedUrl.host == window.location.host) &&
			(!parsedUrl.protocol || parsedUrl.protocol == window.location.protocol)) {
			let targetMap = {
				'_self': window,
				'_parent': window.parent,
				'_top': window.top
			};

			if (req.target)
				shouldRouteLocally = targetMap[req.target] == window;
			else
				shouldRouteLocally = true;
		}

		if (!shouldRouteLocally)
			return false;

		let routeMatchKeys = Object.keys(routes);
		routeMatchKeys.forEach(matcherKey => {
			let matcher = routes[matcherKey].matcher;
			let matches = matcher.exec(path);

			if (matches[0] && path.indexOf(matches[0]) == 0) {
				let handlers = routes[matcherKey].handlers;

				handlers.forEach(handler => {
					if (['all', req.method].indexOf(handler.method) == -1)
						return;

					let handlerCollection = handler.errorHandler ? errorHandlers : execHandlers;
					handlerCollection.push({
						exec: handler,
						params: routes[matcherKey].params,
						matches: matches
					});
				});
			}
		});

		if (!execHandlers.length)
			res.sendStatus(404);

		function resolveWithUpdatedRequest(req, res, handler, next) {
			var mappedParams = {};

			if (utils.isArray(handler.params))
				handler.params.forEach((paramName, i) => mappedParams[paramName] = handler.matches[i + 1]);

			req.update({
				params: mappedParams,
				route: handler.exec.route,
				router: that
			});

			handler.exec.call(null, req, res, next);
		};

		async.eachSeries(execHandlers, resolveWithUpdatedRequest.bind(null, req, res), err => {
			if (!err)
				return next();

			async.eachSeries(errorHandlers, resolveWithUpdatedRequest.bind(null, req, res), err => {
				if (err)
					res.sendStatus(500);

				return next(err);
			});
		});

		return true;
	};

	TrashPandaRouter.prototype.setAsAuthoritativeRouter = function() {
		options.setAsAuthoritativeApp();
	};

	return new TrashPandaRouter(opts);
};

export
default factory;
