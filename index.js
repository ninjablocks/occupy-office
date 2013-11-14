// The NinjaBlocks Driver

var server = require('./server');

var util = require('util');
var stream = require('stream');
var child = require('child_process');
var log4js = require('log4js');
var MeetingStore = require('./lib/MeetingStore');

var config = require('./config/config.json');

//var PusherClient = require('pusher-node-client').PusherClient;
//var request = require('request');

util.inherits(Driver,stream);
util.inherits(Device,stream);

var log = log4js.getLogger('Mappu - Driver');

function Driver(opts,app) {
  var self = this;

  this._devices = {};

  this.store = new MeetingStore(config.DatabaseURL);

  /*app.on('client::up', function() {
    self.syncDevices( );
    self.connectToPusher( );
  });*/

  var seen = {};
  app.on('device::up', function(guid, device) {
    if (!seen[guid] && device && device.V === 0 && device.D === 600) { // IAS Zone
      log.debug("Got ias device", device);
      seen[guid] = true;
      self.createDevices(device);
    }
  });

}

/*Driver.prototype.syncDevices = function() {
  var self = this;

  request('https://api.ninja.is/rest/v0/devices?user_access_token=' + config.NinjaAccessToken, function (error, response, body) {
    if ( !error && response.statusCode == 200 ) {
      var devices = JSON.parse(body).data;

      for ( var guid in devices ) {
        var devInfo = devices[guid];

        if ( devInfo && devInfo.vid == 0 && devInfo.did == 600 && typeof self._devices[guid] === 'undefined' ) {
          self.createDevices( devInfo );
          self._devices[guid] = true;
        }
      }
    }
  });
};

Driver.prototype.connectToPusher = function() {
  var self = this;

  if (this.pusher_client) {
    return;
  }

  this.pusher_client = new PusherClient( {
    appId: '',
    key: 'ccff70362850caf79c9f',
    secret: ''
  });

  log.info( 'Connecting to pusher...' );

  this.pusher_client.on( 'connect', function() {
    var channel = self.pusher_client.subscribe( config.PusherChannel );

    self.log.info( 'Subscribing to pusher updates...' );
    channel.on( 'data', function(data) {
      self.receivePush( data );
    } );
  } );

  this.pusher_client.connect();
};*/

Driver.prototype.createDevices = function(device) {

  log.info("Creating MeetingTimeDevice for IAS zone", device);

  var meetingLength = new MeetingTimeDevice(this, device, this.store);
  this.emit('register', meetingLength);

  //var roomUtilisation = new Device(4, 3, device.gid, 'Room Utilisation - ' + device.shortName);
  // TODO: DO THIS!
  //this.emit('register', roomUtilisation);

  /*var batteryAlert = new Device(4, 4, device.gid, 'Battery Alert - ' + device.shortName);
  this.on('data::' + device.gid, function(data) {
    log.debug( device.gid, 'ALERT', !!data[config.ZigbeeBatteryProperty] );
    this.emit('data', !!data[config.ZigbeeBatteryProperty]);
  }.bind(batteryAlert));
  this.emit('register', batteryAlert);

  var alarm = new Device(4, 5, device.gid, 'Alarm - ' + device.shortName);
  this.on('data::' + device.gid, function(data) {
    log.debug( device.gid, 'ALARM', !!data[config.ZigbeeAlarmProperty] );
    this.emit('data', !!data[config.ZigbeeAlarmProperty]);
  }.bind(alarm));
  this.emit('register', alarm);*/

};

/*Driver.prototype.receivePush = function(data) {
  if ( !data || !data.D || data.D != 600 ) {
    return; // we don't care about this device
  }

  this.emit( 'data::' + data.G, data.DA );
};*/

util.inherits(MeetingTimeDevice,stream);
function MeetingTimeDevice(driver, parentDevice, meetingStore) {
  var self = this;

  this.writeable = false;
  this.readable = true;
  this.V = 4;
  this.D = 2;
  this.G = parentDevice.G;
  this.name = 'Meeting Time - ' + parentDevice.G;

  driver.on('data::' + parentDevice.gid, this.onParentData.bind(this));
}

MeetingTimeDevice.prototype.guidToRoom = function(guid) {
  var floors = require('./config/app/floors.json'); // reload so it can be changed without restarting

  for ( var k in floors ) {
    var floor = floors[k];

    var geojson = require('./config/app/' + floor.geojson);

    var features = geojson.features;
    for ( var f in features ) {
      var feature = features[f];

      if ( feature.properties.device == guid ) {
        return feature.properties.room_id;
      }
    }
  }
};

MeetingTimeDevice.prototype.onParentData = function(data) {

    var wasOccupied = this.occupied;
    this.occupied = data[config.ZigbeeAlarmProperty];

    log.debug(this.G, "Was", wasOccupied, "now", this.occupied);

    // Room is occupied, so clear the minumum vacancy timeout
    if (this.occupied) {
      if (!this.meetingStart) {
        this.meetingStart = new Date().getTime();
      }
      clearTimeout(this.timeout);

      log.debug(this.G, 'clearing timeout');
    }

    // Room is newly empty
    if (wasOccupied && !this.occupied) {
      log.debug(this.G, 'starting timeout');
      this.timeout = setTimeout(function() {

          log.debug(this.G, ' timeout');
          // Meeting is over.
          var meetingTime = new Date().getTime() - this.meetingStart;

          // HACK HACK
          //meetingTime = meetingTime * 100 * 4;
          // HACK HACK

          log.debug("Recorded a meeting for ", this.G, (meetingTime/1000/60) + ' minutes');

          if (meetingTime > (config.MeetingMinimumLength * 1000)) {
            this.emit('data', meetingTime);

            this.store.saveMeeting(new Date(this.meetingStart), meetingTime, this.guidToRoom(this.G));
          }

          delete this.meetingStart;

      }.bind(this), config.RoomVacancyTime * 1000);
    }
};


function Device(v, d, g, name) {
  var self = this;

  this.writeable = false;
  this.readable = true;
  this.V = v;
  this.D = d;
  this.G = g;
  this.name = name;

}

module.exports = Driver;
