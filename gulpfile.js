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

function compile(watch) {
	var bundler = watchify(browserify('./src/index.js', {
		debug: true
	}).transform(babel.configure({
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
			.pipe(sourcemaps.init({
				loadMaps: true
			}))
			.pipe(sourcemaps.write('./'))
			.pipe(gulp.dest('./build'));
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

gulp.task('default', ['watch']);
