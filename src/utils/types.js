'use strict';

/**
 * Type Helpers
 */

function isType(value, typeName) {
	return Object.prototype.toString.call(value) === '[object ${typeName}]';
};

function isBoolean(value) {
	return isType(value, 'Boolean');
};

function isString(value) {
	return isType(value, 'String');
};

function isArray(value) {
	return isType(value, 'Array');
};

function isArrayOfType(value, typeName) {
	if (isArray(value)) {
		var _isType = true;

		value.every(function(item) {
			_isType = isType(item, typeName);
			return _isType;
		});

		return _isType;
	}
	return false;
};

function isArrayOfStrings(value) {
	return isArrayOfType(value, 'String');
};

function isFunction(value) {
	return isType(value, 'Function');
};

function isObject(value) {
	return isType(value, 'Object');
};

function isObjectOfType(value, _Class) {
	return isObject(value) && value instanceof _Class;
};

function toBoolean(value) {
	return new Boolean(value);
};

function toString(value) {
	return new String(value);
};

function toInteger(value) {
	return new Number(parseInt(value));
};

function flattenArray(value) {
	return value.reduce((a, b) => {
		a = Array.isArray(a) ? a : [a];
		b = Array.isArray(b) ? b : [b];
		return a.concat(b);
	}, []);
};

module.exports = {
	toBoolean: toBoolean,
	toString: toString,
	toInteger: toInteger,
	isBoolean: isBoolean,
	isString: isString,
	isFunction: isFunction,
	isObject: isObject,
	isObjectOfType: isObjectOfType,
	isArray: isArray,
	isArrayOfStrings: isArrayOfStrings,
	flattenArray: flattenArray
};
