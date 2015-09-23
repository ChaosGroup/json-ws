'use strict';

var gulp = require('gulp');
var eslint = require('gulp-eslint');
var mocha = require('gulp-mocha');
var istanbul = require('gulp-istanbul');
var _ = require('lodash');

var JS_FILES_GLOBS = [
	'**/*.js',
	'!node_modules/**/*',
	'!static/**/*',
	'!test/**/*',
	'!output/**/*',
	'!proxies/**/*'
];

var mochaFixCallback = function(callback) {
	return _.once(function(err) {
		callback(err);
		// Give time to gulp to execute the callback, then exit
		setTimeout(process.exit.bind(process, err ? 1 : 0), 100);
	});
};

gulp.task('lint', function() {
	return gulp
		.src(JS_FILES_GLOBS)
		.pipe(eslint())
		.pipe(eslint.format())
		.pipe(eslint.failOnError());
});

gulp.task('test', function(callback) {
	gulp.src(['test/server.js', 'test/client.js'], { read: false })
		.pipe(mocha())
		.once('error', mochaFixCallback(callback))
		.once('end', mochaFixCallback(callback));
});

gulp.task('cover', function(callback) {
	gulp.src(JS_FILES_GLOBS.concat(['!gulpfile.js', '!client.js']))
		.pipe(istanbul({
			includeUntested: true
		}))
		.pipe(istanbul.hookRequire()) // Force 'require' to return covered files
		.on('finish', function() {
			gulp.src(['test/server.js', 'test/client.js'])
				.pipe(mocha())
				.once('error', mochaFixCallback(callback))
				.pipe(istanbul.writeReports({
					dir: './output/coverage',
					reporters: ['html']
				}))
				.once('error', mochaFixCallback(callback))
				.once('end', mochaFixCallback(callback));
		});
});
