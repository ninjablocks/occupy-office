
/* jQuery Tiny Pub/Sub - v0.7 - 10/27/2011 (Modified by Elliot)
 * http://benalman.com/
 * Copyright (c) 2011 "Cowboy" Ben Alman; Licensed MIT, GPL */
;(function(d){

    // the topic/subscription hash
    var cache = {};

    d.publish = function(topic){

        var target = topic;
        var args = Array.prototype.slice.call(arguments, 1);

        console.info('>> Event [' +topic + ']', args);

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
