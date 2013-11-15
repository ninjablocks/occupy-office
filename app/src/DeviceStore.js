(function() {

  var devices = {};

  $.subscribe('ninja.data', function(topic, d) {

    console.log("Got some data", d);
    if (!devices[d.G]) {
        $.publish('mappu.zone', d.G);
        devices[d.G] = true;
    }

    var age = new Date().getTime() - d.DA.timestamp;

    $.publish('mappu.alarm.'+d.G, d.DA.Alarm1, age, d.DA.timestamp);
    $.publish('mappu.battery.'+d.G, d.DA.Battery, age, d.DA.timestamp);
    $.publish('mappu.tamper.'+d.G, d.DA.Tamper, age, d.DA.timestamp);
  });

})();


