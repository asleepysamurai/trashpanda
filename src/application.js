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

import EventEmitter from 'eventemitter3';
import mixin from 'merge-descriptors';
import merge from 'utils-merge';
import pathUtil from 'path';

import _debug from 'debug';
let debug = _debug('app');

import utils from './utils';
import Request from './request';
import Response from './response';
import MockDependency from './mockDependency';

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

function getDefaultSettings() {
	let settings = {
		'case sensitive routing': false,
		env: window.env.TRASHPANDA_ENV || window.env.NODE_ENV || 'development',
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

resolveMockDependencies = function(dependencyNames, mocks) {
	if (!(utils.isArrayOfStrings(dependencyNames)))
		throw new Error('Application dependencies should be an array of dependency names.');

	let resolvedMocks = dependencyNames.map(name => {
		if (!mocks.hasOwnProperty(name))
			mocks[name] = MockDependency(name);

		return mocks[name];
	});

	return resolvedMocks;
};

resolveDependencies = function(dependencyNames, apps) {
	if (!(utils.isArrayOfStrings(dependencyNames)))
		throw new Error('Application dependencies should be an array of dependency names.');

	let resolvedDependencies = dependencyNames.map(name => {
		if (!apps.hasOwnProperty(name))
			throw new Error('Dependency ${name} not available or was not inited properly.');

		return apps[name];
	});

	return resolveDependencies;
};

function initApps(app, mocks, apps, rootApp) {
	rootApp = rootApp || (app.root ? app : null);

	app.childApps.forEach(child => {
		initApps(child, mocks, apps, rootApp);
	});

	if (app.state == states.preInit) {
		debug('Initing app ${app.name}...');

		app.dependencies = resolveMockDependencies(app.dependencies, mocks);
		app.state = states.inited;
		apps[app.name] = app;
		app.emit('init');

		debug('Initing app ${app.name}...[DONE]');
	}
};

function doOnApps(apps, action) {
	let appNames = Object.keys(apps);
	appNames.forEach(appName => action(apps[appName]));
};

function loadApps(apps) {
	debug('Loading apps...');

	doOnApps(apps, app => {
		debug('Loading app ${app.name}...');

		if (app.state == states.inited) {
			app.dependencies = resolveDependencies(app.dependencies, apps);
			app.state = states.loaded;
			app.emit('load');
		}

		debug('Loading app ${app.name}...[DONE]');
	});

	debug('Loading apps...[DONE]');
};

function reconcileMocksWithApps(mocks, apps) {
	debug('Reconciling event handlers...');

	doOnApps(apps, app => {
		debug('Reconciling event handlers for app ${app.name}...');

		let mock = mocks[app.name];
		if (mock)
			mock.reconcile(app);

		debug('Reconciling event handlers for app ${app.name}...[DONE]');
	});

	debug('Reconciling event handlers...[DONE]');
};

function resolveUrl(app, url, method = 'get', data = null, callback) {
	debug('Resolving url: ${url}...');

	function next(err, status, data, redirectUrl) {
		if (err)
			debug('Error while resolving ${url}:\n${err.message}\n${err.stack}');
		else {
			debug('Resolving url: ${url}... [Done][${status}] +NNNms');

			if (redirectUrl)
				return resolveUrl(app, redirectUrl);
		}

		callback && callback(err, data);
	};

	let req = Request({
		app: app,
		url: url,
		method: method,
		data: data
	});
	let res = Response({
		app: app,
		req: req,
		callback: next
	});

	app.router.resolve(req, res, next);
};

function setAsAuthoritativeApp(app) {
	authoritativeApp = app;
};

function factory(force) {
	//Why no ES6 classes? Because its not possible to dynamically
	//define methods using class syntax

	let router;
	let childApps = [];
	let mountNode;
	let name;

	function TrashPandaApplication(opts) {
		if (new.target && force !== true)
			throw new Error('TrashPandaApplication cannot be instantiated using the new keyword. Use \'TrashPanda({name:<myApp>})\' to get a new TrashPandaApplication.');

		if (!(opts && opts.name))
			throw new Error('TrashPandaApplication\'s must have a name property. Ex: TrashPanda({name:<myApp>}).');

		EventEmitter.call(this);

		this.mountPath = defaultMountPath;
		this.state = states.preInit;

		Object.defineProperty(this, 'name', {
			enumerable: true,
			configurable: false,
			get: function() {
				return name;
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

	TrashPandaApplication.prototype.emit = function(...params) {
		if (this.state != states.loaded)
			throw new Error('Cannot emit events if application state is not \'${states.loaded}\'');

		prototype.emit.call(this, ...params);
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
			return settings[name];

		this.router.get(...arguments);
	};
	TrashPandaApplication.prototype.set = function(name, value) {
		settings[name] = value;
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

	TrashPandaApplication.prototype.load = function(waitForDOMContentLoaded = true, mountNode = document.body, callback) {
		function loadApplication(ev = null, callback = callback) {
			debug('Initing application...');

			this.root = true;
			mountNode = mountNode;

			setAsAuthoritativeApp(this);
			initApps(this, mocks, this);
			reconcileMocksWithApps(mocks, apps);
			loadApps(this, apps, this);

			debug('Initing application...[DONE]');

			resolveUrl(this, window.location.href);
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
				throw new Error('No view engine available for file extension \'${ext}\'. Register an engine for this file extension by using \'app.engine\'.');
			else
				debug('No view engine available for file extension \'${ext}\'. Using default view engine. Register an engine for this file extension by using \'app.engine\'.');
		}

		renderOpts.merge(this.locals);
		renderOpts.merge(options._locals);
		renderOpts.merge(options);

		renderOpts.cache = !renderOpts.hasOwnProperty('cache') ? this.enabled('view cache') : renderOpts.cache;

		function render(compiledView, options, callback) {
			let renderableView = compiledView(options);

			if (renderOpts.mount)
				engine.mount(mountNode, compiledView);

			callback(null, renderableView, renderOpts);
		};

		function compileAndRender(viewTemplate, options, callback) {
			let compiledView = engine.compile(viewTemplate, options);

			if (renderOpts.cache)
				views.cache[viewName] = compiledView;

			render(compiledView, options, callback);
		};

		if (renderOpts.cache) {
			let _view = views.cache[viewName];
			render(_view, renderOpts, callback);
		} else {
			let viewTemplate = this.get('views');

			if (utils.isFunction(viewTemplate)) {
				viewTemplate(viewName, function(err, viewTemplate) {
					if (err)
						return callback(err);

					compileAndRender(viewTemplate, renderOpts, callback);
				});
			} else if (utils.isObject(viewTemplate)) {
				viewTemplate = viewTemplate[viewName];

				if (!viewTemplate)
					throw new Error('Failed to lookup view: ' + viewName);

				compileAndRender(viewTemplate, renderOpts, callback);
			}
		}
	};

	TrashPandaApplication.prototype.use = function(...routeHandlers) {
		let path;

		if (utils.isString(routeHandlers[0]) || utils.isArrayOfStrings(routeHandlers[0]))
			path = routeHandlers.shift();

		path = path || defaultMountPath;

		routeHandlers = utils.flattenArray(routeHandlers);

		routeHandlers.forEach(handler => {
			var handlerIsApp = utils.isObjectOfType(handler, TrashPandaApplication);

			if (!(handlerIsApp || utils.isFunction(handler)))
				throw new Error('Middleware should be a function or a TrashPandaApplication.');

			if (!handlerIsApp)
				return this.router.use(path, handler);

			childApps.push(handler);

			if (handler.mountPath == defaultMountPath)
				handler.mountPath = path;
			else {
				handler.mountPath = utils.isArray(handler.mountPath) ? handler.mountPath : [handler.mountPath];
				handler.mountPath.push(utils.isArray(path) ? ...path : path);
			}

			this.router.use(path, handler.resolve);

			if (handler.emit && utils.isFunction(handler.emit))
				handler.emit('mount', this);
		});
	};

	/**
	 * Route triggering methods
	 */

	TrashPandaApplication.prototype.redirect = function(url, data = null, callback) {
		if (authoritativeApp != this) {
			let err = new Error('${this.name} does not have authority to initiate redirections. Get the authoritative app using \'app.getAuthoritativeApp()\' and send it a \'requestRedirect\' message.')
			err.code = 'NOAUTHORITY';
			return callback(err);
		}

		if (utils.isFunction(url))
			url = url();

		if (!utils.isString(url))
			throw new Error('url should be a string or a function returning a string.');

		let method = data ? 'post' : 'get';
		resolveUrl(this, url, method, data, callback);
	};

	TrashPandaApplication.prototype.getAuthoritativeApp = function() {
		return authoritativeApp;
	};

	return new TrashPandaApplication(name);
};

export
default factory;
