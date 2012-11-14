$(function() {
    
    "use strict";

    var fluidEl = $('.rev-fluid-demo'),
        fixedEl = $('.rev-fixed-demo'),
        fluid   = [],
        fixed   = [];

    $.each(fluidEl, function() {

        var r = new Revolver($(this), {
            debug: true,
            controls: {
                key: true
            },
            automatic: {
                enabled: true,
                pause: 500//,
                //hitArea: ['200px','20px','50px','50px']
                //hitArea: ['20%','20%','50%','50%']
            },
            infinite: true,
            callbacks: {
                ready: function(state) {},
                beforeMove: function(state) {},
                afterMove: function(state) {},
                userPrevious: function(state) {},
                userNext: function(state) {}
            }
        });

        fluid.push(r);
    });

    $.each(fixedEl, function() {

        var r = new Revolver($(this), {
            debug: true,
            mode: 'fixed',
            //infinite: true,
            startAtItem: $(this).index() - 1
        });

        fixed.push(r);
    });
});
