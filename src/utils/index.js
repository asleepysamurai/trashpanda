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

module.exports = mergedUtils;
