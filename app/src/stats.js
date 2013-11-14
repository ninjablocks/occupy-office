// This file takes care of the statistics sidebar and popups,
// tracking the current search (state) and updating the ui.

(function() {

  // Default to 8am-6pm Mon-Fri
  var state = {
    hours: _.range(8,18),
    days: _.range(1,6)
  };

  N.stats = {};
  N.stats.updateState = function(s) {
    _.extend(state, s||{});

    console.log('Updated stats state', state);

    $('.stats').each(function(i, el) {
      var zones = $(el).data('zones');
      //console.log("Updating stats display", el, 'with zones', zones, 'and search state', state);
      updateDisplay(_.extend({zones:zones}, state), $(el));
    });
    N.stats.updateTable();
  };

  N.stats.updateTable = function() {
    if (!$('#room-table:visible').length) {
      return;
    }
    var table = $('#room-table table');
    var body = table.find('tbody').empty();

    var summary = table.find('tfoot tr');

    var rooms = $('.sidebar.stats').data('rooms');

    //console.log('Updating table with rooms', rooms);

    function average (arr) {
      return _.reduce(arr, function(memo, num) {
        return memo + num;
      }, 0) / arr.length;
    }

    function renderUsageSummary() {
      var avgUsage = average(_.map(body.find('tr td:nth-child(2)'), function(e) {return parseInt($(e).text(), 10);}));
      summary.find('td:eq(1)').text(avgUsage.toFixed(0)+'%');
    }

    function renderHistogramSummary() {
      for (var i = 3; i < 8; i++) {
        summary.find('td:nth-child(' + i + ')').text(_(body.find('tr td:nth-child(' + i + ')'))
          .map(function(e) {
            return parseInt($(e).text(), 10);
          })
          .reduce(function(memo, num) {
            return memo + num;
          }));
      }
    }


    _.each(rooms, function(room) {
      //console.log('room', room);

      var name = room.feature.properties.name || ('[device:' + room.feature.properties.room_id + ']');

      var row = $('<tr><td>' + name + '</td><td class="occupancy"></td></tr>');
      body.append(row);

      getUsage(_.extend({zones:[room.feature.properties.room_id]}, state), function(data) {
        row.find('.occupancy').text(parseFloat(data.percent).toFixed(0) + '%');
        renderUsageSummary();
      });

      getHistogram(_.extend({zones:[room.feature.properties.room_id]}, state), function(data) {
        _.each(data, function(cell) {
          row.append('<td class="center">' + cell + '</td>');
        });
        renderHistogramSummary();
      });

    });

  };

  function updateDisplay(s, el) {

    var query = {};
    _.each(s, function(val, key) {
        //console.log('val', val, 'key', key);
        query[key] = _.isArray(val) ? val.join(',') : val;
    });
    //console.log('Stats query', query);

    getHistogram(s, function(data) {
      el.find('.histogram').sparkline(data, {type: 'bar', barColor: 'hsl(200,42%,50%)', barWidth: 25, height: 100,chartRangeMin:1} );
    });

    getUsage(s, function(data) {

      el.find('.total').text(Math.round(data.hours*2)/2 + ' hrs');

      var percent = parseFloat(data.percent).toFixed(0);
      var valueElement = el.find('.percentage .value');

      valueElement.addClass("changing");
      jQuery({value: valueElement.text()}).animate({value: percent}, {
        duration: 700,
        easing: 'swing',
        step: function() {
          valueElement.text(parseInt(this.value, 10).toFixed(0));
        },
        complete: function() {
          valueElement.text(percent);
          valueElement.removeClass("changing");
        }
      });
      console.log("usage", data);
    });

  }

})();

function getHistogram(q, cb) {
    var query = {};
    _.each(q, function(val, key) {
        console.log('val', val, 'key', key);
        query[key] = _.isArray(val) ? val.join(',') : val;
    });
    console.log('Stats query', query);

    $.getJSON('/histogram', query, cb);
}

function getUsage(q, cb) {
   var query = {};
  _.each(q, function(val, key) {
      console.log('val', val, 'key', key);
      query[key] = _.isArray(val) ? val.join(',') : val;
  });
  console.log('Usage query', query);
  $.getJSON('/usage', query, cb);
}


// Initialise UI
$(function() {

    // JM: Sets the day labels
    var setTimeLabels = function(values) {
      var fromTime = $(".timeofday .from");
      var toTime = $(".timeofday .to");

      var from = (values[0] < 12) ? values[0] + '<span>AM</span>' : ((values[0] !== 24) ? values[0]-12 + '<span>PM</span>' : '<span>Midnight</span>');
      from = (from === '0<span>PM</span>') ? '12<span>PM</span>' : from;
      from = (from === '0<span>AM</span>') ? '<span>Midnight</span>' : from;
      var to = (values[1] < 12) ? values[1] + '<span>AM</span>' : ((values[1] !== 24) ? values[1]-12 + '<span>PM</span>' : '<span>Midnight</span>');
      to = (to === '0<span>PM</span>') ? '12<span>PM</span>' : to;


      fromTime.html(from);
      toTime.html(to);
    };


    var setDateRangePicker = function() {
      var defaultDate = new Date();
      $("#daterange").val(defaultDate.toString("MM/dd/yyyy")).daterangepicker({
        presets: {
          specificDate: 'Pick a Date',
          dateRange: 'Date Range'
        },
        closeOnSelect: true,
        posX: 'right',
        posY: 'top'
      });

      $(".ui-daterangepicker-Yeartodate").remove();
    };
    setDateRangePicker();


    $('.slider').slider({
        tooltip: 'hide',
        formater:function(val) {
           return (val < 12? val + ' AM' : (val-12) + ' PM');
        }
    }).on('slide', (function() {
        var last;
        return function(ev){
            if (ev.value.join(',') != last) {
                last = ev.value.join(',');

                console.log('Sliding', ev.value);
                setTimeLabels(ev.value);
                N.stats.updateState({
                    hours: _.range.apply(this, ev.value)
                });

            }
        };
    })());

    // Set initial time
    setTimeLabels([8,18]);

    var days = $('.sidebar .days .btn-group');

    _.each(['S', 'M', 'T', 'W', 'T', 'F', 'S'], function(name, idx) {
      days.append('<button class="btn btn-small' + (idx > 0 && idx < 6?' active':'') + '">' + name + '</button>');
    });

    $('.rooms .btn').click(function() {
      $('#room-table').toggleClass('hidden');
      N.stats.updateState();
      return false;
    });

    var btns = $('.sidebar .days .btn');
    btns.click(function() {
      $(this).toggleClass('active');

      var state = {
        days: []
      };

      btns.each(function(idx, btn) {
        if ($(btn).hasClass('active')) {
          state.days.push(idx);
        }
      });

      N.stats.updateState(state);
    });
});
