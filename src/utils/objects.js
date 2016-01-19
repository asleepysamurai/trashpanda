'use strict';

/**
 * Object Helper Utilities
 * Provides standard getters and setters
 */

import types from './types';

let setters = {
	boolean: function(key, value) {
		this[key] = type.toBoolean(value);
	},
	string: function(key, value) {
		this[key] = type.toString(value);
	},
	integer: function(key, value) {
		this[key] = type.toInteger(value);
	}
};

let getters = {
	private: function(key) {
		return this[key];
	}
};

export {
	setters,
	getters
};
