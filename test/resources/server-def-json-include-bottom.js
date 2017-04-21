'use strict';
const path = require('path');
module.exports = {
	types: {
		DependendType: {
			struct: {
				key: 'Test'
			}
		},
		Test: {
			struct: {
				'mode': 'RenderMode',
				'width': 'int',
				'height': 'int'
			}
		}
	},
	import: [
		path.join(__dirname, 'server-def-json.js')
	]
};
