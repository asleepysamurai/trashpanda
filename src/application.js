/*!
 * TrashPanda
 * Copyright(c) 2016 - Balaganesh Damodaran <trashpanda@bgdam.com>
 * ISC Licensed
 */

'use strict';

/**
 * TrashPanda Application
 * Not to be instantiated directly.
 * Always call TrashPanda() to get an instance.
 */

let EventEmitter = require('eventemitter3');
let mixin = require('merge-descriptors');
let merge = require('utils-merge');
let pathUtil = require('path');

let _debug = require('debug');
let debug = _debug('app');

let utils = require('./utils');
let Router = require('./router');
let Request = require('./request');
let Response = require('./response');
let MockDependency = require('./mockDependency');

/**
 * Application constants
 */

const defaultMountPath = '/';
const states = {
	loaded: 'loaded',
	inited: 'inited',
	preInit: 'preInit'
};

/**
 * Shared Private variables
 */

let apps = {};
let mocks = {};
let authoritativeApp;
let view = {
	engines: {},
	cache: {}
};
let mountNode;

function getDefaultSettings() {
	let settings = {
		'case sensitive routing': false,
		env: (window.env && (window.env.TRASHPANDA_ENV || window.env.NODE_ENV)) || 'development',
		etag: 'weak',
		'jsonp callback name': 'callback',
		'json replacer': null,
		'json spaces': 0,
		'query parser': 'extended',
		'strict routing': false,
		'subdomain offset': 2,
		views: null,
		'view engine': null,
		'x-powered-by': true,
	};

	settings['view cache'] = settings.env === 'production';

	return settings;
};

function resolveMockDependencies(dependencyNames, mocks) {
	if (!dependencyNames)
		return [];

	if (!(utils.isArrayOfStrings(dependencyNames)))
		throw new Error('Application dependencies should be an array of dependency names.');

	let resolvedMocks = dependencyNames.map(name => {
		if (!mocks.hasOwnProperty(name))
			mocks[name] = MockDependency(name);

		return mocks[name];
	});

	return resolvedMocks;
};

function resolveDependencies(dependencyNames, apps) {
	if (!(utils.isArrayOfStrings(dependencyNames)))
		throw new Error('Application dependencies should be an array of dependency names.');

	let resolvedDependencies = dependencyNames.map(name => {
		if (!apps.hasOwnProperty(name))
			throw new Error(`Dependency ${name} not available or was not inited properly.`);

		return apps[name];
	});

	return resolvedDependencies;
};

function initApps(app, mocks, apps, rootApp) {
	rootApp = rootApp || (app.root ? app : null);

	app.childApps.forEach(child => {
		initApps(child, mocks, apps, rootApp);
	});

	if (app.state == states.preInit) {
		debug(`Initing app ${app.name}...`);

		app.dependencies = resolveMockDependencies(app.dependencies, mocks);
		app.state = states.inited;
		apps[app.name] = app;
		app.emit('init', app);

		debug(`Initing app ${app.name}...[DONE]`);
	}
};

function doOnApps(apps, action) {
	let appNames = Object.keys(apps);
	appNames.forEach(appName => action(apps[appName]));
};

function loadApps(apps) {
	debug('Loading apps...');

	doOnApps(apps, app => {
		debug(`Loading app ${app.name}...`);

		if (app.state == states.inited) {
			app.dependencies = resolveDependencies(app.dependencies, apps);
			app.state = states.loaded;
			app.emit('load', app);
		}

		debug(`Loading app ${app.name}...[DONE]`);
	});

	debug('Loading apps...[DONE]');
};

function reconcileMocksWithApps(mocks, apps) {
	debug('Reconciling event handlers...');

	doOnApps(apps, app => {
		debug(`Reconciling event handlers for app ${app.name}...`);

		let mock = mocks[app.name];
		if (mock)
			mock.reconcile(app);

		debug(`Reconciling event handlers for app ${app.name}...[DONE]`);
	});

	debug('Reconciling event handlers...[DONE]');
};

