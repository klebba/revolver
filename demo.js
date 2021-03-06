$(function() {
    
    "use strict";

    var fluidEl = $('.rev-fluid-demo'),
        fixedEl = $('.rev-fixed-demo'),
        fluid   = [],
        fixed   = [];

    $.each(fluidEl, function() {

        var r = new Revolver($(this), {
            controls: {
                key: true
            },
            wraparound: true,
            infinite: true
        });

        fluid.push(r);
    });

    $.each(fixedEl, function() {

        var r = new Revolver($(this), {
            mode: 'fixed',
            startAtItem: $(this).index() - 1
        });

        fixed.push(r);
    });
});
