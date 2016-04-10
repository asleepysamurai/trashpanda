/*!
 * TrashPanda
 * Copyright(c) 2016 - Balaganesh Damodaran <trashpanda@bgdam.com>
 * ISC Licensed
 */

'use strict';

/**
 * TrashPanda Router
 */

let pathToRegex = require('path-to-regexp');
let merge = require('extendify')({
	arrays: 'concat'
});
let urlUtils = require('url');
let async = require('async');

let utils = require('./utils');

function factory(opts) {
	let options = {};
	let routes = {};
	let params = {};

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

	function reconcileParamsWithRoutes(params, routes) {
		let paramNames = Object.keys(params);
		let routeKeys = Object.keys(routes);

		if (!(paramNames.length && routeKeys.length))
			return;

		routeKeys.forEach(routeKey => {
			let route = routes[routeKey];
			route.paramHandlersCount = route.paramHandlersCount || 0;

			if (!(route.params && route.params.length))
				return;

			let paramsInRoute = route.params.filter(param => paramNames.indexOf(param) > -1);

			if (!paramsInRoute.length)
				return;

			paramsInRoute.forEach(param => {
				let handlers = params[param];
				if (!(handlers && handlers.length))
					return;

				route.handlers = route.handlers || [];

				if (route.handlers[0] && route.handlers[0].route && route.handlers[0].method) {
					handlers.forEach(handler => {
						handler.route = route.handlers[0].route;
						handler.method = route.handlers[0].method;
					});
				}

				route.handlers = [...route.handlers.splice(0, route.paramHandlersCount), ...handlers, ...route.handlers];
				++route.paramHandlersCount;
			});
		});
	};

	function addHandlerForPath(path, handler, method = 'all', matchEntirePath = false) {
		let keys = [];
		let opts = {};
		let newRoutes = {};

		merge(opts, options);
		opts.end = !matchEntirePath;

		let matcher = pathToRegex(path, keys, opts);
		let matcherKey = matcher.toString();

		newRoutes[matcherKey] = newRoutes[matcherKey] || {};
		newRoutes[matcherKey].matcher = newRoutes[matcherKey].matcher || matcher;

		if (keys.length)
			newRoutes[matcherKey].params = newRoutes[matcherKey].params || keys.map(key => key.name);

		handler.route = path;
		handler.method = method;

		newRoutes[matcherKey].handlers = newRoutes[matcherKey].handlers || [];
		newRoutes[matcherKey].handlers.push(handler);

		reconcileParamsWithRoutes(params, newRoutes);

		routes[matcherKey] = routes[matcherKey] || {
			handlers: []
		};
		merge(routes, newRoutes);
	};

	function addHandlerForParams(_params, handler) {
		if (utils.isString(_params))
			_params = [_params];
		if (!utils.isArrayOfStrings(_params))
			throw new Error(`'params' should be a string or an array of strings.`);

		let newParams = {};
		_params.forEach(param => {
			if (param) {
				newParams[param] = newParams[param] || [];
				newParams[param].push(handler);
			}
		});

		reconcileParamsWithRoutes(newParams, routes);
		merge(params, newParams);
	};

	function TrashPandaRouter(opts) {
		merge(options, opts);
	};

	TrashPandaRouter.prototype.use = function(path, handler) {
		addHandlerForPath(path, handler);
	};

	TrashPandaRouter.prototype.route = function(path) {
		let route = {};
		methods.forEach(methodName => route[methodName] = this[methodName].bind(this, path));
		return route;
	};

	TrashPandaRouter.prototype.param = function(params, handler) {
		addHandlerForParams(params, handler);
	};

	methods.forEach((methodName) => {
		TrashPandaRouter.prototype[methodName] = function(path, handler, ...params) {
			addHandlerForPath(path, handler, methodName, ...params);
		};
	});

	TrashPandaRouter.prototype.resolve = function(req, res, next) {
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

			if (matches && matches[0] && path.indexOf(matches[0]) == 0) {
				let handlers = routes[matcherKey].handlers;

				handlers.forEach(handler => {
					if (['all', req.method].indexOf(handler.method) == -1)
						return;

					let handlerCollection = handler.errorHandler ? errorHandlers : execHandlers;
					let handlerConfig = {
						exec: handler,
						params: routes[matcherKey].params,
						matches: matches
					};

					if (handler.willRender && !handlerCollection.renderingHandler)
						handlerCollection.renderingHandler = handlerConfig;
					else
						handlerCollection.push(handlerConfig);
				});

			}
		});

		if (errorHandlers.renderingHandler)
			errorHandlers.push(errorHandlers.renderingHandler);
		if (execHandlers.renderingHandler)
			execHandlers.push(execHandlers.renderingHandler);

		if (!execHandlers.length)
			return res.sendStatus(404);

		function resolveWithUpdatedRequest(req, res, handler, next) {
			var mappedParams = {};

			if (utils.isArray(handler.params))
				handler.params.forEach((paramName, i) => mappedParams[paramName] = handler.matches[i + 1]);

			req.update({
				params: mappedParams,
				route: handler.exec.route,
				router: that,
				app: options.app
			});
			res.update({
				router: that,
				app: options.app
			});

			handler.exec(req, res, next);
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

module.exports = factory;
