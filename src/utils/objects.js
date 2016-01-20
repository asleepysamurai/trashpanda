'use strict';

/**
 * Object Helper Utilities
 * Provides standard getters and setters
 */

let types = require('./types');

let setters = {
	boolean: function(key, value) {
		this[key] = types.toBoolean(value);
	},
	string: function(key, value) {
		this[key] = types.toString(value);
	},
	integer: function(key, value) {
		this[key] = types.toInteger(value);
	}
};

let getters = {
	private: function(key) {
		return this[key];
	}
};

module.exports = {
	setters: setters,
	getters: getters
};
