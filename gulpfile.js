'use strict';

/**
 * TrashPanda gulpfile
 * Use --production flag to get production standlone builds.
 * Use --standalone flag to get development standalone builds.
 */

var gulp = require('gulp');
var gutil = require('gulp-util');
var chalk = require('chalk');
var prettyTime = require('pretty-hrtime');
var sourcemaps = require('gulp-sourcemaps');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var browserify = require('browserify');
var watchify = require('watchify');
var babel = require('babelify');
var argv = require('yargs').argv;
var gulpif = require('gulp-if');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');

var exportName = 'TrashPanda';

function logStart(e) {
	gutil.log('Starting', '\'' + chalk.cyan(e.task) + '\'...');
};

function logDone(e) {
	var time = prettyTime(e.duration);
	gutil.log(
		'Finished', '\'' + chalk.cyan(e.task) + '\'',
		'after', chalk.magenta(time)
	);
};

function compile(watch, debug) {
	var opts = {
		debug: argv.production,
		standalone: argv.production || argv.standalone ? exportName : null
	};

	var bundler = watchify(browserify('./src/index.js', opts)
		.transform(babel.configure({
			presets: ['es2015']
		})));

	function rebundle() {
		var startTime = process.hrtime();
		var e = {
			task: 'browserify bundling',
		};

		logStart(e);
		bundler.bundle()
			.on('error', function(err) {
				console.error(err.codeFrame ? err.message + '\n' + err.codeFrame : err);
			})
			.on('end', function() {
				e.duration = process.hrtime(startTime);
				logDone(e);
			})
			.pipe(source('build.js'))
			.pipe(buffer())
			.pipe(gulpif(argv.production, uglify().on('error', gutil.log)))
			.pipe(gulpif(argv.production, rename({
				suffix: '.min'
			})))
			.pipe(gulpif(!argv.production, sourcemaps.init({
				loadMaps: true
			})))
			.pipe(gulpif(!argv.production, sourcemaps.write('./')))
			.pipe(gulp.dest('./build').on('end', function() {
				logDone({
					task: 'write',
					duration: process.hrtime(startTime)
				});
				if (!watch)
					process.exit(0);
			}));
	}

	if (watch) {
		bundler.on('update', function() {
			console.log('-> bundling...');
			rebundle();
		});
	}

	rebundle();
}

function watch() {
	return compile(true);
};

gulp.task('build', function() {
	return compile();
});
gulp.task('watch', function() {
	return watch();
});

gulp.task('default', [argv.production ? 'build' : 'watch']);
