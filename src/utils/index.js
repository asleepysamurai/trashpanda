'use strict';

/**
 * Utility methods
 */

let merge = require('utils-merge');

let types = require('./types');
let objects = require('./objects');

let mergedUtils = {};
merge(mergedUtils, types);
merge(mergedUtils, objects);

mergedUtils.xhr = function xhr(url, callback) {
	try {
		let x = new XMLHttpRequest();
		x.open('GET', url);
		x.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
		x.onreadystatechange = () => {
			if (x.readyState < 4)
				return;

			if (types.isFunction(callback)) {
				if (x.status == 200)
					return callback(null, x.response);

				return callback(x);
			}
		};
		x.send();
	} catch (err) {
		if (types.isFunction(callback))
			callback(new Error(`XHR request failed:\n${err.message}\n${err.stack}`));
	}
};

module.exports = mergedUtils;
