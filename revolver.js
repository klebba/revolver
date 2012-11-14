//     Revolver.js Beta 1
//     http://github.com/klebba/revolver
//     (c) 2011-2012 Casey Klebba
//     Revolver may be freely distributed under the MIT license.

(function() {

    "use strict";

    var Revolver = function(element, options) {

        var m = window.hasOwnProperty('Modernizr') ? window.Modernizr : false;
        
        // default options
        var defaults = {
            speed               : 1250,
            easing              : 'swing',
            mode                : 'fluid',            // fluid or fixed
            touch               : m && m.touch,
            transforms          : m && m.csstransforms,
            transform3d         : m && m.csstransforms3d,
            transitions         : m && m.csstransitions,
            wraparound          : false,              // loop
            infinite            : false,              // seamless loop
            autoFocus           : false,              // item clicks cause focus
            lazyLoad            : true,               // data-src --> src
            startAtItem         : 0,                  // zero indexed
            automatic : {
                enabled         : false,
                hitArea         : false, // TODO %    // optional, ['x1','y1','x2','y2'] eg '100px' or '50%'
                pause           : 4000,               // how long to wait between items
                direction       : 'forward'           // forward or backward
            },
            controls: {
                arrows          : true,               // left right
                list            : false, // TODO      // list of items
                key             : false               // one carousel per window can use this option
            },
            callbacks: {
                ready           : function(state) {}, // when setup completes
                beforeMove      : function(state) {}, // before any reposition
                afterMove       : function(state) {}, // after any reposition
                afterChange     : function(state) {}, // only when a reposition results in a new slide
                userPrevious    : function(state) {}, // when the user clicks the previous button
                userNext        : function(state) {}, // when the user clicks the next button
                cycle           : function(state) {}  // when the index advances automatically
            },
            classNames: {
                mask            : 'rev-mask',
                container       : 'rev-container',
                item            : 'rev-item',
                itemClone       : 'rev-clone',
                touch           : 'rev-touch',
                currentItem     : 'rev-current',
                next            : 'rev-next',
                previous        : 'rev-previous',
                focus           : 'rev-focus',
                beforeFocus     : 'rev-before-focus',
                afterFocus      : 'rev-after-focus',
                enabled         : 'rev-enabled'
            },
            debug               : false
        };
        
        // recursive merge
        this.options = $.extend(true, {}, defaults, options || {});

        // force wraparound for infinite carousels
        if(this.options.infinite) {
            this.options.wraparound = true;
        }

        this.el = element instanceof jQuery ? element : $(element);

        if(!this.elementIsValid()) {
            return;
        }
        
        this.init();
    };

    Revolver.prototype = {

        namespace: 'rev',
        
        init: function() {
            
            var ns = this.namespace,
                options = this.options,
                callback = options.callbacks.ready;

            // for key and window listeners
            this.win = $(window);

            this.controls = {};
            
            // list of css vendor prefixes
            this.vendorPrefixes = ['-webkit-', '-moz-', '-ms-', '-o-', ''];

            // namespaced events
            this.events = {
                mouseDown  : 'mousedown.' + ns,
                mouseMove  : 'mousemove.' + ns,
                mouseEnter : 'mouseenter.' + ns,
                mouseLeave : 'mouseleave.' + ns,
                keyDown    : 'keydown.' + ns,
                click      : 'click.' + ns,
                resize     : 'resize.' + ns
            };
            
            // special compount event type for vendor ridiculousness
            this.events.transitionEnd = 'transitionend.' + ns + ' webkitTransitionEnd.' + ns + ' oTransitionEnd.' + ns + ' msTransitionEnd.' + ns;
            
            // make testing easier using mouse
            if(options.debug) {
                this.events.touchStart  = 'mousedown.' + ns + ' touchstart.' + ns;
                this.events.touchMove   = 'mousemove.' + ns + ' touchmove.' + ns;
                this.events.touchEnd    = 'mouseup.' + ns + ' touchend.' + ns;
                this.events.touchCancel = 'touchcancel.' + ns;
            } else {
                this.events.touchStart  = 'touchstart.' + ns;
                this.events.touchMove   = 'touchmove.' + ns;
                this.events.touchEnd    = 'touchend.' + ns;
                this.events.touchCancel = 'touchcancel.' + ns;
            }
            
            // resize listener
            this.win.on(this.events.resize, $.proxy(this.onWindowResize, this));

            this.setupElements();
            this.setupState();
            
            if(options.infinite) {
                this.infinite = {};
            }

            if(options.touch || options.debug) {
                this.useTouch(true);
            }
            
            if(callback) {
                this.dispatchEvent('ready', callback);
            }
        },
        
        useTouch: function(toggle) {

            var options = this.options;
            
            this.touch = {};
            
            if(toggle) {
                this.addTouchEventListeners();
                this.el.addClass(options.classNames.touch);
            } else {
                this.removeTouchEventListeners();
                this.el.removeClass(options.classNames.touch);
            }
        },
        
        // cache and configure elements
        setupElements: function() {
            
            var options = this.options;
            
            // setup and cache the mask
            this.el.addClass(options.classNames.mask);
            this.mask = this.el;

            // cache the item container
            this.container = $('.' + options.classNames.container, this.el);
            
            // add transform base styles
            if(options.transforms || options.transform3d) {
                this.applyVendorStyle(this.container, 'transform-origin', '0 0');
                // reset conflicting external styles
                this.container.css('left', 'auto');
            }
        },
        
        // run on init and when items are added
        cacheItems: function() {
            
            this.items = this.container.children();
            
            if(this.options.infinite) {

                // insert clones for infinite looping
                this.cloneItems();
                
                // re-cache with the cloned items
                this.items = this.container.children();
            }
        },
        
        // augment item list with pre/post clones
        cloneItems: function() {
            
            var cloneCount = this.calculateItemsPerPage(),
                cloneClass = this.options.classNames.itemClone,
                clonePre,
                clonePost;
            
            // clear old clones
            if(typeof this.clones !== 'undefined') {
                
                if(cloneCount === this.clones.length/2) {
                    // number of clones hasn't changed, nothing to do
                    return;
                } else if(this.clones.hasOwnProperty('remove')) {
                    this.clones.remove();
                    this.clones = undefined;
                }
            }
            
            // items shaved from the front, added to the back
            clonePre = this.items.slice(0, cloneCount).clone();
            
            // items shaved from the back, added to the front
            clonePost = this.items.slice(-cloneCount).clone();
            
            // insert into the dom
            this.container.append(clonePre).prepend(clonePost);
            
            // keep a reference to the clones
            this.clones = $.merge(clonePre, clonePost).addClass(cloneClass);
            
            // keep it simple -- lazy load clones
            this.lazy(this.clones);
        },
        
        // holds indexes, measurements, etc
        setupState: function() {
            
            var options = this.options,
                startAtItemIndex;
            
            // add initial properties to the state
            this.state = {};
            this.state.element = this.el;
            this.state.busy = false;

            // store the items
            this.cacheItems();
            
            // add calculated properties to the state
            this.measure();
            
            this.state.lastItemIndex = -1;
            
            if(this.state.containerSize < this.state.maskSize) {
                // nothing to do after measurement
                this.state.currentItemIndex = 0;
                this.disable();
            } else {
                
                startAtItemIndex = options.startAtItem + this.state.startItemIndex;

                // set the initial item index
                this.state.currentItemIndex = this.forceValidItemIndex(startAtItemIndex);
                
                this.enable();
                
                // after meaurement, store the current calculated position
                this.state.position = this.calculateCurrentPosition();
                
                // the initial position is not always zero (must come after measure)
                if(this.state.position !== 0) {
                    this.syncPosition(0);
                }
                
                //first run
                this.syncPosition();
                this.syncControlsWithState();
            }
            
            // load images
            if(options.lazyLoad) {
                this.lazy(this.getVisibleItems());
            }
        },
        
        addControls: function() {
            
            var options = this.options,
                insert,
                previousHTML,
                nextHTML;
            
            if(options.controls.arrows) {
                // insert arrow control elements
                previousHTML = '<button class="' + options.classNames.previous + '" title="Previous"></button>';
                nextHTML = '<button class="' + options.classNames.next + '" title="Next"></button>';
                
                insert = [previousHTML, nextHTML];
                
                this.el.prepend(insert.join(''));
                
                this.controls = {
                    previous: $('.' + options.classNames.previous, this.el),
                    next: $('.' + options.classNames.next, this.el)
                };
            } else {
                this.controls = {};
            }

            this.addControlsEventListeners();
        },
        
        removeControls: function() {
            
            var controls = this.controls;

            if(typeof controls.previous !== 'undefined') {
                controls.previous.remove();
            }
            
            if(typeof controls.next !== 'undefined') {
                controls.next.remove();
            }

            this.removeControlsEventListeners();
        },
        
        // move to the current item index
        syncPosition: function(time) {
            
            var position = this.calculateCurrentPosition(),
                speed = typeof time === 'undefined' ? this.options.speed : time;
            
            // determine the destination position based on the current item index
            $.extend(this.state, { position: position });
            
            this.move(position, speed);
        },
        
        syncControlsWithState: function() {
            
            var state              = this.state,
                options            = this.options,
                controls           = this.controls,
                wraparound         = options.wraparound,
                currentItemIndex   = state.currentItemIndex,
                startPageItemIndex = state.startPageItemIndex,
                endPageItemIndex   = state.endPageItemIndex,
                previous           = controls.previous,
                next               = controls.next,
                items              = this.items,
                currentItemClass   = options.classNames.currentItem,
                currentItem        = $(items[currentItemIndex]);
            
            if(!wraparound) {

                if(previous) {
                    // is the current index beyond the index of
                    // the first item in the first page
                    if(currentItemIndex <= startPageItemIndex) {
                        previous.attr('disabled', '');
                    } else {
                        previous.removeAttr('disabled');
                    }
                }
                
                if(next) {
                    // is the current index beyond the index of
                    // the first item in the last page
                    if(currentItemIndex >= endPageItemIndex) {
                        next.attr('disabled', '');
                    } else {
                        next.removeAttr('disabled');
                    }
                }
            }

            // add a current item class for styling
            // or remove the last item class
            $(items).filter('.' + currentItemClass).removeClass(currentItemClass);
            currentItem.addClass(currentItemClass);
            
            if(options.autoFocus && state.itemsPerPage === 1) {
                this.focusItem(currentItem);
            }
        },
        
        // focus item is not always the same as the current item in the carousel
        // current carousel item indicates how the carousel is positioned
        // focus item indicates which item the user has clicked or swiped
        // if items per page is 1 then the focus target is always the current item
        focusItem: function(target) {
            
            var el               = target instanceof jQuery ? target : $(target),
                classNames       = this.options.classNames,
                focusClass       = classNames.focus,
                beforeFocusClass = classNames.beforeFocus,
                afterFocusClass  = classNames.afterFocus,
                lastTarget       = this.lastFocus;
            
            if(!lastTarget || el.get(0) !== lastTarget.get(0)) {
                
                // remove the last focus
                if(lastTarget) {
                    lastTarget.removeClass(focusClass);
                    lastTarget.prev().removeClass(beforeFocusClass);
                    lastTarget.next().removeClass(afterFocusClass);
                }
                
                // identify the flanking items
                el.prev().addClass(beforeFocusClass);
                el.next().addClass(afterFocusClass);
                
                // identify the current item
                el.addClass(focusClass);
                
                this.lastFocus = el;
            }
        },

        initCycle: function() {

            var options = this.options,
                hit     = this.getHitArea();

            if(hit && options.debug === true) {

                var hitX      = hit[0],
                    hitY      = hit[1],
                    hitWidth  = hit[2],
                    hitHeight = hit[3];
                
                this.el.append(
                    '<div style="background-color:rgba(255,0,0,.25);width:' + hitWidth + ';height:' + hitHeight +
                    ';position:absolute; top:' + hitY + ';left:' + hitX + ';" />'
                );
            }

            this.state.cycling = false;

            this.startCycle();

            this.addCycleEventListeners();
        },

        killCycle: function() {
            
            this.stopCycle();
            
            this.removeCycleEventListeners();

            clearInterval(this.resetTimeout);
        },

        startCycle: function() {

            var self    = this,
                options = this.options,
                dir     = options.automatic.direction,
                wait    = options.speed + options.automatic.pause;
            
            // avoid starting the cycle when it's already running
            if(this.isCycling()) {
                return;
            }
            
            // ensures interval isn't started twice
            this.stopCycle();
            
            this.cycleInterval = setInterval(function() {

                // default forward
                if(dir === 'backward') {
                    self.previousInternal();
                } else {
                    self.nextInternal();
                }
                
                self.dispatchEvent('cycle', options.callbacks.cycle);

            }, wait);

            this.state.cycling = true;
        },
        
        stopCycle: function() {
            
            if(!this.isCycling()) {
                return;
            }
            
            clearInterval(this.cycleInterval);
            
            this.state.cycling = false;
        },
        
        // clear the interval and wait to restart it
        resetCycle: function() {
            
            var self    = this,
                options = this.options,
                wait    = options.speed + options.automatic.pause;
            
            if(!options.automatic.enabled) {
                return;
            }

            this.killCycle();
            
            this.resetTimeout = setTimeout(function() {

                self.startCycle();
                
            }, wait);
        },

        detectHitAreaHit: function() {

            //calculate the offset manually, the event offset is incorrect during animation
            var hit     = this.getHitArea(),
                offset  = this.el.offset(),
                offsetX = event.pageX - offset.left,
                offsetY = event.pageY - offset.top,
                minX    = parseInt(hit[0], 10),
                minY    = parseInt(hit[1], 10),
                maxX    = minX + parseInt(hit[2], 10),
                maxY    = minY + parseInt(hit[3], 10);
            
            if(this.isCycling()) {

                if(
                    offsetX > minX && offsetY > minY
                    &&
                    offsetX < maxX && offsetY < maxY
                ) {
                    this.stopCycle();
                }
            } else {

                if(
                    offsetX < minX || offsetY < minY
                    ||
                    offsetX > maxX || offsetY > maxY
                ) {
                    this.startCycle();
                }
            }
        },

        /**
         * Event handling
         */
        
        addControlsEventListeners: function() {
            
            var self     = this,
                controls = this.controls,
                options  = this.options,
                cnames   = options.classNames,
                events   = this.events;

            if(controls.previous) {
                this.el.on(events.mouseDown, '.' + cnames.previous, $.proxy(this.onPreviousClick, this));
            }
            
            if(controls.next) {
                this.el.on(events.mouseDown, '.' + cnames.next, $.proxy(this.onNextClick, this));
            }
            
            if(options.controls.key) {
                this.win.on(events.keyDown, $.proxy(this.onKeyDown, this));
            }
            
            // identify clicked items
            if(options.autoFocus) {
                this.el.on(events.click, '.' + cnames.item, function(event) {
                    self.focusItem(this);
                });
            }
        },
        
        // clean up on destroy
        removeControlsEventListeners: function() {
            
            var events = this.events;

            // key but not resize
            this.win.off(events.keyDown);

            // trans, controls, autoFocus
            this.el
                .off(events.transitionEnd)
                .off(events.mouseDown)
                .off(events.click)
                ;

            this.removeTouchEventListeners();
        },
        
        addCycleEventListeners: function() {

            var events = this.events,
                hit    = this.getHitArea();

            if(hit) {
                this.win.on(events.mouseMove, $.proxy(this, 'onMouseMove'));
            } else {
                this.el
                    .on(events.mouseEnter, $.proxy(this, 'onMouseEnter'))
                    .on(events.mouseLeave, $.proxy(this, 'onMouseLeave'))
                    ;
            }
        },

        removeCycleEventListeners: function() {
            
            var events = this.events,
                hit    = this.getHitArea();

            if(hit) {
                this.win.off(events.mouseMove);
            } else {
                this.el
                    .off(events.mouseEnter)
                    .off(events.mouseLeave)
                    ;
            }
        },

        addTouchEventListeners: function() {
            
            this.el.one(this.events.touchStart, '.' + this.options.classNames.container, $.proxy(this.onTouchStart, this));
        },

        removeTouchEventListeners: function() {
            
            var events = this.events;

            this.win
                .off(events.touchMove)
                .off(events.touchEnd)
                .off(events.touchCancel)
                ;
            
            this.el.off(events.touchStart);
        },

        // add move + end + cancel, remove start
        // called in the touchstart handler
        startTouchEventListeners: function() {
            
            var events = this.events;

            this.el.off(events.touchStart);
            
            this.win
                .on(events.touchMove, $.proxy(this.onTouchMove, this))
                .one(events.touchEnd, $.proxy(this.onTouchEnd, this))
                .one(events.touchCancel, $.proxy(this.onTouchEnd, this))
                ;
        },
        
        // remove move + end + cancel, add start
        // called in the touchend handler
        resetTouchEventListeners: function() {
            
            this.removeTouchEventListeners();
            this.addTouchEventListeners();
        },
        
        // returns an object of all measured properties
        // use sparingly
        measure: function() {
            
            // can't call upon state here -- this method populates properties in state
            var options         = this.options,
                items           = this.items,
                numItems        = items.length,
                itemSize        = $(items[0]).outerWidth(), // may change after fluid recalc
                itemSizePercent = (1 / numItems) * 100,
                maskSize,
                containerSize,
                itemsPerPage,
                pages,
                startItemIndex,
                endItemIndex;
            
            // in case we added items or our styles are janky,
            // guarantee the container and items are the right width
            if(this.isFluid()) {
                
                this.container.css('width', (numItems * 100) + '%');
                
                // did the percent change since last measurement?
                // if not we can skip some manipulations
                if(itemSizePercent !== this.state.itemSizePercent) {
                    
                    // pull the container out of the dom for manip
                    this.container.detach();
                    
                    // need to specify the item width as a percentage too if we're gonna be responsi( v || bl )e
                    $.each(items, function(index) {
                        $(this).css('width', itemSizePercent + '%');
                    });
                    
                    // put the container back in the dom
                    this.el.append(this.container);
                    
                    // recalc size
                    itemSize = $(items[0]).outerWidth();
                }
                
            } else if(this.isFixed()) {
                
                this.container.css('width', (numItems * itemSize) + 'px');
            }
            
            maskSize = this.mask.outerWidth();
            containerSize = this.container.outerWidth();
            
            // returns the number of items that fit in the mask without being clipped by it
            // for fluid mode this will be 1, since each item fits the mask perfectly
            itemsPerPage = this.calculateItemsPerPage();
            
            // now we can calculate the pages
            pages = this.calculatePages(items, itemsPerPage);
            
            // with infinite looping we must specify the start and end index
            if(options.infinite) {
                startItemIndex = itemsPerPage;
                endItemIndex = items.length - itemsPerPage - 1;
            } else {
                startItemIndex = 0;
                endItemIndex = items.length - 1;
            }
            
            $.extend(this.state, {
                itemSize           : itemSize,
                itemSizePercent    : itemSizePercent,
                maskSize           : maskSize,
                containerSize      : containerSize,
                itemsPerPage       : itemsPerPage,
                startItemIndex     : startItemIndex,
                endItemIndex       : endItemIndex,
                pages              : pages,
                startPageItemIndex : pages[0],
                endPageItemIndex   : pages[pages.length - 1]
            });
        },
        
        // used when adding items and on orientation change
        resize: function() {
            
            //recache items and rebuild clones
            this.cacheItems();
            
            // update measurements in the state
            this.measure();
            
            // determine whether or not the carousel should be enabled
            if(this.state.containerSize < this.state.maskSize) {

                this.state.currentItemIndex = this.forceValidItemIndex(0);
                this.disable();
            } else {

                this.enable();
                
                // adjust the position to the current item index
                this.state.position = this.calculateCurrentPosition();

                this.syncPosition(0);
                this.syncControlsWithState();
            }
        },
        
        /**
         * Event handlers
         * */
        
        onPreviousClick: function(event) {
            
            event.preventDefault();

            this.previous();
            this.dispatchEvent('userPrevious', this.options.callbacks.userPrevious);
        },
        
        onNextClick: function(event) {
            
            event.preventDefault();

            this.next();
            this.dispatchEvent('userNext', this.options.callbacks.userNext);
        },

        onMouseEnter: function(event) {
            
            this.stopCycle();
        },
        
        onMouseLeave: function(event) {
            
            this.startCycle();
        },

        onMouseMove: function(event) {
            
            this.detectHitAreaHit();
        },
        
        onKeyDown: function(event) {
            
            switch(event.which) {
                case 37:
                case 38: this.onPreviousClick(event); break;
                case 39:
                case 40: this.onNextClick(event); break;
            }
        },
        
        onWindowResize: function(event) {

            this.resize();
        },
        
        onTransitionEnd: function(event) {
            
            this.el.off(this.events.transitionEnd, '.' + this.options.classNames.container);
            this.afterMove();
        },
        
        onTouchStart: function(event) {
            
            if(event.button === 2) {
                return; // ignore pesky right clicks during dev
            }
            
            var nEvent = this.normalizeTouchEvent(event),
                startX = nEvent.pageX,
                startY = nEvent.pageY;
            
            // reset
            this.touch = {
                scroll     : undefined, // has the intent been determined?
                startX     : startX,
                startY     : startY,
                lastX      : 0,
                lastY      : 0,
                startPos   : this.getPosition(),
                startIndex : this.state.currentItemIndex // keep track of where we started
            };
            
            this.startTouchEventListeners();
        },
        
        onTouchMove: function(event) {
            
            var nEvent   = this.normalizeTouchEvent(event),
                //now      = nEvent.timeStamp || Date.now(),
                touch    = this.touch,
                deltaX   = touch.startX - nEvent.pageX,
                deltaY   = touch.startY - nEvent.pageY,
                lastX    = nEvent.pageX,
                lastY    = nEvent.pageY,
                position = this.forceValidPosition(touch.startPos - deltaX); //filtered within bounds
            
            $.extend(this.touch, {
                lastX : lastX,
                lastY : lastY
            });
            
            // guess the intent of the touch if it's not already known
            if(typeof touch.scroll === 'undefined') {
                // has enough distance been covered to call it a swipe?
                // hijack the event, no scrolling will be possible until next touch
                this.touch.scroll = !!(touch.scroll || Math.abs(deltaX) < Math.abs(deltaY));
                
                // set the state to busy
                if(!this.touch.scroll) {
                    this.lock();
                }
            }
            
            if(!this.touch.scroll) {
                
                // arrest the event
                nEvent.preventDefault();
                
                // 1:1 movement
                this.move(position, 0);
            }
        },
        
        onTouchEnd: function(event) {
            
            // commented some things out that aren't in use for performance
            var touch = this.touch,
                change = touch.lastX - touch.startX,
                currentItemIndex;
            
            // since we're swiping, we should actually do something cool even if we only swiped a little
            if(touch.scroll === false) {
                
                event.preventDefault();
                
                // keep the current index in sync
                this.state.currentItemIndex = this.calculateItemIndexAtPosition(this.getPosition());
                
                // effectively uses the right edge instead of left edge to determine the index
                if(change < 0) {
                    this.state.currentItemIndex += 1;
                }
                
                // validate the new index
                currentItemIndex = this.forceValidItemIndex(this.state.currentItemIndex);
                this.state.currentItemIndex = -1; //invalidate the index to force the move
                
                // now match the position to the index we calculated in move
                this.toItem(currentItemIndex);
            }
            
            this.resetTouchEventListeners();
            
            this.unlock();
        },
        
        /**
         * Helper functions
         * */
        
        // iOS webkit: touchstart, touchmove, touchend, touchcancel
        // http://stackoverflow.com/questions/7056026/variation-of-e-touches-e-targettouches-and-e-changedtouches
        normalizeTouchEvent: function(event) {
            
            var originalEvent = event.originalEvent;
            
            if(originalEvent && originalEvent.changedTouches) {
                event.pageX = originalEvent.changedTouches[0].pageX;
                event.pageY = originalEvent.changedTouches[0].pageY;
            }
            
            return event;
        },
        
        // apply css for all the vendors specified in the init
        applyVendorStyle: function(target, prop, value, applyToValue) {
            
            var vendors = this.vendorPrefixes,
                css = {},
                i;
            
            // populate the css object
            for(i = 0; i < vendors.length; i++) {
                css[vendors[i] + prop] = applyToValue === true ? vendors[i] + value : value;
            }
            
            // then apply it like a bo.css
            target.css(css);
        },
        
        parseVendorStyle: function(target, prop) {
            
            var vendors = this.vendorPrefixes,
                css,
                i;
            
            for(i = 0; i < vendors.length; i++) {
                
                css = target.css(vendors[i] + prop);
                
                // IE9 returns 'none' like a jerk
                if(css && css !== 'none') {
                    return css;
                }
            }
            
            return false;
        },
        
        // guarantee that the index returned is within the range of items
        // if the arg is out of bounds, return 0 on lower and length-1 on upper
        forceValidItemIndex: function(index) {
            
            var state = this.state,
                startIndex = state.startItemIndex,
                endIndex = state.endItemIndex;
            
            return index < startIndex ? startIndex : index > endIndex ? endIndex : index;
        },

        // same as forceValidItemIndex, but for pages
        forceValidPageIndex: function(index) {
            
            var state = this.state,
                startIndex = 0,
                endIndex = state.pages.length - 1;

            return index < startIndex ? startIndex : index > endIndex ? endIndex : index;
        },

        // filter position to prevent from landing past the leftmost or rightmost edge
        forceValidPosition: function(pos) {
            
            var min = this.calculateMinPosition(),
                max = this.calculateMaxPosition();
            
            return pos < max ? max : pos > min ? min : pos;
        },
        
        // calculate the items per page using the state object if if exists or DOM measurement if not
        calculateItemsPerPage: function() {
            
            var state = this.state,
                maskSize,
                itemSize,
                calc;
            
            if(typeof state !== 'undefined' && typeof state.maskSize !== 'undefined') {
                maskSize = state.maskSize;
                itemSize = state.itemSize;
            } else {
                maskSize = this.mask.outerWidth();
                itemSize = $(this.items[0]).outerWidth();
            }
            
            calc = Math.floor(maskSize / itemSize);
            
            return calc === 0 ? 1 : calc;
        },
        
        // calculate the item that coincides with this position
        calculateItemIndexAtPosition: function(position) {
            
            var index = Math.floor(Math.abs(position / this.state.itemSize));
            
            return this.forceValidItemIndex(index);
        },
        
        calculateFirstVisibleItemIndexAtPosition: function(position) {
            
            var edge = position - 1;
            
            return this.calculateItemIndexAtPosition(edge);
        },
        
        // find the last item with a visible leading edge at this position
        calculateLastVisibleItemIndexAtPosition: function(position) {
            
            var state    = this.state,
                edge     = position - state.maskSize + 1;
            
            return this.calculateItemIndexAtPosition(edge);
        },
        
        calculateCurrentPosition: function() {

            var position = this.calculatePositionAtItemIndex(this.state.currentItemIndex);

            return this.forceValidPosition(position);
        },

        // returns the pixel destination position of the container based on the passed index
        calculatePositionAtItemIndex: function(index) {
            
            var state      = this.state,
                validIndex = this.forceValidItemIndex(index);
              
            // move to the leftmost edge of the current item
            return Math.floor((validIndex * state.itemSize) * -1);
        },
        
        calculateMinPosition: function() {
            
            return this.calculatePositionAtItemIndex(this.state.startItemIndex);
        },
        
        calculateMaxPosition: function() {
            
            var state = this.state,
                itemBounds = this.calculatePositionAtItemIndex(state.endItemIndex),
                containerBounds = itemBounds - (state.itemSize - state.maskSize);

            return containerBounds;
        },
        
        //return an array with item indexes representing the first item of each page
        calculatePages: function(items, itemsPerPage) {
            
            var realItems = items.not('.' + this.options.classNames.itemClone), // ignore clones
                numItems  = realItems.length,
                numPages  = Math.ceil(numItems / itemsPerPage),
                pages     = [],
                pageIndex = 0,
                itemIndex = 0;
            
            while(pageIndex < numPages) {
                
                if(itemIndex < numItems) {
                    pages[pageIndex] = itemIndex;
                    itemIndex += itemsPerPage;
                    pageIndex++;
                }
            }

            if(!this.options.infinite) {
                // augment the last page if it's a partial page
                if(numPages % itemsPerPage > 0) {
                    pages[pageIndex-1] = numItems - itemsPerPage;
                }
            }

            return pages;
        },
        
        /**
         * Position related functions
         */
        
        // this is the actual position, not the state position
        // the state position is a calculated value that relates to the current page
        getPosition: function() {
            
            var container = this.container,
                options   = this.options,
                translate,
                matrix;
            
            // need to parse the transform matrix to find the left value in FF
            if(options.transforms) {
                translate = this.parseVendorStyle(container, 'transform');
                
                if(translate) {
                    matrix = translate.substr(7, translate.length - 8).split(', ');
                    return matrix && matrix[4] ? matrix[4] : 0;
                }
            }
            
            // always 0 FF when using transforms
            return container.position().left;
        },
        
        filterInfinitePosition: function(destination) {
            
            var min          = this.calculateMinPosition(),
                max          = this.calculateMaxPosition(),
                lastPosition = this.calculatePositionAtItemIndex(this.state.lastItemIndex),
                offset       = this.state.itemSize * this.clones.length/2;

            // manipulate the destination to start inside the clones
            // instead of rewinding
            if(destination === min && lastPosition === max) {
                return destination + offset;
            } else if(destination === max && lastPosition === min) {
                return destination - offset;
            }
            
            return destination;
        },

        convertPositionToPercentage: function(position) {
            
            // handle non-transformational positioning
            if(this.options.transforms === false) {
                return (position / this.state.maskSize) * 100;
            } else {
                return (position / this.state.containerSize) * 100;
            }
        },
        
        // all repositioning routes through here
        move: function(position, time, easing) {
            
            var self            = this,
                container       = this.container,
                options         = this.options,
                cnames          = options.classNames,
                speed           = typeof time === 'undefined' ? 0 : time,
                easeFunc        = typeof easing === 'undefined' ? options.easing : easing,
                currentPosition = this.getPosition(),
                jump;
            
            // compare the new position with the current position
            // is there something to do?
            if(position === currentPosition) {
                return;
            } else {
                
                //handle infinite looping
                if(options.infinite && !this.infiniteFlag) {
                    
                    jump = this.filterInfinitePosition(position);
                    
                    if(jump !== position) {
                        
                        this.infiniteFlag          = true;
                        this.infinite.nextPosition = position;
                        this.infinite.nextTime     = speed;
                        this.infinite.nextEasing   = easeFunc;
                        
                        // 1ms deferred recursion
                        setTimeout(function() {
                            self.move(self.infinite.nextPosition, self.infinite.nextTime, self.infinite.nextEasing);
                            self.infiniteFlag = false;
                        }, 1);
                        
                        // set the current position to the jump location
                        position = jump;
                        speed = 0;
                    }
                }
                
                // its better to use a percentage in fluid mode because on window resize the value does not change
                // so the container doesn't jitter or wiggle while resizing
                if(this.isFluid()) {
                    position = this.convertPositionToPercentage(position) + '%';
                } else {
                    position = position + 'px';
                }
            }
            
            this.beforeMove();
            
            if(options.transitions) {
                // using css transitions -- cool beans.
                this.applyVendorStyle(container, 'transition-duration', speed + 'ms');
                this.applyVendorStyle(container, 'transition-timing-function', easeFunc);
                
                // kill old listeners, then listen for transition end (or just fire it)
                if(speed === 0) {
                    this.onTransitionEnd();
                } else {

                    this.el.off(this.events.transitionEnd, '.' + cnames.container);
                    this.el.on(this.events.transitionEnd, '.' + cnames.container, $.proxy(this.onTransitionEnd, this));
                }

                // ok we are using css transitions, but how are we setting the destination prop?
                if(options.transforms || options.transform3d) {
                    // sending the true flag applies the vendor prefix to the prop name too, eg -webkit-transform
                    this.applyVendorStyle(container, 'transition-property', speed > 0 ? 'transform' : 'none', true);
                } else {
                    this.applyVendorStyle(container, 'transition-property', speed > 0 ? 'left' : 'none');
                }
                
                if(options.transform3d) {
                    // using hardware accel, bam.
                    this.applyVendorStyle(container, 'transform', 'translate3d(' + position + ', 0, 0)');
                } else if(options.transforms) {
                    // not using 3d transforms, eh.
                    this.applyVendorStyle(container, 'transform', 'translate(' + position + ', 0)');
                } else {
                    // not using transforms, but we can still use transitions. meh.
                    container.stop().css({ left: position });
                }
            } else {
                // using javascript interval animation, boo.
                container.stop().animate({ left: position }, speed, easeFunc, $.proxy(this.afterMove, this));
            }
        },
        
        beforeMove: function() {
            
            var options = this.options,
                callback = options.callbacks.beforeMove;

            // get the items at the destination
            if(options.lazyLoad) {
                this.lazy(this.getVisibleItems());
            }

            this.syncControlsWithState();
            this.lock();
            
            this.dispatchEvent('beforemove', callback);
        },
        
        afterMove: function() {
            
            var options = this.options,
                callback = options.callbacks.afterMove;
            
            //get the items at this position
            if(options.lazyLoad) {
                this.lazy(this.getVisibleItemsAtPosition(this.getPosition()));
            }
            
            this.syncControlsWithState();
            this.unlock();
            
            this.dispatchEvent('aftermove', callback);

            // did the index change?
            if(this.state.indexChanged) {
                this.state.indexChanged = false;
                this.dispatchEvent('afterchange', options.callbacks.afterChange);
            }
        },
        
        dispatchEvent: function(event, func) {
            
            var state     = this.getState(),
                eventName = event.toLowerCase();
            
            // trigger the event from the object, not the DOM element
            // can't use namespaces here
            $(this).trigger(eventName, state);
            
            // callback
            if($.isFunction(func)) {
                func.call(this, state);
            }
        },
        
        lazy: function(collection) {
            
            var freeloaders;
            
            // lazy loading
            $(collection).each(function(index) {
                
                // iz there lazines among the visible items?
                //.filter(':visible')
                freeloaders = $(this).find('img[data-src]').not('img[src]');
                
                if(freeloaders.length > 0) {
                    
                    // listen for load complete, then remove data-src to prevent double loading
                    freeloaders.each(function() {
                        
                        $(this).bind('load', function() {
                            $(this).removeAttr('data-src');
                        }).attr('src', $(this).data('src'));
                    });
                }
            });
        },
        
        lock: function() {

            this.state.busy = true;
        },
        
        unlock: function() {

            this.state.busy = false;
        },
        
        getState: function() {
            
            // clone a copy of the state
            return $.extend({}, this.state);
        },
        
        // returns the cached jQuery collection of controls
        getControls: function() {
            
            return this.controls;
        },
        
        getHitArea: function() {

            var hit = this.options.automatic.hitArea;

            return hit && hit.length === 4 ? hit : false;
        },

        // returns the cached jQuery collection of items
        getItems: function() {
            
            return this.items;
        },
        
        // returns the jQuery object that wraps the page
        // if an invalid index is passed, the first page is returned
        getItemAt: function(index) {
            
            return this.items[this.forceValidItemIndex(index)];
        },
        
        getVisibleItemsAtPosition: function(position) {
            
            var startIndex = this.calculateFirstVisibleItemIndexAtPosition(position),
                endIndex   = this.calculateLastVisibleItemIndexAtPosition(position),
                items      = this.items;

            // +1 to include the last item in the slice
            return items.slice(startIndex, endIndex + 1);
        },
        
        // returns the jQuery collection of items
        getVisibleItemsAtIndex: function( index ) {
            
            var position = this.calculatePositionAtItemIndex(index);
                
            return this.getVisibleItemsAtPosition(position);
        },
        
        getVisibleItems: function() {
            
            return this.getVisibleItemsAtIndex(this.state.currentItemIndex);
        },
        
        // return true if the index changed, false if not
        setCurrentItemIndex: function(index) {
            
            var state            = this.state,
                currentItemIndex = state.currentItemIndex;
            
            //make sure the index corrolates to a real item, otherwise the first one will be used
            index = this.forceValidItemIndex(index);
            
            if(index !== currentItemIndex) {
                
                this.state.lastItemIndex = currentItemIndex;
                this.state.currentItemIndex = index;

                // set a flag to indicate that the index has changed
                // used in afterMove() to dispatch the afterChange event
                this.state.indexChanged = true;
                
                return true;
            }
            
            return false;
        },
        
        // if the state is not yet initialized the index is assumed to be 0
        getCurrentItemIndex: function() {
            
            var state = this.state;
            
            return state ? state.currentItemIndex : 0;
        },
        
        // get the next item
        // if options.wrapround, wrap around from last to first
        // otherwise stop at the last page
        getNextItemIndex: function() {
            
            return this.getItemIndex(1);
        },
        
        // get the previous item
        // if options.wrapround, wrap around from first to last
        // otherwise stop at the first page
        getPreviousItemIndex: function() {

            return this.getItemIndex(-1);
        },

        // dir = 1 or -1
        getItemIndex: function(dir) {

            var state            = this.state,
                currentItemIndex = state.currentItemIndex,
                startItemIndex   = state.startItemIndex,
                endItemIndex     = state.endItemIndex,
                forward          = dir > 0,
                maxBounds        = forward ? endItemIndex : startItemIndex,
                minBounds        = forward ? startItemIndex : endItemIndex;
            
            // are we already at the item boundary?
            return currentItemIndex === maxBounds
                ? (this.options.wraparound
                    ? minBounds
                    : maxBounds)
                : currentItemIndex + dir;
        },

        // changes the internal page index, the updates the state
        toItemInternal: function(itemOrIndex, time) {

            var state = this.state,
                items = this.items,
                index,
                indexChanged;
            
            // if the arg is a number, pass it through, otherwise find the page index in the list of pages
            index = $.isNumeric(itemOrIndex)
                ? itemOrIndex
                : $.inArray(itemOrIndex, items);
            
            // set the index, true returned if changed
            indexChanged = this.setCurrentItemIndex(index);
            
            // did the index change? if not there's nothing to do
            if(indexChanged) {
                this.syncPosition(time);
            }
        },

        // validate the page index, then route through toItem
        toPageInternal: function(index, time) {
            
            var state            = this.state,
                pages            = state.pages,
                currentItemIndex = state.currentItemIndex,
                itemIndex;
            
            // make sure the index corrolates to a real page, otherwise the first one will be shown
            index = this.forceValidPageIndex(index);
            
            // get the item id from the pages array now that the index is valid
            itemIndex = pages[index];
            
            // did the index change?
            if(itemIndex !== currentItemIndex) {
                this.toItemInternal(itemIndex, time);
            }
        },

        nextInternal: function() {
            
            if(this.isFluid()) {
                this.toNextItemInternal();
            } else {
                this.toNextPageInternal();
            }
        },

        previousInternal: function() {

            if(this.isFluid()) {
                this.toPreviousItemInternal();
            } else {
                this.toPreviousPageInternal();
            }
        },

        toNextItemInternal: function() {

            this.toItemInternal(this.getNextItemIndex());
        },

        toPreviousItemInternal: function() {

            this.toItemInternal(this.getPreviousItemIndex());
        },

        toNextPageInternal: function() {

            this.toPageInternal(this.getNextPageIndex());
        },

        toPreviousPageInternal: function() {

            this.toPageInternal(this.getPreviousPageIndex());
        },

        // calculate the next index using the current index and the number of items per page
        getNextPageIndex: function() {
            
            return this.getPageIndex(1);
        },
        
        // calculate the previous index using the current index and the number of items per page
        getPreviousPageIndex: function() {
            
            return this.getPageIndex(-1);
        },

        // dir = 1 or -1
        getPageIndex: function(dir) {

            var state            = this.state,
                pages            = state.pages,
                numPages         = pages.length,
                itemsPerPage     = state.itemsPerPage,
                currentItemIndex = state.currentItemIndex,
                currentPageIndex = Math.ceil(currentItemIndex / itemsPerPage),
                forward          = dir > 0,
                minBounds        = forward ? 0 : numPages - 1,
                maxBounds        = forward ? numPages - 1 : 0,
                index            = currentPageIndex + (1 * dir);
            
            // are we already at the first/last page boundary?
            return currentItemIndex === pages[maxBounds]
                ? (this.options.wraparound
                    ? minBounds
                    : maxBounds)
                : index;
        },

        //assertions

        elementIsValid: function() {

            var el        = this.el,
                options   = this.options,
                container = $('.' + options.classNames.container, el),
                items     = $('.' + options.classNames.item, container);
            
            // cache the result
            if(typeof this.validElement === 'undefined') {
                this.validElement = el && el.length && container && container.length && items && items.length > 1;
            }

            return this.validElement;
        },
        
        isFluid: function() {

            return this.options.mode === 'fluid';
        },
        
        isFixed: function() {

            return this.options.mode === 'fixed';
        },
        
        isLocked: function() {

            return this.state.busy;
        },
        
        isEnabled: function() {
            
            return this.state.enabled;
        },

        isCycling: function() {

            return this.state.cycling;
        },
        
        /**
         * Public API
         */

        next: function() {
            
            this.resetCycle();
            this.nextInternal();
        },
        
        previous: function() {
            
            this.resetCycle();
            this.previousInternal();  
        },

        toItem: function(itemOrIndex, time) {
            
            this.resetCycle();
            this.toItemInternal(itemOrIndex, time);
        },
        
        toPage: function(index, time) {
            
            this.resetCycle();
            this.toPageInternal(index, time);
        },
        
        //fluid mode: one item per page
        toNextItem: function() {
            
            this.resetCycle();
            this.toNextItemInternal();
        },
        
        toPreviousItem: function() {
            
            this.resetCycle();
            this.toPreviousItemInternal();
        },
        
        // fixed mode: calculated pages
        toNextPage: function() {
            
            this.resetCycle();
            this.toNextPageInternal();
        },
        
        toPreviousPage: function() {

            this.resetCycle();
            this.toPreviousPageInternal();
        },
        
        // add new items and re-measure the carousel
        addItems: function(elementsOrString, prepend) {
            
            if(prepend) {
                this.container.prepend(elementsOrString);
            } else {
                this.container.append(elementsOrString);
            }
            
            this.cacheItems();
            this.resize();
        },

        enable: function() {

            if(this.isEnabled()) {
                return;
            }

            var options = this.options;
            
            if(!this.elementIsValid()) {
                this.state.enabled = false;
                return;
            }
            
            this.addControls();

            if(options.automatic.enabled) {
                this.initCycle();
            }
            
            this.el.addClass(options.classNames.enabled);

            this.state.enabled = true;
        },
        
        disable: function() {

            if(!this.isEnabled()) {
                return;
            }
            
            if(!this.elementIsValid()) {
                this.state.enabled = false;
                return;
            }
            
            this.removeControls();

            // kill animations
            this.container.stop();

            if(this.isCycling()) {
                this.killCycle();
            }
            
            this.state.enabled = false;
            
            this.el.removeClass(this.options.classNames.enabled);
        },
        
        destroy: function() {
            
            if(!this.elementIsValid()) {
                return;
            }
            
            var options;

            this.disable();
            
            // remove added styles
            this.container.removeAttr('style');

            $.each(this.items, function(item) {
                $(this).removeAttr('style');
            });

            // remove clones
            this.clones.remove();
            
            // remove added classes
            this.el.removeClass(options.classNames.mask);
            
            // remove the resize listeners
            this.win.off(this.events.resize, $.proxy(this.onWindowResize, this));
        }
    };

    // window or current scope, use string for closure
    this['Revolver'] = Revolver;

}).call(this);
