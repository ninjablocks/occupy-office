//var sqlite3 = require('sqlite3').verbose();
var anyDB = require('any-db');
var async = require('async');

function MeetingStore(dbURL, cb) {

    console.log("Creating meeting store using db url", dbURL);
    this.dbURL = dbURL;

    this.pool = anyDB.createPool(dbURL, {min: 2, max: 20});

    this.insertStatement = "INSERT INTO meeting(start, length, day, hour, zone) VALUES (?, ?, ?, ?, ?)";

    this.init(cb);
}

MeetingStore.prototype.init = function(cb) {
    this.pool.query("CREATE TABLE IF NOT EXISTS meeting (start DATE, length INTEGER, day INTEGER, hour INTEGER, zone TEXT)", cb);
};

MeetingStore.prototype.saveMeeting = function(start, length, zone, cb) {
    this.pool.query(this.insertStatement, [start, length, start.getDay(), start.getHours(), zone], cb);
};

var HOUR = 1000*60*60;
var HALF_HOUR = 1000*50*30;
var LENGTH_CLAUSES = [0, HOUR, 2*HOUR, 3*HOUR, 4*HOUR].map(function(length, idx, arr) {
    return 'length >= ' + length + (idx < arr.length-1?' AND length < ' + arr[idx+1]:'');
});
/*var LENGTH_CLAUSES = [0, HALF_HOUR, 2*HALF_HOUR, 3*HALF_HOUR, 4*HALF_HOUR].map(function(length, idx, arr) {
    return 'length >= ' + length + (idx < arr.length-1?' AND length < ' + arr[idx+1]:'');
});*/

function map( els, func ) {
  var out = [];
  for ( var i in els ) {
    var e = els[i];
    out.push( func( e ) );
  }
  return out;
}

function zoneList( zones ) {
  return map(zones, function(zone){
    return '"' + zone.replace('"', '\\"') + '"';
  }).join(',');
}

MeetingStore.prototype.getTotalUsage = function(hours, days, zones, startTime, endTime, cb) {
    var clauses = [];

    if (days && days.length) {
        clauses.push('day in ('+map(days, parseInt).join(',')+')');
    }
    if (hours && hours.length) {
        clauses.push('hour in ('+map(hours, parseInt).join(',')+')');
    }

    clauses.push('zone in ('+zoneList(zones)+')');

    if (startTime) {
        clauses.push('start >=' + parseInt(startTime, 10));
    }
    if (endTime) {
        clauses.push('start <' + parseInt(endTime, 10));
    }

    var sql = 'SELECT sum(length) as total, min(start) as start FROM meeting ' + (clauses.length?'where ' + clauses.join(' AND '):'');
    console.log('Length : SQL - ' + sql);
    this.pool.query(sql, function(err, result) {
        console.log("Result from select", err, result);
        if (result.rows) {
            cb(null, result.rows[0].total, result.rows[0].start);
        } else {
            cb(null, n);
        }
    });
};

MeetingStore.prototype.getLengthHistogram = function(hours, days, zones, cb) {
    var clauses = [];

    if (days && days.length) {
        clauses.push('day in ('+map(days, parseInt).join(',')+')');
    }
    if (hours && hours.length) {
        clauses.push('hour in ('+map(hours, parseInt).join(',')+')');
    }

    clauses.push('zone in ('+zoneList(zones)+')');

    async.map(LENGTH_CLAUSES, function(lengthClause, cb) {
        var sql = 'SELECT count(rowid) as count FROM meeting where ' + [lengthClause].concat(clauses).join(' AND ');
        console.log('Histogram : SQL - ' + sql);
        this.pool.query(sql, function(err, result) {
            console.log("Result from select", err, result);
            if (result.rows) {
                cb(null, result.rows[0].count);
            } else {
                cb(null, 0);
            }
        });
    }.bind(this), cb);
};

MeetingStore.prototype.close = function() {
    console.log("closeDb");
    this.pool.close();
};

module.exports = MeetingStore;
