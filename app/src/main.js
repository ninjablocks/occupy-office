$(function() {

    var pusher = new Pusher('ccff70362850caf79c9f');


    $.get('/pusher', function(channelId) {
        console.log('Got pusher channel id', channelId);
        var channel = pusher.subscribe(channelId);

        channel.bind('heartbeat', function(data) {
          console.log('heartbeat', data);
          $.publish('ninja.heartbeat', data);
        });
        channel.bind('data', function(data) {
          console.log('data', data);
          if (data.D != 600) { // IAS Zone
             return;
          }
          $.publish('ninja.data', data);
        });

    });

});


$(function() {


    // JM: Set logo to sticky
    $(".logo-wrapper").sticky();


    var map = L.map('main-map');
    //*
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    //*/

    var lastOccupiedStates = {};
    $.subscribe('mappu.alarm.room', function(topic, roomId, alarm) {
        $('.rooms .' + roomId + ' a').toggleClass('occupied', alarm);
        lastOccupiedStates[roomId] = alarm;
    });

    function resetViewOnLoad() {
        if (getActiveLevel() && getActiveLevel().getFloorOverlay()) {
            resetView();
        } else {
            setTimeout(resetViewOnLoad, 50);
        }
    }

    var popupClosing = false;
    function resetView() {

        map.setView([0, 0], 2);

        console.log('activeLevel', getActiveLevel());

        console.log('features', getActiveLevel().getFloorOverlay().toGeoJSON());

        var rooms = _(getActiveLevel().getFloorOverlay().getLayers()).filter(function(layer) {
            return layer.feature.geometry.type === 'Polygon';
        });

        console.log('rooms', rooms);

        // Add room links on side
        var ul = $('.sidebar .rooms ul').empty();

        rooms = rooms.sort(function(a,b) {
            var av = a.feature.properties.name || a.feature.properties.room_id;
            var bv = b.feature.properties.name || b.feature.properties.room_id;
            if(av < bv) return -1;
            if(av > bv) return 1;
            return 0;
        });

        _.each(rooms, function(room) {
            console.log('rooom', room);
            // /<li><a class="occupied">Boardroom 1</a></li>
            var li = $('<li class="' + room.feature.properties.room_id + '"><a>' + (room.feature.properties.name||'[device:'+room.feature.properties.room_id+']') + '</a></li>');
            li.click(function() {
                $.publish('room.click', room);
            });
            if (lastOccupiedStates[room.feature.properties.room_id]) {
                li.find('a').addClass('occupied');
            }
            ul.append(li);
        });

        $('.sidebar.stats').data('zones', _.map(rooms, function(room) {
            return room.feature.properties.room_id;
        }));

        $('.sidebar.stats').data('rooms', rooms);
        N.stats.updateState();

    }




    var zoomed = false;

    $.subscribe('room.click', function(topic, layer) {
        console.log('room click', layer);

        var popup = L.popup({minWidth: 290, minHeight:200, autoPan: false, zoomAnimation: false})
            .setLatLng(layer.getBounds().getCenter())
            .setContent($('.statsTemplate').html());

        map.openPopup(popup);

        var name = layer.feature.properties.name || ('[Device:' + layer.feature.properties.room_id + ']');

        $(popup._contentNode).data('zones', [layer.feature.properties.room_id]).addClass('stats').find('h3').text(name);


        map.fitBounds(layer.getBounds());
        zoomed = true;
        N.stats.updateState();


        $('.sidebar .rooms .hover').removeClass('hover');
        $('.sidebar .rooms .' + layer.feature.properties.room_id + ' a').addClass('hover');
        $(".current-floor").html(name);
    });

    map.on('click', function(e) {
        resetViewOnLoad();
        zoomed = false;
        $(".current-floor").html($(".floorplans .active").text());
    });


    $.getJSON('floors.json', loadFloors);

    function loadFloors(floorConfig) {

        var levels = {};

        _.each(floorConfig, function(cfg) {
            var level = new N.LevelLayer();
            level.setFloorPlan(cfg.id, {attribution:cfg.attribution});
            level.setFloorOverlay(cfg.geojson);
            level.addTo(map);

            levels[cfg.name] = level;
        });

        // TODO: There must be a smarter way
        function getActiveLevel() {
            return _.filter(levels, function(l) {
                return l._map;
            })[0];
        }

        window.getActiveLevel = getActiveLevel;
        window.map = map;


        var levelControl = L.control.layers(levels);
        console.log('level control', levelControl);
        levelControl.addTo(map);

        map.on('baselayerchange', function(e,x,y) {

            setFloorPlan(e);

            resetViewOnLoad();

        });


        // Move the layers controls to the sidebar
        $('.leaflet-control-layers-list').appendTo('.floorplans').find('label:first').click();

        $('.leaflet-top.leaflet-right').remove();

        // JM: Set active state on floorplans
        function setFloorPlan(floor) {
            var floorplans = $(".floorplans");

            $(".current-floor").html(floor.name);

            floorplans.find("label").removeClass("active");
            floorplans.find("label span:contains('" + floor.name + "')").parent("label").addClass("active");
        }

        // Initialise the first floor plan
        $(".floorplans label:first-child").addClass("active");


        var drawControl = new L.Control.Draw({
            draw: {
                position: 'topleft',
                polygon: {
                    title: 'Draw a room',
                    allowIntersection: false,
                    drawError: {
                        color: '#b00b00',
                        timeout: 1000
                    },
                    shapeOptions: {
                        color: '#bada55'
                    },
                    showArea: false
                },
                circle: false,
                polyline: false,
                rectangle: false
            }/*,
             //TODO: Work out how to change featureGroup when visible layer changes
            edit: {
                featureGroup: drawnItems
            }*/
        });
        //map.addControl(drawControl);
        $.get('/permissions', function(data) {
            if ( data.admin ) {
              map.addControl(drawControl);
            }
        });

        map.on('draw:created', function (e) {
            var type = e.layerType,
                layer = e.layer;


            console.log('Drew new layer', layer, layer.toGeoJSON());

            var currentLevel = getActiveLevel();

            if (type === 'marker') {
                // It's a sensor marker

                var result = currentLevel.addSensor(layer , 'MYGUIDtest123');

                if (_.isString(result)) {
                    alert(result);
                } else {
                    alert('Added sensor marker to room : ' + (result.feature.properties.name || '[UNNAMED]'));
                    //currentLevel.addLayer(layer);
                }

            } else {
                // It's a room
                console.log('currentLevel', currentLevel);
                var r = currentLevel.addRoom(layer);

                if (_.isString(r)) {
                    alert(r);
                } else {
                    console.log(r);
                    alert('Added room : ' + (r.properties.name || '[UNNAMED]'));
                    //currentLevel.addLayer(layer);
                }
            }

            console.log(currentLevel.getFloorOverlay().toGeoJSON());

            // TODO: save the updated floor overlay
        });

        resetViewOnLoad();

        map.setView([0, 0], 2);


        fetchLastData();

        setInterval(fetchLastData, 60000);

    }


});


function fetchLastData() {
    $.getJSON('/lastData', function(lastData) {
        _.each(lastData, function(data, id) {
            $.publish('ninja.data', {
                    DA: data.DA,
                    G: id
            });
        });
    });
}
