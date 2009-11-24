var OPEN = 1,
    HIGH = 2,
    LOW  = 3,
    CLOSE = 4;

var colorhue = .6 || Math.random();
var color = "hsb(" + [colorhue, 1, .75] + ")";



Module("GTChart", function(m) {
    Class("View", {
        has: { width:  { is: "rw" },
               height: { is: "rw" },
               x   :   { is: "rw" },
               y   :   { is: "rw" },
               r   :   { is: "rw" },
               offset: { is: "rw" },
               loaded_offset: { is: "rw" },
               zones: { is: "rw" },
               blanket: { is: "rw" },
               cnt     : { is: "rw" },
               callbacks: { is: "rw" },
               vcursor: { is: "rw" },
               tmpbar: { is: "rw" },
               items_to_load: { is: "rw" }
             },
        after: {
            initialize: function() {
                this.zones = [];
                this.callbacks = [];
                var nb_items = this.nb_items();
                this.offset = this.cnt - nb_items ;
                this.loaded_offset = this.cnt - this.items_to_load;
                this.vcursor = this.r.rect(0, 0, 1, this.height).attr({stroke: "black", fill: "#fff", opacity: 0.1});

            }
        },
        methods: {
            nb_items: function() {
                return Math.floor( this.width / 10 );
            },
            new_zone: function(args) {
                var zone = new GTChart.Zone({ r: this.r, x: 10, y: args.y, width: this.width, height: args.height, view: this});
                this.zones.push(zone);
                return zone;
            },
            on_new_event: function(e) {
                var oldbar;
                if(e.type == 'tick' || e.type == 'bar') {
                    if(e.i <= this.cnt-1 && e.type == 'tick')
                        oldbar = this.tmpbar;

                    if(e.i > this.cnt-1) {
                        this.add_column(e.i-this.loaded_offset);
                        this.blanket.translate(-10, 0);
                        jQuery.each(this.zones, function() { this.blanket.translate(-10,0) });
                        this.offset++;
                        this.zones[0].resize();
                    }
                    var ret = this.zones[0].render_candle_item(e.i*10, e.prices);
                    this.tmpbar = ret[0];
                    this.zones[0]._callbacks[0][e.i - this.loaded_offset] = ret[1];
                    if(oldbar) oldbar.remove();
                }
            },
            scroll_right: function() {
                if (this.offset+this.nb_items() >= this.cnt) return;

                if (this.offset +this.nb_items() > this.loaded_offset+this.items_to_load) {
                    this.loaded_offset += this.items_to_load/2;
                    if (this.loaded_offset > this.cnt - this.items_to_load)
                        this.loaded_offset = this.cnt - this.items_to_load;
                    this.load();
                    this.blanket.toFront();
                }


                this.offset++;
                this.blanket.translate(-10, 0);
                jQuery.each(this.zones, function() { this.blanket.translate(-10,0) });
            },
            scroll_left: function() {
                if (this.offset == 0) return;

                if (this.offset < this.loaded_offset+10) {
                    this.loaded_offset -= this.items_to_load/2;
                    if (this.loaded_offset < 0)
                        this.loaded_offset = 0 
                    this.load();
                    this.blanket.toFront();
                }

                this.offset--;
                this.blanket.translate(10, 0);
                jQuery.each(this.zones, function() { this.blanket.translate(10,0) });
            },
            add_column: function(i) {
                var rect = this.r.rect(10*(i+this.loaded_offset), 0, 10, this.height).attr({translation: (this.x-(this.offset*10)-5)+",0", stroke: "none", fill: "#fff", opacity: 0});
                this.blanket.push(rect);
                var that = this;

                (function(i) {
                $(rect.node).mousemove(
                    function (e) {
                        that.vcursor.attr({x: e.pageX});
                    });
                $(rect.node).hover(
                    function (e) {
                        jQuery.each(that.zones, function() {
                            this.hi_callback(i);
                        });
                    },
                    function () {
                        jQuery.each(that.zones, function() {
                            this.ho_callback(i);
                            });
                    });
                })(i);
            },
            load: function(cb) {
                var req = 0;
                if (this.blanket)
                    this.blanket.remove();
                this.blanket = this.r.set();

                for (var i = 0; i<this.items_to_load; ++i) {
                    var column = this.add_column(i);
                    this.callbacks.push(function() {
                    });
                }

                var that = this;
                jQuery.each(this.zones,
                            function() {
                                ++req;
                                this.load(function() {
                                    if(!--req) {
                                        that.blanket.toFront();
                                        cb();
                                    }
                                }) });
            }
        }
    });
    Class("Zone", {
        has: { invert: { is: "rw" },
               ymax:   { is: "rw" },
               ymin:   { is: "rw" },
               r   :   { is: "ro" },
               x   :   { is: "rw" },
               y   :   { is: "rw" },
               width : { is: "rw" },
               height :{ is: "rw" },
               offset :{ is: "rw" },
               clip   :{ is: "rw" },
               blanket:{ is: "rw" },
               _callbacks:{ is: "rw" },
               _loaders:{ is: "rw" },
               label  :{ is: "rw" },
               view   :{ is: "rw" }
             },
        after: {
            initialize: function() {
                this._callbacks = [];
                this._loaders = [];
                this.r.rect(this.x, this.y, this.width, this.height).attr({stroke: 'black'});
                this.label = this.r.text(700, this.y+100).attr({font: '12px Fontin-Sans, Arial', fill: "#000"});
                this.blanket = this.r.set();
                this.clip = {'clip-rect': [this.x, this.y, this.width, this.height].join(",") };
            }
        },
        methods: {
            hi_callback: function(i) {
                var text = jQuery.map(this._callbacks,
                                      function(x) { return x[i] ? x[i]() : "" }
                                     ).join("\n")+" ";
                this.label.attr({text: text}).show();
            },
            ho_callback: function(i) {
                this.label.hide();
            },
            add_loader: function(uri, param, render) {
                var that = this;
                this._loaders.push(function(cb) {
                    param.start = that.view.loaded_offset;
                    param.end = that.view.loaded_offset+that.view.items_to_load-1;
                    jQuery.post(uri, param,
                                function(response, status) {
                                    render.apply(that, [response, param.start]);
                                    if (cb) cb();
                                }, 'json');
                });
            },
            load: function(cb) {
                var oldblanket = this.blanket;
                this.blanket = this.r.set();
                this.ymax = 0;
                this._callbacks = [];
                var req = this._loaders.length;
                jQuery.each(this._loaders,
                            function() {
                                this(function() {
                                    oldblanket.hide();
                                    oldblanket.remove();
                                    cb();
                                })
                            } );
            },
            rect: function( x, y, w, h) {
                return this.r.rect(x, this.ymax - y, w, h).attr(this.offset).attr(this.clip);
            },
            resize: function(data_high, data_low) {
                if(data_high)
                    this.ymax = Math.max.apply(this, data_high);
                if(data_low)
                    this.ymin = Math.min.apply(this, data_low);
                var yscale = this.height/(this.ymax-this.ymin);
                this.offset = { translation: [this.x-(this.view.offset*10), this.y/yscale], scale: [1,yscale,1,1] };
            },
            render_curve: function(data_set, start_idx, color) {
                var dx = 10;
                if (!color) color = 'blue';
                if (!this.ymax) {
                    this.resize(data_set, data_set);
                    if (this.ymin < 0) {
                        var p = this.r.path()
                            .moveTo(dx*start_idx, this.ymax)
                            .lineTo(dx*(start_idx+this.view.items_to_load), this.ymax)
                            .attr(this.offset).attr({stroke: 'black', opacity: 0.5});
                        this.blanket.push(p);
                    }
                }

                var p = this.r.path();
                var name = 'SMA 5';
                var callback = [];
                this._callbacks.push(callback);
                for (var i in data_set) {
                    var data = data_set[i];
                    var x = dx * (parseInt(i)+start_idx);
                    var y = this.ymax - data;
                    if (i == 0) {
                        p = p.moveTo(x, y);
                    }
                    else {
                        p = p.lineTo(x, y);
                    } 

                    (function(data, bar, i) {
                    callback.push(function () {
                        return name+": "+data;
                    })})(data);
                }
                p.attr(this.offset).attr(this.clip).attr({stroke: color});
                this.blanket.push(p);
            },
            render_bar: function(data_set, start_idx, color) {
                if (!color) color = 'red'
                var width = 6;
                if (!this.ymax) {
                    this.resize(data_set, data_set);
                }

                var dx = 10;
                for (var i in data_set) {
                    var data = data_set[i];
                    var x = dx * (parseInt(i)+start_idx);
                    var bar = data >= 0
                        ? this.rect(x-width/2, data, width+1, data-Math.max(0,this.ymin)).attr({fill: color, stroke: 'none'})
                        : this.rect(x-width/2, 0, width+1, 0-data).attr({fill: color, stroke: 'none'});
                    this.blanket.push(bar);
                }
            },
            render_candle_item: function(x, data) {
                var width = 6;
                var bar = this.r.set();
                var c = data[CLOSE] > data[OPEN] ? 'green' : 'red';
                bar.push(this.rect(x, data[HIGH], 1, data[HIGH]-data[LOW]).attr({fill: c, stroke: 'none'}));
                bar.push(this.rect(x-width/2, Math.max(data[OPEN], data[CLOSE]), width+1, Math.abs(data[CLOSE]-data[OPEN]) || 0.5).attr({fill: c, stroke: 'none'}));
                var that = this;
                var callback = function () {
                        return [data[0],
                                "Open: "+data[OPEN],
                                "High: "+data[HIGH],
                                "Low: "+ data[LOW],
                                "Close: "+data[CLOSE],
                               ].join("\n");
                    }
                return [bar, callback];
            },
            render_candle: function(data_set, start_idx) {
                this.resize(jQuery.map(data_set, function(data) { return data[HIGH] }),
                            jQuery.map(data_set, function(data) { return data[LOW] }));
                var dx = 10;

                var callback = [];
                this._callbacks.push(callback);
                for (var i in data_set) {
                    var data = data_set[i];
                    var x = dx * (parseInt(i)+start_idx);
                    var ret = this.render_candle_item(x, data);
                    this.blanket.push(ret[0]);
                    callback.push(ret[1]);
                }
            }
        }
    });
});
