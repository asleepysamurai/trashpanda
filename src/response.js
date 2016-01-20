/*!
 * TrashPanda
 * Copyright(c) 2016 - Balaganesh Damodaran <trashpanda@bgdam.com>
 * ISC Licensed
 */

'use strict';

/**
 * TrashPanda Response
 */

let pathToRegex = require('path-to-regexp');
let merge = require('utils-merge');
let utils = require('./utils');

let _debug = require('debug');
let debug = _debug('response');

function factory(opts) {
	let callback;
	let status;
	let responseEnded;

	function TrashPandaResponse(opts) {
		this.app = opts.app;
		this.req = opts.req;
		this.router = opts.router;

		callback = opts.callback;
		responseEnded = false;

		this.locals = {};
	};

	TrashPandaResponse.prototype.end = function(data, redirectUrl) {
		if (responseEnded) {
			let err = new Error('Response already sent. Cannot resend.');
			err.code = 'CANTRESEND';
			return callback(err);
		}

		this.status(status || 200);
		responseEnded = true;
		this.router.setAsAuthoritativeRouter();

		if (utils.isFunction(callback))
			callback(null, status, data, redirectUrl);

		return this;
	};

	['json', 'send'].forEach(methodName => {
		TrashPandaResponse.prototype[methodName] = function() {
			return this.end(...arguments);
		}
	});

	TrashPandaResponse.prototype.redirect = function(status = 302, url) {
		return this.status(status).end(null, url);
	};

	TrashPandaResponse.prototype.render = function(view, locals = {}, callback) {
		let renderOpts = {
			_locals: locals,
			mount: !callback
		};

		this.app.render(view, renderOpts, callback || ((err, renderedView) => {
			if (!err)
				return this.status(200).send(renderedView);

			var errMsg = `Render failed with error:\n${err.message}\n${err.stack}`;
			debug(errMsg);
			return this.status(500).send(errMsg);
		}));
	};

	TrashPandaResponse.prototype.sendStatus = function(status) {
		let statusMap = {
			100: 'Continue',
			101: 'Switching Protocols',
			102: 'Processing',
			200: 'OK',
			201: 'Created',
			202: 'Accepted',
			203: 'Non-Authoritative Information',
			204: 'No Content',
			205: 'Reset Content',
			206: 'Partial Content',
			207: 'Multi-Status',
			208: 'Already Reported',
			226: 'IM Used',
			300: 'Multiple Choices',
			301: 'Moved Permanently',
			302: 'Found',
			303: 'See Other',
			304: 'Not Modified',
			305: 'Use Proxy',
			306: 'Switch Proxy',
			307: 'Temporary Redirect',
			308: 'Permanent Redirect',
			308: 'Resume Incomplete',
			400: 'Bad Request',
			401: 'Unauthorized',
			402: 'Payment Required',
			403: 'Forbidden',
			404: 'Not Found',
			405: 'Method Not Allowed',
			406: 'Not Acceptable',
			407: 'Proxy Authentication Required',
			408: 'Request Timeout',
			409: 'Conflict',
			410: 'Gone',
			411: 'Length Required',
			412: 'Precondition Failed',
			413: 'Payload Too Large',
			414: 'URI Too Long',
			415: 'Unsupported Media Type',
			416: 'Range Not Satisfiable',
			417: 'Expectation Failed',
			418: 'I\'m a teapot',
			421: 'Misdirected Request',
			422: 'Unprocessable Entity',
			423: 'Locked',
			424: 'Failed Dependency',
			426: 'Upgrade Required',
			428: 'Precondition Required',
			429: 'Too Many Requests',
			431: 'Request Header Fields Too Large',
			451: 'Unavailable For Legal Reasons',
			500: 'Internal Server Error',
			501: 'Not Implemented',
			502: 'Bad Gateway',
			503: 'Service Unavailable',
			504: 'Gateway Timeout',
			505: 'HTTP Version Not Supported',
			506: 'Variant Also Negotiates',
			507: 'Insufficient Storage',
			510: 'Not Extended',
			511: 'Network Authentication Required'
		};

		statusDescription = statusMap[status] || status;
		return this.status(status).send(statusDescription);
	};

	TrashPandaResponse.prototype.status = function(statusCode) {
		status = statusCode;
		return this;
	};

	TrashPandaResponse.prototype.update = function(opts) {
		merge(this, opts);
	};

	return new TrashPandaResponse(opts);
};

module.exports = factory;