function resolveUrl(app, url, target = null, method = 'get', data = null, callback) {
	debug(`Resolving url: ${url}...`);

	function next(err, status, data, redirectUrl) {
		if (err)
			debug(`Error while resolving ${url}:\n${err.message}\n${err.stack}`);
		else {
			debug(`Resolving url: ${url}... [Done][${status}] +NNNms`);

			if (redirectUrl)
				return resolveUrl(app, redirectUrl, callback);
		}

		callback && callback(err, data);
	};

	let req = Request({
		app: app,
		url: url,
		router: app.router,
		method: method,
		data: data,
		target: target
	});
	let res = Response({
		app: app,
		req: req,
		router: app.router,
		callback: next
	});

	return app.router.resolve(req, res, next);
};

function setAsAuthoritativeApp(app) {
	authoritativeApp = app;
};

function setupRoutingHelpers(app, mountNode) {
	/**
	 * Adds mutation observers to mountNode.
	 * If any anchor tag gets added, attaches a click
	 * event listener, which routes the url change
	 * through app.router.
	 */

	if (!utils.isObjectOfType(mountNode, window.Node))
		throw new Error('Mount node has to be a Node (see https://developer.mozilla.org/en/docs/Web/API/Node).');

	function route(ev) {
		let node = ev.currentTarget;
		if (!node)
			return;

		let href = node.getAttribute('href');
		if (!href)
			return;

		let target = node.getAttribute('target');
		let authoritativeApp = app.getAuthoritativeApp();

		if (!authoritativeApp)
			throw new Error('No authoritative app found. Invalid application state.');

		let routedLocally = authoritativeApp.resolveUrl(href, null, target);

		//If app can handle routing, suppress browser redirection
		if (routedLocally)
			ev.preventDefault();
	};

	let observer = new MutationObserver(records => {
		records.forEach(record => {
			Array.prototype.forEach.call(record.addedNodes, node => {
				if (utils.isObjectOfType(node, window.HTMLAnchorElement))
					node.addEventListener('click', route);
			});
		});
	});

	observer.observe(document.documentElement, {
		childList: true,
		subtree: true
	});
};

function setupRootApp(app, mountNode) {
	setAsAuthoritativeApp(app);
	setupRoutingHelpers(app, mountNode);
};

