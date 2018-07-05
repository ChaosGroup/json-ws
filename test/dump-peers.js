'use strict';

const packageJson = require('../package.json');

const peerDependencies = packageJson.peerDependencies || {};

const peersToInstall = [];
for (const peerDependency in peerDependencies) {
	peersToInstall.push(peerDependency + '@' + peerDependencies[peerDependency]);
}

console.log(peersToInstall.join('\n')); // eslint-disable-line no-console
