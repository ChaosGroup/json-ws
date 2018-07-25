module.exports = {
	enums: {
		RenderMode: {
			description: 'RenderMode',
			struct: {
				Production: -1,
				RtCpu: 0,
			},
		},
	},

	types: {
		RenderOptions: {
			struct: {
				mode: 'RenderMode',
				width: 'int',
				height: 'int',
			},
		},
	},

	events: {
		ontest: 'test event',
	},

	methods: {
		sum: 'Returns the sum of two numbers',
	},
};
