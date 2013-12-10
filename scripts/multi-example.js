"use strict";

var Bronto = require('../index.js');
var redis = require('redis');

var client = redis.createClient();
var subscriber = redis.createClient();

var names = ['Hugo', 'Simon', 'Casper', 'Fredrik'];
var bullies = [];

names.forEach(goForIt);

function goForIt(name) {
  var me = new Bronto({
    client: client,
    subscriber: subscriber
  });
  bullies.push(me);

  me.on('master', function becameMaster(election) {
    console.log(name, 'is now the mayor of', election);
  });

  me.on('stepped_down', function becameMaster(election) {
    console.error(name, 'has stepped down as the mayor of', election);
  });

  console.log(name, 'is running for office');
  me.join('Malmö');
  me.join('Køpenhavn');
}

process.on('SIGINT', function caughtSigint() {
  console.log('Closing down');
  var count = bullies.length;

  bullies.forEach(function stepDown(bully) {
    bully.stepDown(steppedDown);
  });

  function steppedDown() {
    count--;
    if (!count) {
      process.exit(0);
    }
  }
});
