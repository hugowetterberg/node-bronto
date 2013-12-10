"use strict";

var lib = {
  events: require('events'),
  util: require('util'),
  bully: require('bully'),
  redis: require('redis'),
  uuid: require('uuid'),
  winston: require('winston'),
};

function RedisBully(options) {
  lib.events.EventEmitter.call(this);

  options = options || {};

  this.client = options.client || lib.redis.createClient();
  this.subscriber = options.subscriber || lib.redis.createClient();
  this.channel = options.channel || 'redisbully:events';
  this.elections = {};

  // Subscribe to the redis channel
  this.subscriber.subscribe(this.channel);
  this.subscriber.on('message', function(channel, message) {
    // We should be able to share the same subscribe-connection to redis with
    // other components.
    if (channel == this.channel) {
      var msg = JSON.parse(message);

      // Tell the relevant election what's what.
      if (this.elections[msg.election]) {
        this.elections[msg.election].handleMessage(msg);
      }
    }
  }.bind(this));
}
lib.util.inherits(RedisBully, lib.events.EventEmitter);

RedisBully.prototype.join = function (name) {
  if (!this.elections[name]) {
    var election = new Election(this, name);
    this.elections[name] = election;
  }
  return this.elections[name];
};

RedisBully.prototype.stepDown = function (callback) {
  for (var name in this.elections) {
    this.elections[name].stepDown();
  }
  if (typeof callback == 'function') {
    callback();
  }
};

function Election(coordinator, name) {
  this.id = lib.uuid.v4();
  this.name = name;
  this.coordinator = coordinator;
  this.bully = new lib.bully({
    me: new PeerDelegate(this, this.id),
    id: this.id
  });

  this.bully.on('master', function becomingMaster() {
    coordinator.emit('master', name);
  });
  this.bully.on('stepped_down', function steppingDown() {
    coordinator.emit('stepped_down', name);
  });

  this.bully.on('error', function bullyError(error) {
    lib.winston.error('Bully error in', this.name, this.id, error.message);
  }.bind(this));

  this.peers = {};
  this.peers[this.id] = this.bully.me;

  // Tell everybody we're running for office
  this.tellEveryone('join');
}

Election.prototype.stepDown = function() {
  this.bully.stepDown();
  this.tellEveryone('leaving');
};

Election.prototype.tellPeer = function(id, event) {
  if (id == this.id) {
    // You don't need to send yourself a message, get a grip.
    return;
  }

  var message = {
    event: event,
    target: id,
    election: this.name,
    sender: this.id
  };
  this.coordinator.client.publish(this.coordinator.channel, JSON.stringify(message));
};

Election.prototype.tellEveryone = function(event) {
  var message = {
    event: event,
    election: this.name,
    sender: this.id
  };
  this.coordinator.client.publish(this.coordinator.channel, JSON.stringify(message));
};

Election.prototype.handleMessage = function(message) {
  // We don't want to listen to ourselves talk,
  // recordings always sound so strange.
  if (message.sender == this.id) return;

  // We trust our message bus. If they can send messages they exist
  if (!this.peers[message.sender]) {
    this.addPeer(message.sender);
  }

  if (!message.target) {
    if (message.event == 'join') {
      // Somebody else is wants to lay claim to what's rightly ours,
      // let them believe that this will be a fair fight.
      this.tellPeer(message.sender, 'welcome');
    }
    else if (message.event == 'leaving') {
      // Another one bites the dust, write this off as a win!
      this.removePeer(message.sender);
    }
  }
  else if (this.peers[message.target]) {
    // Forward incoming messages to the correct delegate. Unread, of course,
    // gentlemen do not read each other's mail.
    this.peers[message.target].remoteEvent(message.event, {id:message.sender});
  }
};

Election.prototype.addPeer = function(id) {
  var peer = new PeerDelegate(this, id);
  this.peers[id] = peer;
  this.bully.addPeer(peer);
  return peer;
};

Election.prototype.removePeer = function(id) {
  delete this.peers[id];
  this.bully.removePeer(id);
};

// The delegates talk on behalf of the important people that want
// to get elected.
function PeerDelegate(election, id) {
  lib.events.EventEmitter.call(this);

  this.election = election;
  this.id = id;
};
lib.util.inherits(PeerDelegate, lib.events.EventEmitter);

PeerDelegate.prototype.remoteEvent = function(event, payload) {
  // Emit the event directly using the emitter prototype so that we don't
  // create an infinite echo loop.
  lib.events.EventEmitter.prototype.emit.call(this, event, payload);
};

PeerDelegate.prototype.emit = function(event, payload) {
  // Transmit the message home to the candidate.
  this.election.tellPeer(this.id, event);
  // And emit the event locally (remember that we filter out messages from
  // ourselves, so this won't result in a duplicate event).
  lib.events.EventEmitter.prototype.emit.apply(this, arguments);
};

module.exports = RedisBully;
