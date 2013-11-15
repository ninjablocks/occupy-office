
/* jQuery Tiny Pub/Sub - v0.7 - 10/27/2011 (Modified by Elliot)
 * http://benalman.com/
 * Copyright (c) 2011 "Cowboy" Ben Alman; Licensed MIT, GPL */
;(function(d){

    // the topic/subscription hash
    var cache = {};

    d.publish = function(topic){

        var target = topic;
        var args = Array.prototype.slice.call(arguments, 1);

        //console.info('>> Event [' +topic + ']', args);

        var keepGoing = true;

        var go = function(t){
            if (keepGoing !== false) {
                try {
                    keepGoing = t.apply(d, [topic].concat(args) || [topic]);
                } catch(e) {}
            }
        };

        _.each(cache['*']||[], go);

        while (target) {
            _.each(cache[target]||[], go);
            target = target.substring(0, target.lastIndexOf('.'));
        }

    };

    d.publishAsync = function() {
        var args = Array.prototype.slice.call(arguments);
        setTimeout(function() {
            d.publish.apply(null, args);
        }, 1);
    };

    d.subscribe = function(/* String */topic, /* Function */callback){
        if (typeof topic == 'function') {
            callback = topic;
            topic = '*';
        }
        if(!cache[topic]){
            cache[topic] = [];
        }
        cache[topic].push(callback);
        return [topic, callback]; // Array
    };

    d.unsubscribe = function(/* Array */handle){
        var t = handle[0];
        if (cache[t]) {
            d.each(cache[t], function(idx){
                if(this === handle[1]){
                    cache[t].splice(idx, 1);
                }
            });
        }
    };

})(window.$ || window.jQuery);


L.LabelOverlay = L.Class.extend({
    initialize: function(/*LatLng*/ latLng, /*String*/ label, options) {
        this._latlng = latLng;
        this._label = label;
        L.Util.setOptions(this, options);
    },
    options: {
        offset: new L.Point(0, 2)
    },
    onAdd: function(map) {
        this._map = map;
        if (!this._container) {
            this._initLayout();
        }
        map.getPanes().overlayPane.appendChild(this._container);
        this._container.innerHTML = this._label;
        map.on('viewreset', this._reset, this);
        this._reset();
    },
    onRemove: function(map) {
        map.getPanes().overlayPane.removeChild(this._container);
        map.off('viewreset', this._reset, this);
    },
    _reset: function() {
        var pos = this._map.latLngToLayerPoint(this._latlng);
        var op = new L.Point(pos.x + this.options.offset.x, pos.y - this.options.offset.y);
        L.DomUtil.setPosition(this._container, op);
    },
    _initLayout: function() {
        this._container = L.DomUtil.create('div', 'leaflet-label-overlay');
    },
    hide: function() {
        $(this._container).hide();
    },
    show: function() {
        $(this._container).show();
    }
});

function addRemoveClass(jqEl, className, addOrRemove)
{
  var classAttr = jqEl.attr('class') || '';
  if (!addOrRemove) {
    classAttr = classAttr.replace(new RegExp('\\s?' + className, 'g'), '');
    jqEl.attr('class', classAttr);
  } else {
    classAttr = classAttr + (classAttr.length === 0 ? '' : ' ') + className;
    jqEl.attr('class', classAttr);
  }
}
