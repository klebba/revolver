## Options

```
{
speed               : 1250,               // 
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
startAtItem         : 0,                  // for deep linking (zero indexed)
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

```

## JSLint

npm install -g jshint

jshint revolver.js --config .jshintrc

## http://closure-compiler.appspot.com/home

```
// ==ClosureCompiler==
// @compilation_level ADVANCED_OPTIMIZATIONS
// @output_file_name revolver.min.js
// @code_url https://raw.github.com/klebba/revolver/master/revolver.js
// ==/ClosureCompiler==
```