function factory(opts, force) {
	//Why no ES6 classes? Because its not possible to dynamically
	//define methods using class syntax

	let router;
	let childApps = [];

	function TrashPandaApplication(opts) {
		if (force !== true)
			throw new Error('TrashPandaApplication cannot be instantiated directly. Use \'TrashPanda({name:<myApp>})\' to get a new TrashPandaApplication.');

		if (!(opts && opts.name))
			throw new Error('TrashPandaApplication\'s must have a name property. Ex: TrashPanda({name:<myApp>}).');

		EventEmitter.call(this);

		this.mountPath = defaultMountPath;
		this.state = states.preInit;

		Object.defineProperty(this, 'name', {
			enumerable: true,
			configurable: false,
			get: function() {
				return opts.name;
			}
		});

		this.locals = {
			settings: getDefaultSettings()
		};

		this.on('mount', (parentApp) => {
			this._parent = parentApp;
		});
	};

	let prototype = Object.create(EventEmitter.prototype);
	TrashPandaApplication.prototype = prototype;

	let emitEvent = TrashPandaApplication.prototype.emit;

	TrashPandaApplication.prototype.emit = function(...params) {
		let exemptedEvents = ['mount', 'init'];

		if (exemptedEvents.indexOf(params[0]) == -1 && this.state != states.loaded)
			throw new Error(`Cannot emit events if application state is not '${states.loaded}'`);

		emitEvent.call(this, ...params);
	};

	Object.defineProperty(TrashPandaApplication.prototype, 'router', {
		enumerable: true,
		configurable: false,
		get: function() {
			router = router || Router({
				app: this,
				setAsAuthoritativeApp: setAsAuthoritativeApp.bind(null, this),
				sensitive: this.get('case sensitive routing'),
				strict: this.get('strict routing')
			});
			return router;
		}
	});

	Object.defineProperty(TrashPandaApplication.prototype, 'childApps', {
		enumerable: true,
		configurable: false,
		get: function() {
			return childApps;
		}
	});

	/**
	 * Route related methods
	 * These are just proxied through to the router
	 */
	[
		'route',
		'resolve',
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
	].forEach((methodName) => {
		TrashPandaApplication.prototype[methodName] = function(...params) {
			this.router[methodName](...params);
		};
	});

	/**
	 * Settings related methods
	 */
	TrashPandaApplication.prototype.disable = function(name) {
		this.set(name, false);
	};
	TrashPandaApplication.prototype.disabled = function(name) {
		return !this.enabled(name);
	};
	TrashPandaApplication.prototype.enable = function(name) {
		this.set(name, true);
	};
	TrashPandaApplication.prototype.enabled = function(name) {
		return utils.toBoolean(this.get(name));
	};
	TrashPandaApplication.prototype.get = function(name, callback) {
		if (utils.isString(name) && !callback)
			return this.locals.settings[name];

		this.router.get(...arguments);
	};
	TrashPandaApplication.prototype.set = function(name, value) {
		this.locals.settings[name] = value;
	};

	TrashPandaApplication.prototype.engine = function(ext, renderer) {
		// Set files of extension ext to be rendered by renderer
		var extIsArray = utils.isArrayOfStrings(ext);
		if (!(extIsArray || utils.isString(ext)))
			throw new Error('Extension should be a string or an array of strings.');
		if (!utils.isFunction(renderer))
			throw new Error('Renderer should be a function.');

		ext = extIsArray ? ext : [ext];
		ext.forEach((extName) => view.engines[extName] = renderer);
	};

	TrashPandaApplication.prototype.load = function(waitForDOMContentLoaded = true, _mountNode = document.body, callback) {
		var that = this;

		function loadApplication(ev = null, callback = callback) {
			debug('Initing application...');

			that.root = true;
			mountNode = _mountNode;

			setupRootApp(that, mountNode);

			initApps(that, mocks, apps, that);
			reconcileMocksWithApps(mocks, apps);
			loadApps(apps);

			debug('Initing application...[DONE]');

			resolveUrl(that, window.location.href);

			if (utils.isFunction(callback))
				callback();
		};

		if (!waitForDOMContentLoaded)
			return loadApplication();

		debug('Waiting for DOMContentLoaded to fire before initing application...');
		window.addEventListener('DOMContentLoaded', function(ev) {
			debug('DOMContentLoaded fired.');
			loadApplication(ev);
		});
	};

	TrashPandaApplication.prototype.render = function(viewName, options = {}, callback) {
		//Renders the given view
		let ext = pathUtil.extname(viewName);

		let engine = view.engines[ext];
		if (!engine) {
			engine = this.get('view engine');
			if (!engine)
				throw new Error(`No view engine available for file extension '${ext}'. Register an engine for this file extension by using 'app.engine'.`);
			else
				debug(`No view engine available for file extension '${ext}'. Using default view engine. Register an engine for this file extension by using 'app.engine'.`);
		}

		let renderOpts = {};
		merge(renderOpts, this.locals);
		merge(renderOpts, options._locals);
		merge(renderOpts, options);

		renderOpts.cache = !renderOpts.hasOwnProperty('cache') ? this.enabled('view cache') : renderOpts.cache;

		function render(compiledView, options, callback) {
			let renderableView = compiledView(options);

			if (renderOpts.mount) {
				if (utils.isFunction(engine.mount))
					engine.mount(mountNode, renderableView);
				else
					mountNode.innerHTML = renderableView;
			}

			callback(null, renderableView, renderOpts);
		};

		function compileAndRender(viewTemplate, options, callback) {
			let compiledView = engine.compile(viewTemplate, options);

			if (renderOpts.cache)
				view.cache[viewName] = compiledView;

			render(compiledView, options, callback);
		};

		if (renderOpts.cache) {
			let _view = view.cache[viewName];
			render(_view, renderOpts, callback);
		} else {
			let viewTemplate = this.get('views');

			//Check if viewName is the name of a view in viewTemplate
			if (utils.isObject(viewTemplate))
				viewTemplate = viewTemplate[viewName];

			if (utils.isObject(viewName))
				viewTemplate = viewName;

			//Else if viewTemplate not set, set it to builtin xhr helper
			//Allows you to make an ajax request for the viewName.
			//viewName should be an accessible url ofcourse.
			if (!viewTemplate)
				viewTemplate = utils.xhr;

			if (utils.isFunction(viewTemplate)) {
				viewTemplate(viewName, function(err, viewTemplate) {
					if (err)
						return callback(new Error(`Error occurred while looking up view ${viewName}:\n${err.message}\n${err.stack}`));

					compileAndRender(viewTemplate, renderOpts, callback);
				});
			} else
				compileAndRender(viewTemplate, renderOpts, callback);
		}
	};

	TrashPandaApplication.prototype.use = function(...routeHandlers) {
		let path;

		if (utils.isString(routeHandlers[0]) || utils.isArrayOfStrings(routeHandlers[0]))
			path = routeHandlers.shift();

		path = path || defaultMountPath;

		routeHandlers = utils.flattenArray(routeHandlers);

		routeHandlers.forEach(handler => {
			// Why not just use isObjectOfType?
			// Because TrashPandaApplication is dynamically defined,
			// so isObjectOfType would always return false, unless
			// the definition is cached, which would cause issues with
			// 'private' variables.
			var handlerIsApp = utils.isTrashPandaApplication(handler);

			if (!(handlerIsApp || utils.isFunction(handler)))
				throw new Error('Middleware should be a function or a TrashPandaApplication.');

			if (!handlerIsApp)
				return this.router.use(path, handler);

			childApps.push(handler);

			(function propagateLocals(app) {
				let mergedLocals = {};

				merge(mergedLocals, app.locals);
				merge(mergedLocals, handler.locals);

				handler.locals = mergedLocals;
			})(this);

			if (handler.mountPath == defaultMountPath)
				handler.mountPath = path;
			else {
				handler.mountPath = utils.isArray(handler.mountPath) ? handler.mountPath : [handler.mountPath];
				//handler.mountPath.push(utils.isArray(path) ? ...path : path); //Babel can't handle this so use below instead
				utils.isArray(path) ? handler.mountPath.push(...path) : handler.mountPath.push(path);
			}

			this.router.use(path, handler.resolve.bind(handler));

			if (handler.emit && utils.isFunction(handler.emit))
				handler.emit('mount', this);
		});
	};

	/**
	 * Route triggering methods
	 */

	TrashPandaApplication.prototype.resolveUrl = function(url, data = null, target = null, callback) {
		if (authoritativeApp != this) {
			let err = new Error(`${this.name} does not have authority to initiate redirections. Get the authoritative app using 'app.getAuthoritativeApp()'.`);
			err.code = 'NOAUTHORITY';
			return callback(err);
		}

		if (utils.isFunction(url))
			url = url();

		if (!utils.isString(url))
			throw new Error('url should be a string or a function returning a string.');

		let method = data ? 'post' : 'get';
		return resolveUrl(this, url, target, method, data, callback);
	};

	TrashPandaApplication.prototype.getAuthoritativeApp = function() {
		// TODO: Implement permissions and prevent apps
		// without appropriate permissions from getting authoritativeApp.
		return authoritativeApp;
	};

	return new TrashPandaApplication(opts);
};

module.exports = factory;
