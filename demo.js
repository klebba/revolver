$(function() {
    
    var fluidEl = $('.rev-fluid-demo'),
        fixedEl = $('.rev-fixed-demo'),
        fluid   = [],
        fixed   = [];

    $.each(fluidEl, function() {

        var r = new Revolver($(this), {
            controls: {
                key: true
            },
            automatic: {
                //enabled: true,
                pause: 2500//,
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
            },
            debug: true
        });

        fluid.push(r);
    });

    $.each(fixedEl, function() {

        var r = new Revolver($(this), {
            mode: 'fixed'//,
            //infinite: true,
            //startAtItem: $(this).index()
        });

        fixed.push(r);
    });

    //fixed[1].toItem(2);
});
