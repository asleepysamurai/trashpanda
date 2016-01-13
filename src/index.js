'use strict';

/**
 * TrashPanda Entry Point
 */

import Application from './application';

export
default class TrashPanda {
	constructor() {
		return new(Application(true))();
	}
};
