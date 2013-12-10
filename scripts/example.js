"use strict";

var Bronto = require('../index.js');
var me = new Bronto();

me.on('master', function becameMaster(election) {
  console.log('I\'m now the mayor of', election);
});

me.on('stepped_down', function becameMaster(election) {
  console.error('I\'ve stepped down as the mayor of', election);
});

console.log('Running for office');
me.join('Malmö');
me.join('Køpenhavn');

process.on('SIGINT', function caughtSigint() {
  console.log('Closing down');
  me.stepDown(function steppedDown() {
    process.exit(0);
  });
});
