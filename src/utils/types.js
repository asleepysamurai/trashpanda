'use strict';

/**
 * Type Helpers
 */

function isType(value, typeName) {
	return Object.prototype.toString.call(value) === `[object ${typeName}]`;
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
	return typeof value == 'object' && value != null;
};

function isObjectOfType(value, _Class) {
	return isObject(value) && value instanceof _Class;
};

function toBoolean(value) {
	return !!value;
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

function hasProperties(value, properties) {
	if (!value.hasOwnProperty)
		return false;

	let missingProperties = properties.filter(property => value.hasOwnProperty(property));
	return !missingProperties.length;
};

function isTrashPandaApplication(value) {
	return hasProperties(value, ['use', 'load', 'engine']);
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
	hasProperties: hasProperties,
	isTrashPandaApplication: isTrashPandaApplication,
	flattenArray: flattenArray
};
