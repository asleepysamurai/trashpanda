'use strict';

/**
 * TrashPanda Entry Point
 */

let Application = require('./application');

function factory(opts) {
	/**
	 * Why use a factory instead of just calling TrashPanda directly?
	 * Future proofing in case we need to add private methods later.
	 */
	function TrashPanda(opts) {
		return Application(opts, true);
	};

	return TrashPanda(opts);
};

module.exports = factory;
