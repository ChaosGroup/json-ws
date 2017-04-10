'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Returns object containing the file's content in the specified encoding for every file.
 * @param {Array.<string>} filesPaths Files paths relative or absolute to the static directory.
 * @param {string} encoding
 * @returns {Object}
 */
exports.getFilesContent = function (filesPaths, encoding) {
	encoding = encoding || 'utf8';
	const filesContent = {};
	for (const filePath of filesPaths) {
		let absPath = filePath;
		if (!path.isAbsolute(filePath)) {
			absPath = path.join(__dirname, filePath);
		}
		const fileContent = fs.readFileSync(absPath, encoding);
		filesContent[filePath] = fileContent;
	}
	return filesContent;
};
