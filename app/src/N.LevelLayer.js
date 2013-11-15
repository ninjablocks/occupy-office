// A layer group than contains a raster floor plan layer and vector (geojson) room layers
N.LevelLayer = L.LayerGroup.extend({

    setFloorPlan : function(planId, opts) {

        this.addLayer(L.tileLayer('tiles/' + planId + '/{z}/{x}/{y}.png', _.extend({
            minZoom: 0,
            maxZoom: 5,
            opacity: 1.0,
            tms: false,
            continuousWorld: true,
            noWrap: true,
            detectRetina: true
        }, opts)));

    },

    setFloorOverlay : function(geoJsonUrl) {
        var self = this;

        $.getJSON(geoJsonUrl, function(geoJson) {
            console.log(geoJson);

            this._overlay = new (window.R || window.L).GeoJSON(geoJson, {
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: 8
                    });
                },
                onEachFeature: function (feature, layer) {

                    if (feature.properties.device) {
                         $.subscribe('mappu.alarm.' + feature.properties.device, function(topic, alarm, age, timestamp) {
                            var path = $(layer._container).find('path');

                            console.log("Feature alarm", feature, alarm);

                            /*if (!alarm && path) {
                                addRemoveClass(path, 'alarmed', false);
                            }*/

                            layer.setStyle({
                                fillColor: alarm?'#f98300':'#0073ab'
                            });



                            /*if (alarm) {
                                setTimeout(function() {
                                    if ((age / 1000) < 300) { // If it's new, fade it slowly...
                                        addRemoveClass(path, 'alarmed', true);
                                    }

                                    path.attr('fill', '#fff7d6');
                                }, 500);
                            }*/

                            $.publish('mappu.alarm.room.'+feature.properties.room_id, feature.properties.room_id, alarm, age, timestamp);
                        });
                         console.log('** Subscribing to ', 'mappu.tamper.' + feature.properties.device);
                        $.subscribe('mappu.tamper.' + feature.properties.device, function(topic, tamper, age) {
                            console.log("Feature tamper", feature, tamper);
                            var path = $(layer._container).find('path');
                            addRemoveClass(path, 'tamper', tamper);
                        });
                          $.subscribe('mappu.battery.' + feature.properties.device, function(topic, battery, age) {
                            console.log("Feature low battery", feature, battery);
                            var path = $(layer._container).find('path');
                            addRemoveClass(path, 'lowBattery', battery);
                        });
                    }

                    var label = new L.LabelOverlay(layer.getBounds().getSouthWest(),  feature.properties.name);
                    self.addLayer(label);

                    layer.on({

                        click: function (e) {
                            if (feature.geometry.type != 'Point') {
                                $.publish('room.click', layer);
                            }
                        },

                        mouseover: function(e) {
                        },

                        mouseout: function(e) {
                        }

                    });
                },
                style: function(feature) {
                    if (feature.geometry.type == 'Point') {
                        return {
                            fillColor: "#0078ff",
                            //color: "#000",
                            weight: 0,
                            opacity: 1,
                            fillOpacity: 0.8
                        };
                    } else {
                        return {
                            fillColor: '#666',
                            weight: 0,
                            opacity: 1,
                            //color: 'white',
                            //dashArray: '3',
                            fillOpacity: 0.7
                        };
                    }
                }
            });

            var idx = 0;
            this._overlay.on("featureparse", function (e){

                (function(layer, properties) {

                    //click event that triggers the popup and centres it on the polygon
                    layer.on("click", function (e) {
                        var bounds = layer.getBounds();
                        var popupContent = "popup content here";
                        popup.setLatLng(bounds.getCenter());
                        popup.setContent(popupContent);
                        map.openPopup(popup);
                    });

                })(e.layer, e.properties);

                e.layer._leaflet_id = 'room-'+idx+''; // TODO: Assign propert room ids
                idx++;
            });

            this.addLayer(this._overlay);

        }.bind(this));

    },

    getFloorOverlay : function() {
        return this._overlay;
    },

    addSensor : function(layer, device) {

            var sensorMarker = layer.toGeoJSON();

            sensorMarker.properties.device = device;
            console.log('Adding sensor marker', sensorMarker);

            // TODO: We can remove the .reverse if we use leafletPip.bassackwards
            var rooms = leafletPip.pointInLayer(sensorMarker.geometry.coordinates, this._overlay);
            console.log('Point is inside room', rooms);

            if (rooms.length === 0) {
                return 'You must place the sensor inside a room.';
            } else if (rooms.length > 1) {
                return 'A sensor must only be placed inside a single room';
            } else {
                var room = rooms[0];

                if (room.feature.properties.device) {
                    return 'This room already has a sensor marker. You must remove it before adding a different one.';
                }

                room.feature.properties.device = device;

                console.log('added data', this._overlay.addData(sensorMarker));

                console.log('Overlay is now', JSON.stringify(this._overlay.toGeoJSON()));
                return room;
            }

    },
    addRoom : function(layer) {

        var room = layer.toGeoJSON();

        console.log('Adding Room', room);
        console.log('aaa', this, this._overlay);

        console.log('Added room data', this._overlay.addData(room));
        console.log('Overlay is now', JSON.stringify(this._overlay.toGeoJSON()));

        return room;
    }
});
