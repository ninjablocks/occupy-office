// The web server that hosts the frontend



var log = require('log4js').getLogger('mappu');

var express = require('express');
var lessMiddleware = require('less-middleware');
var _ = require('underscore');
var path = require('path');
var request = require('request');

var MeetingStore = require('./lib/MeetingStore');

var config = require('./config/config.json');


var USER_PORT = config.userPort || 21294;
var ADMIN_PORT = config.adminPort || 21295;

console.log('Starting with config', config);

var store = new MeetingStore(config.DatabaseURL);

var app = express();
var server  = require('http').createServer(app);

var appDir = path.join(__dirname, 'app');
var genDir = path.join(__dirname, 'gen');
var configDir = path.join(__dirname, 'config');

// Start Pusher alternative
var io = require('socket.io').listen(server);

app.configure(function(){
  app.use(express.compress());
  app.use(express.bodyParser());
  app.use(express.methodOverride());

  app.use(lessMiddleware({
        dest: genDir + '/css',
        src: appDir + '/less',
        prefix: "/css",
        compress: true
    }));

    app.use(express.static(appDir));
    app.use(express.static(configDir + '/app'));
    app.use(express.static(genDir));
});

// simple logger
app.use(function(req, res, next){
  log.log('verbose', '> %s %s', req.method, req.url);
  next();
});

app.get('/permissions',function(req,res,next){
  res.status(200).send({
    'admin': ( req.socket.address().port == ADMIN_PORT )
  });
});

app.get('/pusher',function(req,res,next){
  res.status(200).send(config.PusherChannel);
});

app.get('/lastData',function(req,res,next){
 request('https://api.ninja.is/rest/v0/devices?user_access_token=' + config.NinjaAccessToken, function (error, response, body) {
    if ( !error && response.statusCode == 200 ) {
      var devices = JSON.parse(body).data;
      var lastData = {};
      _.each(devices, function(device, id) {
        if (device.did == 600)
          lastData[id.split('_')[1]] = device.last_data;
      });
      res.send(lastData);
    }
  });
});


app.get('/histogram', function(req, res, next) {
  var days = req.query.days?req.query.days.split(','):null;
  var hours = req.query.hours?req.query.hours.split(','):null;
  var zones = req.query.zones.split(',');
  var startTime = req.query.startTime;
  var endTime = req.query.startTime;

  console.log('Histogram : ', hours, days, zones);

  store.getLengthHistogram(hours, days, zones, function(e, vals) {
    if (e) {
      res.status(500).send(e);
    } else {
      res.status(200).send(vals);
    }
  });
});

var ONE_HOUR = 1000 * 60 * 60;
var ONE_DAY = ONE_HOUR * 24;
var BUSINESS_DAYS = _.range(1, 6);
var BUSINESS_HOURS = _.range(8, 18);

app.get('/usage', function(req, res, next) {
  var days = req.query.days? req.query.days.split(',') : BUSINESS_DAYS;
  var hours = req.query.hours? req.query.hours.split(',') : BUSINESS_HOURS;
  var zones = req.query.zones.split(',');
  var startTime = req.query.startTime || new Date().getTime() - (10*ONE_DAY);
  var endTime = req.query.endTime;

  console.log('start time', startTime);

  console.log('Usage : ', hours, days, zones, startTime, endTime);

  store.getTotalUsage(hours, days, zones, startTime, endTime, function(e, totalMeetingTime, start) {
    if (e) {
      res.status(500).send(e);
    } else {

      console.log('Total meetings duration ', totalMeetingTime);
      console.log('Start time ', start);

      var currentTime = startTime || start;
      endTime = endTime || new Date().getTime();

      var numberOfDays = 0;

      while (currentTime < endTime) {
        var date = new Date(currentTime);
        console.log('current date', date, date.getDay());
        if (days.indexOf(date.getDay()+'') > -1) {
          numberOfDays++;
        }
        currentTime+=ONE_DAY;
      }
      console.log('Total number of days : ', numberOfDays);
      totalTime = numberOfDays * hours.length * ONE_HOUR * zones.length;
      console.log('Total amount of time', totalTime);

      var percentageUsage = totalMeetingTime/totalTime*100;
      console.log('Percentage used', percentageUsage, '%');

      while (percentageUsage > 100) {
        percentageUsage = percentageUsage / 2;
      }

      res.status(200).send({
        percent: percentageUsage.toFixed(1),
        hours: (totalMeetingTime / 1000 / 60 / 60).toFixed(1)
      });
    }
  });

});

server.listen(USER_PORT);
server.listen(ADMIN_PORT);


module.exports = function(device) {
  device.on('data', function(da) {
    console.log('data!', da, device);
    io.sockets.emit('message', {
      DA: da,
      G: device.G,
      D: device.D,
      V: device.V
    });
  });

};
