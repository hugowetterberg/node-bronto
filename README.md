# Bronto - Bully for Redis

Bronto implements a redis backend for the [bully module](https://github.com/jaclar/bully). Discovery and events are handled through redis.

> “Scientists have power by virtue of the respect commanded by the discipline... We live with poets and politicians, preachers and philosophers. All have their ways of knowing, and all are valid in their proper domain. The world is too complex and interesting for one way to hold all the answers.” 
>
> ― Stephen Jay Gould, Bully for Brontosaurus: Reflections in Natural History

# Sample use

A simple example could look like this (see "scripts/example.js"):

    var Bronto = require('bronto');
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

You can run a couple of instances of this application to watch them duke it out in the two mayoral elections.

The RedisBully constructor accepts an options object with the following attributes:

* client: The redis client connection, used for publishing events.
* subscriber: The redis subscriber connection, used for subscriptions.
* channel: The name of the channel that should be used for events.

