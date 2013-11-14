(function() {

  var devices = {};

  $.subscribe('ninja.data', function(topic, d) {

    console.log("Got some data", d);
    if (!devices[d.G]) {
        $.publish('mappu.zone', d.G);
        devices[d.G] = true;
    }

    $.publish('mappu.alarm.'+d.G, d.DA.Alarm1);
    $.publish('mappu.battery.'+d.G, d.DA.Battery);
    $.publish('mappu.tamper.'+d.G, d.DA.Tamper);
  });

})();


