'use strict';
const path = require('path');
module.exports = {
	import: [path.join(__dirname, 'server-def-json.js')],
	types: {
		DependendType: {
			struct: {
				key: 'Test',
			},
		},
		Test: {
			struct: {
				mode: 'RenderMode',
				width: 'int',
				height: 'int',
			},
		},
	},
};
