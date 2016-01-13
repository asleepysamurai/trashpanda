/*!
 * TrashPanda
 * Copyright(c) 2016 - Balaganesh Damodaran <trashpanda@bgdam.com>
 * ISC Licensed
 */

'use strict';

/**
 * TrashPanda MockDependency
 * During app preInit, apps will get mockDependencies
 * rather than actual apps. This is to enable apps to
 * register event listeners on their dependencies, before
 * the dependencies start firing events.
 */

function factory(name) {
	let handlers = [];

	function MockDependency(name) {
		this.name = name;
	};

	MockDependency.prototype.on = function(eventName, handler, context) {
		handlers.push({
			eventName: eventName,
			handler: handler,
			context: context
		});
	};

	MockDependency.prototype.addListener = MockDependency.prototype.on;

	MockDependency.prototype.off = function(eventName, handler, context) {
		handlers = handlers.filter(handlerConfig => {
			return !(handlerConfig.eventName == eventName &&
				handlerConfig.handler == handler &&
				handlerConfig.context == context);
		});
	};

	MockDependency.prototype.removeListener = MockDependency.prototype.on;

	MockDependency.prototype.reconcile = function(app) {
		handlers.forEach(handlerConfig => {
			app.on(handlerConfig.eventName, handlerConfig.handler, handlerConfig.context);
		});
	};

	return new MockDependency(name);
};

export
default factory;
