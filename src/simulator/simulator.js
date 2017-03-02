'use strict';

// EclipseSimulator namespace
var EclipseSimulator = {

    DEBUG: true,

    View: function(location)
    {
        this.svg_container  = $('#svg-container').get(0);
        this.background     = $('.background');
        this.mobile_mapcont = $('#mobile-map-container').get(0);
        this.loading        = $('#loading').get(0);
        this.controls       = $('#controls').get(0);
        this.sun            = $('#sun').get(0);
        this.moon           = $('#moon').get(0);
        this.upbutton       = $('#upbutton').get(0);
        this.downbutton     = $('#downbutton').get(0);
        this.mapbutton      = $('#mapbutton').get(0);
        this.speed_btn_slow = $('#speed-button-slow').get(0);
        this.speed_btn_fast = $('#speed-button-fast').get(0);
        this.speed_selector = $('#speed-menu').get(0);
        this.speeddropdown  = $('#speed-menu-button').get(0);
        this.zoombutton     = $('#zoom').get(0);
        this.playbutton     = $('#play').get(0);
        this.slider         = $('#tslider').get(0);
        this.error_snackbar = $('#error-snackbar').get(0);
        this.slider_labels  = $('[id^=slabel]');
        this.mapcanvas      = $('#map-canvas').get(0);
        this.search_input   = $('#pac-input').get(0);
        this.topbar         = $('.floating-bar.top .inner').get(0);

        this.map            = new google.maps.Map(this.mapcanvas, {
                                center: EclipseSimulator.DEFAULT_LOCATION_COORDS,
                                zoom: 11
                            });
        this.map_visible    = false;
        this.search_box     = undefined;
        this.marker         = undefined;
        this.maps_place     = undefined;
        this.geocoder       = undefined;

        this.end_of_slider = false;

        // Sun/moon position in radians
        this.sunpos  = {x: 0, y: 0, r: 0.5 * Math.PI / 180, apparant_r: 0.62 * Math.PI / 180};
        this.moonpos = {x: 0, y: 0, r: 0.5 * Math.PI / 180};

        // Wide field of view in radians
        this.wide_fov = {
            // Max x fov is 140 degrees - will be set by first call to View.update_fov when the
            // simulator is in wide mode
            x: undefined,

            // Max y fov is 90 degrees
            y: undefined,

            // Desired y fov. Will be used unless this would mean fov x exceeding _x_max
            _y: 13 * Math.PI / 180,

            // Max x fov
            _x_max: 160 * Math.PI / 180,

            // Desired y REFERENCE FOV - this is what we use to enable the sun tracking in wide mode
            _y_ref_desired: 90 * Math.PI / 180,
            _y_ref:         undefined,
            _x_ref:         undefined,
        };

        // Zoomed field of view in radians
        this.zoomed_fov = {
            // Max x fov is 140 degrees - will be set by first call to View.update_fov when the
            // simulator is zoomed
            x: undefined,

            // Max y fov is 90 degrees
            y: undefined,

            // Desired y fov. Will be used unless this would mean fov x exceeding _x_max
            _y: 10 * Math.PI / 180,

            // Max x fov
            _x_max: 160 * Math.PI / 180,

            // Desired y REFERENCE FOV - this is what we use to enable the sun tracking in wide mode
            // this is never actually used for this fov, since it is the zoom fov but is included to
            // simplify the View.update_fov code
            _y_ref_desired: 10 * Math.PI / 180,
            _y_ref:         undefined,
            _x_ref:         undefined,
        };

        this.zoom_level    = EclipseSimulator.VIEW_ZOOM_WIDE;
        this.current_fov   = this.wide_fov;

        // Eclipse info
        this.eclipse_pos   = {
            alt: 0,
            az:  0,
        };
        this.eclipse_time  = new Date();
        this.current_time  = new Date();

        this.sun_beg_pos   = {
            alt: 0,
            az:  0,
        };
        this.sun_end_pos   = {
            alt: 0,
            az:  0,
        };

        this.location_name = location !== undefined ? location.name : EclipseSimulator.DEFAULT_LOCATION_NAME;

        this.playing       = false;
        this.play_speed    = EclipseSimulator.VIEW_PLAY_SPEED_SLOW;
    },

    Controller: function(location)
    {
        this.view  = new EclipseSimulator.View(location);
        this.model = new EclipseSimulator.Model(location);
    },

    Model: function(location)
    {
        // Current simulator coordinates
        this.coords = location !== undefined ? location.coords : EclipseSimulator.DEFAULT_LOCATION_COORDS;

        // Current simulator time
        this.date = new Date(EclipseSimulator.ECLIPSE_DAY);

        // Computed eclipse time -- temp value, this will be set when
        // Model.compute_eclipse_time_and_pos is called
        this.eclipse_time = new Date(EclipseSimulator.ECLIPSE_DAY);
    },

    // Convert degrees to radians
    deg2rad: function(v)
    {
        return v * Math.PI / 180;
    },

    // Convert radians to degrees
    rad2deg: function(v)
    {
        return v * 180 / Math.PI;
    },

    // Convert a to be on domain [0, 2pi)
    normalize_rad: function(a)
    {
        var pi2 = Math.PI * 2;
        return a - (pi2 * Math.floor(a / pi2));
    },

    // Compute positive distance in radians between two angles
    rad_diff: function(a1, a2)
    {
        a1 = EclipseSimulator.normalize_rad(a1);
        a2 = EclipseSimulator.normalize_rad(a2);

        var diff = a1 > a2 ? (a1 - a2) : (a2 - a1);

        return diff > Math.PI ? (2 * Math.PI) - diff : diff;
    },

    // Determine if angle a is greater than angle b
    // That is, if b < a <= (b + pi)
    rad_gt: function(a, b)
    {
        a = EclipseSimulator.normalize_rad(a);
        b = EclipseSimulator.normalize_rad(b);

        a = EclipseSimulator.normalize_rad(a - b);
        b = 0;

        return a > b && a <= Math.PI;
    },

    // Compute sun/moon angular seperation and moon radius
    // See https://en.wikipedia.org/wiki/Angular_distance
    compute_sun_moon_sep: function(sun, moon) {
        var a = (Math.sin(sun.alt) * Math.sin(moon.alt)) +
                (Math.cos(sun.alt) * Math.cos(moon.alt) * Math.cos(sun.az - moon.az));
        return Math.acos(a);
    },

    VIEW_MAP_MAX_H: 400,

    VIEW_MAP_TMARGIN: 70,

    VIEW_MAP_LMARGIN: 8,

    VIEW_ZOOM_WIDE: 'wide',

    VIEW_ZOOM_ZOOM: 'zoom',

    VIEW_SLIDER_STEP_MIN: {
        zoom: 0.3,
        wide: 0.3,
    },

    VIEW_BG_HILL_VALLEY_HEIGHT_PERCENT: 0.1888466413,

    VIEW_PHONE_WMAX: 600,

    VIEW_MAP_MAX_W: 800,

    VIEW_BG_COLOR_NIGHT:   [0,   0,   0],
    VIEW_BG_COLOR_DAY:     [181, 227, 248],
    VIEW_MOON_OPACITY:     0.65,
    VIEW_BG_IMG_MAX_GRAY:  0.75,

    VIEW_SLIDER_NSTEPS: 720,

    PLAY_REFRESH_RATE: 16,

    VIEW_PLAY_SPEED_SLOW: 'slow',

    VIEW_PLAY_SPEED_FAST: 'fast',

    VIEW_PLAY_SPEED: {
        zoom: {
            slow: 1000,
            fast: 4000
        },
        wide: {
            slow: 1000,
            fast: 4000
        },
    },

    DEFAULT_USER_ERR_MSG: 'An error occured',

    DEFAULT_USER_ERR_TIMEOUT: 2000,

    DEFAULT_LOCATION_NAME: 'Corvallis, OR, United States',

    DEFAULT_LOCATION_COORDS: {
        lat: 44.567353,
        lng: -123.278622,
    },

    ECLIPSE_DAY: new Date('08/21/2017'),

    ECLIPSE_ECOAST_HOUR: 20,

    ECLIPSE_WCOAST_HOUR: 16,

    PLAY_PAUSE_BUTTON: {
        true: 'play_circle_outline',
        false: 'pause_circle_outline',
    },

};


// =============================
//
// EclipseSimulator.View methods
//
// =============================

EclipseSimulator.View.prototype.init = function()
{
    // Needs to be called the first time as this will set the simulator size
    this._update_sim_size();

    // Have to create a reference to this, because inside the window
    // refresh function callback this refers to the window object
    var view = this;

    //This makes the sun move along with the slider
    //A step toward calculating and displaying the sun and moon at a specific time based on the slider
    $(this.slider).on('input', function() {
        view.playing = false;
        view.slider_change();
    });

    //Increments the slider on a click
    $(this.upbutton).click(function() {
        view.playing = false;
        view.slider_change('up');
    });

    //Decrements the slider on a click
    $(this.downbutton).click(function() {
        view.playing = false;
        view.slider_change('down');
    });

    $(this.zoombutton).click(function() {
        view.playing = false;
        view.toggle_zoom()
    });

    $(this.playbutton).click(function() {
        // If the slider is at the very end of the time range and the user hits
        // the play button again. It will restart the playing of the simulation
        // from the beginning.
        if(view.end_of_slider)
        {
          // Restart the slider at the beginning
          view.slider.value = -1*EclipseSimulator.VIEW_SLIDER_STEP_MIN[view.zoom_level]
                           * EclipseSimulator.VIEW_SLIDER_NSTEPS / 2;
        }

        view.playing = !view.playing;
        view.play_simulator_step(parseFloat(view.slider.value));
    });

    //toggle's the view play speed and disables the menu option for the current speed
    $(this.speed_selector).click(function() {
        if (view.play_speed == EclipseSimulator.VIEW_PLAY_SPEED_SLOW)
        {
            view.play_speed = EclipseSimulator.VIEW_PLAY_SPEED_FAST;
            $(view.speed_btn_fast).attr('disabled', true);
            $(view.speed_btn_slow).attr('disabled', false);
        }
        else
        {
            view.play_speed = EclipseSimulator.VIEW_PLAY_SPEED_SLOW;
            $(view.speed_btn_fast).attr('disabled', false);
            $(view.speed_btn_slow).attr('disabled', true);
        }
    });

    // Hide the map when the view initializes
    $(this.mapcanvas).hide();
    this._create_polygon_map();

    // Toggles the visibility of the map on click
    $(this.mapbutton).click(function() {
        view.playing = false;
        view.toggle_map();
    });

    this._init_top_bar();
    this.initialize_location_entry();

    // Rescale the window when the parent iframe changes size
    $(window).resize(function() {
        view._update_sim_size();
        view._adjust_size_based_control_ui();
        view._adjust_size_based_map_ui(0);
        view.update_fov();
        view.refresh();
    });

    view._adjust_size_based_control_ui();
    view._adjust_size_based_map_ui(0);
    this.set_play_speed_label();
    this.update_fov();
    this.refresh();
};

EclipseSimulator.View.prototype.initialize_location_entry = function()
{
    var view = this;

    var autocomplete_options = {
        componentRestrictions: {country: 'us'}
    };
    view.search_box = new google.maps.places.Autocomplete(this.search_input, autocomplete_options);

    view.marker = new google.maps.Marker({
        map: this.map,
        position: EclipseSimulator.DEFAULT_LOCATION_COORDS,
    });

    view.marker.setVisible(true);

    view.geocoder = new google.maps.Geocoder;

    // Listen for the event fired when the user selects a prediction and retrieve
    // more details for that place.
    view.search_box.addListener('place_changed', function() {

        view.playing = false;

        view.marker.setVisible(false);
        view.maps_place = view.search_box.getPlace();

        if (!view.maps_place.geometry)
        {
            var service = new google.maps.places.AutocompleteService();

            var service_options = {
                input: view.maps_place.name,
                componentRestrictions: {country: 'us'}
            };

            service.getPlacePredictions(service_options, function(predictions, status) {
                if (status != google.maps.places.PlacesServiceStatus.OK) {
                    view.display_error_to_user("Location not found");
                    return;
                }

                view.geocoder.geocode({'placeId': predictions[0].place_id}, function(results, status) {
                    if (status === 'OK') {
                        if (results[0].formatted_address.includes('USA')) {

                            view.maps_place = results[0];

                            view.marker.setVisible(false);

                            // Update location name
                            view.name = results[0].formatted_address;
                            view.search_input.value = results[0].formatted_address;

                            if (!view.maps_place)
                            {
                                view.display_error_to_user("No details available for: " + view.maps_place.name);
                                return;
                            }

                            view.map.setCenter(view.maps_place.geometry.location);
                            view.map.setZoom(11);

                            view.marker.setPosition(view.maps_place.geometry.location);
                            view.marker.setVisible(true);

                            // Update location name
                            view.name = view.maps_place;

                            $(view).trigger('EclipseView_location_updated', view.maps_place.geometry.location);

                        } else {
                            view.display_error_to_user("Simulator is restricted to the United States");
                            return;
                        }
                    } else {
                        view.display_error_to_user("Location not found");
                        return;
                    }
                });

            });
            return;
        } else {

            // If the place has a geometry, then present it on a map.
            if (view.maps_place.geometry.viewport != undefined) {
                view.map.fitBounds(view.maps_place.geometry.viewport);
                view.map.setZoom(11);
            } else {
                view.map.setCenter(view.maps_place.geometry.location);
                view.map.setZoom(11);
            }
            view.marker.setPosition(view.maps_place.geometry.location);
            view.marker.setVisible(true);

            // Update location name
            view.name = view.maps_place.formatted_address;
            $(view).trigger('EclipseView_location_updated', view.maps_place.geometry.location);
        }
    });

    google.maps.event.addListener(view.map, 'click', function(event) {

        view.maps_place = event.latLng;

        var latlng = {lat: view.maps_place.lat(), lng: view.maps_place.lng()};

        view.geocoder.geocode({'location': latlng}, function(results, status) {
            if (status === 'OK') {
                if (results[1].formatted_address.includes('USA')) {

                    view.marker.setVisible(false);

                    // Update location name
                    view.name = results[1].formatted_address;
                    view.search_input.value = results[1].formatted_address;

                    if (!view.maps_place)
                    {
                        view.display_error_to_user("No details available for: " + view.maps_place.name);
                        return;
                    }

                    view.marker.setPosition(view.maps_place);
                    view.marker.setVisible(true);

                    // Update location name
                    view.name = view.maps_place;

                    $(view).trigger('EclipseView_location_updated', view.maps_place);

                } else {
                    view.display_error_to_user("Simulator is restricted to the United States");
                    return;
                }
            } else {
                view.display_error_to_user("Location not found");
                return;
            }
        });

    });

    // Set initial searchbox text
    this.search_input.value = this.location_name;
};

EclipseSimulator.View.prototype._update_sim_size = function(zoomed = false)
{
    var h = $(window).height();
    var w = $(window).width();

    var svg_margin_top = 0;
    var svg_h          = h;
    if (!zoomed)
    {
        // Add buffer zone where searchbox is - do not want sun/moon
        // to disappear behid the search box
        svg_margin_top = this.search_input.getBoundingClientRect().bottom;
        svg_h         -= svg_margin_top;

        // Add bottom buffer - define altitude 0 to be the bottom of the hill valleys
        svg_h -= h * EclipseSimulator.VIEW_BG_HILL_VALLEY_HEIGHT_PERCENT;
    }

    $(this.svg_container).css({
        'height': svg_h,
        'width':  w,
        'top':    svg_margin_top,
    });
    this.background.css({
        'height': h,
        'width':  w,
    });

    $(this.loading).css('height', w + 'px');

    return {
        height: h,
        width:  w,
        svg_h:  svg_h,
    }
};

EclipseSimulator.View.prototype.show = function()
{
    this.background.show();
    $([this.svg_container, this.sun, this.moon]).show();
};

EclipseSimulator.View.prototype.refresh = function(env_size_override = undefined)
{
    if (this.zoom_level == EclipseSimulator.VIEW_ZOOM_ZOOM)
    {
        var az_center  = this.sunpos.az;
        var alt_center = this.sunpos.alt;
    }
    else
    {
        var centers    = this.compute_wide_mode_altaz_centers();
        var az_center  = centers.az;
        var alt_center = centers.alt;
    }

    // Position sun/moon. Cannot do this until window is displayed
    this.position_body_at_percent_coords(
        this.sun,
        {
            x: this.get_ratio_from_altaz(this.sunpos.az,  az_center,  this.current_fov.x, this.sunpos.r),
            y: this.get_ratio_from_altaz(this.sunpos.alt, alt_center, this.current_fov.y, this.sunpos.r),
            r: this.get_ratio_from_body_angular_r(this.sunpos.apparant_r, this.sunpos.alt, alt_center),
        },
        env_size_override
    );
    this.position_body_at_percent_coords(
        this.moon,
        {
            x: this.get_ratio_from_altaz(this.moonpos.az,  az_center,  this.current_fov.x, this.moonpos.r),
            y: this.get_ratio_from_altaz(this.moonpos.alt, alt_center, this.current_fov.y, this.moonpos.r),
            r: this.get_ratio_from_body_angular_r(this.moonpos.r, this.moonpos.alt, alt_center),
        },
        env_size_override
    );

    // === Update background and moon color === //

    // Compute percent of eclipse and raise it to the 6th power
    // this achieves the "sudden darkness" effect
    var p = this.compute_percent_eclipse();
    p     = Math.pow(p, 6);

    // Compute sky color - this is the same color used for the moon
    var rgba_str = this.get_rgba_string(p, EclipseSimulator.VIEW_BG_COLOR_DAY,
                                        EclipseSimulator.VIEW_BG_COLOR_NIGHT);

    // Update background and moon lightness
    this.update_bg_lightness(p, rgba_str);
    this.update_moon_lightness(rgba_str);
};

EclipseSimulator.View.prototype.get_environment_size = function()
{
    return {
        width:  this.svg_container.getBoundingClientRect().width,
        height: this.svg_container.getBoundingClientRect().height,
    };
};

EclipseSimulator.View.prototype.position_body_at_percent_coords = function(target, pos, env_size_override = undefined)
{
    var env_size = env_size_override === undefined ? this.get_environment_size()
                                                   : env_size_override;

    // This happens early on in initialization
    if (isNaN(pos.r) || isNaN(pos.x) || isNaN(pos.y) || pos.r < 0)
    {
        return;
    }

    // Adjust radius
    $(target).attr('r', (env_size.height * pos.r));

    // with SVG, (0, 0) is top left corner
    $(target).attr('cy', (env_size.height * (1 - pos.y)));

    $(target).attr('cx', (env_size.width * pos.x));

};

EclipseSimulator.View.prototype.get_ratio_from_body_angular_r = function(r, alt, center)
{
    var x = EclipseSimulator.rad_diff(alt, center);
    return (Math.sin(x + r) - Math.sin(x)) / (2 * Math.sin(this.current_fov.y / 2));
};

EclipseSimulator.View.prototype.get_ratio_from_altaz = function(altaz, center, fov, body_r)
{
    var dist_from_center = Math.sin(altaz - center);
    var half_fov_width   = Math.sin(fov / 2);

    if (this.out_of_view(altaz, center, fov, body_r))
    {
        return -0.5;
    }

    return 0.5 + (0.5 * dist_from_center / half_fov_width);
};

EclipseSimulator.View.prototype.out_of_view = function(altaz, center, fov, body_r)
{
    var bound = center + (fov / 2);
    var dist  = EclipseSimulator.rad_diff(bound, altaz);

    // Body off screen in positive direction
    if (EclipseSimulator.rad_gt(altaz, bound) && dist > body_r)
    {
        return true;
    }

    bound = center - (fov / 2);
    dist  = EclipseSimulator.rad_diff(bound, altaz);

    // Body off screen in negative direction
    if (EclipseSimulator.rad_gt(bound, altaz) && dist > body_r)
    {
        return true;
    }

    return false;
};

EclipseSimulator.View.prototype.slider_change = function(direction)
{
    var current = parseFloat(this.slider.value);
    var offset  = 0;
    var max_offset = EclipseSimulator.VIEW_SLIDER_STEP_MIN[this.zoom_level]
                     * EclipseSimulator.VIEW_SLIDER_NSTEPS / 2;

    if(this.slider.value >= max_offset) this.end_of_slider = true;

    if (direction === 'up')
    {
        offset = EclipseSimulator.VIEW_SLIDER_STEP_MIN[this.zoom_level];
    }
    else if (direction === 'down')
    {
        offset = -EclipseSimulator.VIEW_SLIDER_STEP_MIN[this.zoom_level];
    }

    var new_val = current + offset;
    this.slider.MaterialSlider.change(new_val);
    $(this).trigger('EclipseView_time_updated', new_val);
};


EclipseSimulator.View.prototype.play_simulator_step = function(time_val)
{
    $(this.playbutton).find('i').text(EclipseSimulator.PLAY_PAUSE_BUTTON[!this.playing]);

    // Stop playing
    if (!this.playing)
    {
        return;
    }

    var max_offset = EclipseSimulator.VIEW_SLIDER_STEP_MIN[this.zoom_level]
                     * EclipseSimulator.VIEW_SLIDER_NSTEPS / 2;

    if (time_val >= max_offset)
    {
        this.end_of_slider = true;
        this.playing = false;
        $(this.playbutton).find('i').text(EclipseSimulator.PLAY_PAUSE_BUTTON[!this.playing]);
        return;
    }

    this.end_of_slider = false;

    this.slider.MaterialSlider.change(time_val);
    $(this).trigger('EclipseView_time_updated', time_val);

    var view = this;
    setTimeout(function() {
        var step_mins = EclipseSimulator.VIEW_PLAY_SPEED[view.zoom_level][view.play_speed]
                        * EclipseSimulator.PLAY_REFRESH_RATE / 60 / 1000;
        view.play_simulator_step(time_val + step_mins);
    }, EclipseSimulator.PLAY_REFRESH_RATE);
};

EclipseSimulator.View.prototype.set_play_speed_label = function()
{
    $(this.speed_btn_slow).text(EclipseSimulator.VIEW_PLAY_SPEED[this.zoom_level][EclipseSimulator.VIEW_PLAY_SPEED_SLOW] + 'X');
    $(this.speed_btn_fast).text(EclipseSimulator.VIEW_PLAY_SPEED[this.zoom_level][EclipseSimulator.VIEW_PLAY_SPEED_FAST] + 'X');
}

EclipseSimulator.View.prototype.toggle_loading = function()
{
    $(this.loading).toggle();
};

EclipseSimulator.View.prototype.reset_controls = function()
{
    // Need this check in case MDL has not finished initializing
    if (this.slider.MaterialSlider !== undefined)
    {
        this.slider.MaterialSlider.change(0);
    }
};

EclipseSimulator.View.prototype.display_error_to_user = function(error_msg, timeout)
{
    error_msg = error_msg === undefined ? EclipseSimulator.DEFAULT_USER_ERR_MSG
                                        : error_msg;

    timeout = timeout === undefined ? EclipseSimulator.DEFAULT_USER_ERR_TIMEOUT
                                    : timeout;

    var data = {
        message:        error_msg,
        timeout:        timeout,
        actionHandler:  undefined,
        actionText:     '',
    };

    this.error_snackbar.MaterialSnackbar.showSnackbar(data);
};

EclipseSimulator.View.prototype.update_slider_labels = function()
{
    var slider_range_ms = 1000 * 60 * EclipseSimulator.VIEW_SLIDER_NSTEPS
                          * EclipseSimulator.VIEW_SLIDER_STEP_MIN[this.zoom_level];
    var tick_sep_ms     = (slider_range_ms / (this.slider_labels.length - 1));
    var date            = new Date(this.eclipse_time.getTime() - (slider_range_ms / 2));

    for (var i = 0; i < this.slider_labels.length; i++)
    {
        // Zero padding in js is gross
        var mins = "" + date.getMinutes();
        mins     = mins.length == 1 ? "0" + mins : mins;

        $(this.slider_labels[i]).text(date.getUTCHours() + ':' + mins);
        date.setTime(date.getTime() + tick_sep_ms);
    }
};

EclipseSimulator.View.prototype.toggle_zoom = function()
{
    if (this.zoom_level === EclipseSimulator.VIEW_ZOOM_WIDE)
    {
        this.zoom_level  = EclipseSimulator.VIEW_ZOOM_ZOOM;
        this.current_fov = this.zoomed_fov;
        var label        = 'zoom_out';

        var new_env_size = this._update_sim_size(true);

        // Hide the hills/clouds/people/etc
        $(this.background[1]).hide();
    }
    else
    {
        this.zoom_level  = EclipseSimulator.VIEW_ZOOM_WIDE;
        this.current_fov = this.wide_fov;
        var label        = 'zoom_in';
        var zooming_in   = false;

        var new_env_size = this._update_sim_size(false);

        // Show the hills/clouds/people/etc
        $(this.background[1]).show();
    }
    $(this.zoombutton).find('i').text(label);

    // Update the slider labels and bounds
    this.update_slider();
    this.set_play_speed_label();

    // Here we have to override the environment size, as the call to _update_sim_size
    // does not take immediately - the amount of time it takes in undefined, so to be sure
    // update_fov and refresh work correctly we must override with the new values.
    new_env_size.height = new_env_size.svg_h;
    this.update_fov(new_env_size);
    this.refresh(new_env_size);
};

EclipseSimulator.View.prototype.update_eclipse_info = function(info)
{
    this.eclipse_pos = {
        alt: info.alt,
        az:  info.az,
    };
    this.eclipse_time.setTime(info.time.getTime());
};

EclipseSimulator.View.prototype.update_sun_moon_pos = function(sunpos, moonpos)
{
    this.sunpos.alt  = sunpos.alt;
    this.sunpos.az   = sunpos.az;
    this.moonpos.alt = moonpos.alt;
    this.moonpos.az  = moonpos.az;
}

EclipseSimulator.View.prototype.update_fov = function(env_size_override = undefined)
{
    var env_size  = env_size_override === undefined ? this.get_environment_size()
                                                    : env_size_override;
    var ratio         = env_size.width / env_size.height;
    var desired_x     = this.current_fov._y * ratio;
    var desired_x_ref = this.current_fov._y_ref_desired * ratio;

    // Window aspect ratio prevents desired y fov. Using the desired y fov, this.current_fov._y
    // would result in an x fov that is greater than the max allowed.
    if (desired_x > this.current_fov._x_max)
    {
        this.current_fov.x = this.current_fov._x_max
        this.current_fov.y = this.current_fov._x_max / ratio;
    }
    else
    {
        this.current_fov.x = desired_x;
        this.current_fov.y = this.current_fov._y;
    }

    if (desired_x_ref > this.current_fov._x_max)
    {
        this.current_fov._x_ref = this.current_fov._x_max
        this.current_fov._y_ref = this.current_fov._x_max / ratio;
    }
    else
    {
        this.current_fov._x_ref = desired_x_ref;
        this.current_fov._y_ref = this.current_fov._y_ref_desired;
    }
};

// Computes an intermediate color between min and max, converts this color to an rgb string,
// This string is of the form 'rgba(x, y, z, a)' where x, y, and z are numbers in [0, 255]
// and a is an alpha value in [0, 1]. alpha is not computed, just returned.
//
// color_percent: Percentage min and max for the intermediate value - this value should be on the
//                interval [0, 1]
//
// start:         The starting color value, i.e. if percent 0 is passed in, start will be returned.
//                This is a 3 element array with numeric values corresponding to the red, green,
//                and blue color values. These numbers should be in [0, 255].
//
// end:           The ending color value, i.e., if percent 1 in passed in, end will be returned.
//                Format is the same as min.
//
// a:             Optional alpha - not changed, just added to rgba string
EclipseSimulator.View.prototype.get_rgba_string = function(color_percent, start, end, a = 1)
{
    // new values to be set to default minimum
    var new_rgb = [0, 0, 0];

    // Compute new color value based on percent and floor to integer
    for (var i = 0; i < 3; i++)
    {
        var diff   = end[i] - start[i];
        new_rgb[i] = Math.floor(color_percent * diff + start[i]);
    }

    // Create rgb str in std css format
    return "rgba(" + new_rgb[0] + "," + new_rgb[1] + "," + new_rgb[2] + "," + a + ")";
};

EclipseSimulator.View.prototype.update_bg_lightness = function(p, rgba_str)
{
    $(this.background[0]).css('background-color', rgba_str);

    // Convert to percent
    p  = Math.min(p, EclipseSimulator.VIEW_BG_IMG_MAX_GRAY);
    p *= 100;
    var filter_str = 'grayscale(' + p + '%) brightness(' + (100 - p) + '%)';

    $(this.background[1]).css({
        'filter': filter_str,
        '-webkit-filter': filter_str,
    });
};

EclipseSimulator.View.prototype.update_moon_lightness = function(rgba_str)
{
    $(this.moon).attr('fill', rgba_str);
};

EclipseSimulator.View.prototype.update_slider = function()
{
    var slider_minmax = EclipseSimulator.VIEW_SLIDER_NSTEPS
                        * EclipseSimulator.VIEW_SLIDER_STEP_MIN[this.zoom_level] / 2;

    // If the current slider position is out of bounds, reset the time to eclipse time
    if (this.slider.value > slider_minmax || this.slider.value < -slider_minmax)
    {
       this.slider.MaterialSlider.change(0);
       this.slider_change();
    }

    $(this.slider).attr('min', -slider_minmax);
    $(this.slider).attr('max', slider_minmax);
    $(this.slider).attr('step', EclipseSimulator.VIEW_SLIDER_STEP_MIN[this.zoom_level]);

    // Re-render the slider as it now has a new position, since its bounds have changed
    if (this.slider.MaterialSlider !== undefined)
    {
        this.slider.MaterialSlider.boundChangeHandler();
    }

    this.update_slider_labels();
};

// Compute the percent of the eclipse
// sun_r and moon_r correspond to the radius (In radians) of each body
// Returns a percent between 0 and 1
EclipseSimulator.View.prototype.compute_percent_eclipse = function()
{
    // Avoid repeated attribute lookups
    var sun_r  = this.sunpos.r;
    var moon_r = this.moonpos.r;

    // Angular separation
    var sep        = EclipseSimulator.compute_sun_moon_sep(this.sunpos, this.moonpos);
    var lune_delta = this._compute_lune_delta(sun_r, moon_r, sep);
    var lune_area  = this._compute_lune_area(sun_r,  moon_r, sep, lune_delta);

    // Total solar eclipse
    if (lune_delta == 0)
    {
        var percent_eclipse = 1;
    }
    // No eclipse
    else if (lune_delta == -1)
    {
        var percent_eclipse = 0;
    }
    else
    {
        var percent_eclipse = 1 - (lune_area / (Math.PI * sun_r * sun_r))
    }

    if (EclipseSimulator.DEBUG)
    {
        console.log("Percent eclipse: " + percent_eclipse);
    }

    return percent_eclipse;
};

// Compute size of lune in radians
// http://mathworld.wolfram.com/Lune.html
EclipseSimulator.View.prototype._compute_lune_delta = function(sun_r, moon_r, sep)
{
    var lune_delta = -1;

    if (EclipseSimulator.DEBUG)
    {
        console.log('sep: ' + sep + ' sun_r + moon_r: ' + (sun_r + moon_r));
    }

    if (sep < (sun_r + moon_r))
    {
        var inner = ( sun_r + moon_r + sep) *
                    (-sun_r + moon_r + sep) *
                    (sun_r  - moon_r + sep) *
                    (sun_r  + moon_r - sep);

        if (inner < 0)
        {
            lune_delta = 0;
        }
        else
        {
            lune_delta = 0.25 * Math.sqrt(inner);
        }
    }

    return lune_delta;
};

// Assumes lune_delta > 0
EclipseSimulator.View.prototype._compute_lune_area = function(sun_r, moon_r, sep, lune_delta)
{
    // Avoid computing the same thing over and over again
    var moon_r2 = moon_r * moon_r;
    var sun_r2  = sun_r  * sun_r;
    var sep2    = sep * sep;

    var lune_area = (2 * lune_delta) +
                    (sun_r2  * Math.acos((moon_r2 - sun_r2 - sep2) / (2 * sun_r  * sep))) -
                    (moon_r2 * Math.acos((moon_r2 - sun_r2 + sep2) / (2 * moon_r * sep)));

    return lune_area;
};

EclipseSimulator.View.prototype.is_phone = function()
{
    return this.get_environment_size().width < EclipseSimulator.VIEW_PHONE_WMAX;
};

EclipseSimulator.View.prototype._top_bar_w = function(map_open = false)
{
    var width = this._top_bar_control_w(map_open);
    if (map_open && !this.is_phone())
    {
        width += this._map_w(true);
    }

    return width;
};

EclipseSimulator.View.prototype._top_bar_control_w = function(map_open = false)
{
    var control_width = $(this.search_input).outerWidth(true);
    var is_phone = this.is_phone();

    if (!is_phone)
    {
        control_width += $(this.zoombutton).outerWidth(true);
    }

    if (!map_open || is_phone)
    {
        // This is kind of a hack. The zoom button and map button are the same size.
        // The reason we don't just use the map button here, is because when the map
        // is open and the map button is actually over the map,
        // $(this.mapbutton).outerWidth(true) returns -8
        control_width += $(this.zoombutton).outerWidth(true);
    }

    return control_width;
};

EclipseSimulator.View.prototype._map_w = function(include_margin = false)
{
    var width = this.get_environment_size().width;

    if (this.is_phone())
    {
        return width;
    }

    var control_width = this._top_bar_control_w(true);
    width            -= control_width;
    width             = Math.min(width, EclipseSimulator.VIEW_MAP_MAX_W);

    if (!include_margin)
    {
        width -= EclipseSimulator.VIEW_MAP_LMARGIN;
    }

    return width;
};

EclipseSimulator.View.prototype._init_top_bar = function()
{
    // Initialize top bar width
    $(this.topbar).css('width', this._top_bar_w());

    if (this.is_phone())
    {
        $(this.zoombutton).hide();
    }
};

EclipseSimulator.View.prototype._adjust_size_based_control_ui = function()
{
    if (this.is_phone())
    {
        $(this.speeddropdown).hide();
        $(this.upbutton).hide();
        $(this.downbutton).hide();

        for (var i = 0; i < this.slider_labels.length; i++)
        {
            if (i % 2 == 1) {
                $(this.slider_labels[i]).hide();
            }
        }
    }
    else
    {
        $(this.slider_labels).show();
        $(this.speeddropdown).show();
        $(this.upbutton).show();
        $(this.downbutton).show();
    }
};

EclipseSimulator.View.prototype._adjust_size_based_map_ui = function(timeout = 200)
{
    // Adjust map button icon and map width, if it is open
    if (this.map_visible)
    {
        $(this.mapcanvas).css('width', this._map_w());
        var icon = this.is_phone() ? 'arrow_upward' : 'arrow_back';
    }
    else
    {
        var icon = 'map';
    }
    $(this.mapbutton).find('i').text(icon);

    // Show/hide zoom button, restructure top bar DOM as needed
    if (this.is_phone())
    {
        if (this.zoom_level == EclipseSimulator.VIEW_ZOOM_ZOOM)
        {
            this.toggle_zoom();
        }
        $(this.zoombutton).hide();
        this.mobile_mapcont.appendChild(this.mapcanvas);
    }
    else
    {
        $(this.zoombutton).show();
        this.mapbutton.parentNode.insertBefore(this.mapcanvas, this.mapbutton);
    }

    var map_height = Math.min(
        $(window).height() - EclipseSimulator.VIEW_MAP_TMARGIN,
        EclipseSimulator.VIEW_MAP_MAX_H
    );
    $(this.mapcanvas).css('height', map_height + 'px');

    // Adjust top bar width
    $(this.topbar).animate({'width': this._top_bar_w(this.map_visible) + 'px'}, timeout);
};

EclipseSimulator.View.prototype.toggle_map = function()
{
    this.map_visible = !this.map_visible;

    var view = this;
    var center_map = function() {
        var center = view.map.getCenter();
        google.maps.event.trigger(view.map, "resize");
        view.map.setCenter(center);
    }

    // Reposition the map and zoom buttons
    $(this.mapbutton).toggleClass('map-open', 200);
    $(this.zoombutton).toggleClass('map-open');

    this._adjust_size_based_map_ui();

    // Show the map and center it
    $(this.mapcanvas).toggle(200, center_map);
};

EclipseSimulator.View.prototype._create_polygon_map = function()
{
  var eclipse_path_coordinates = [{lat: 39.995, lng: -171.748}, {lat: 41.495, lng: -164.505}, {lat: 42.855, lng: -156.937}, {lat: 43.593, lng: -152.105}, {lat: 44.1, lng: -148.257}, {lat: 44.472, lng: -144.965}, {lat: 44.752, lng: -142.047}, {lat: 44.963, lng: -139.4}, {lat: 45.12, lng: -136.963}, {lat: 45.233, lng: -134.695}, {lat: 45.308, lng: -132.568}, {lat: 45.35, lng: -130.56}, {lat: 45.365, lng: -128.655}, {lat: 45.355, lng: -126.84}, {lat: 45.322, lng: -125.105}, {lat: 45.27, lng: -123.442}, {lat: 45.198, lng: -121.843}, {lat: 45.11, lng: -120.305}, {lat: 45.007, lng: -118.82}, {lat: 44.888, lng: -117.385}, {lat: 44.755, lng: -115.997}, {lat: 44.612, lng: -114.65}, {lat: 44.455, lng: -113.345}, {lat: 44.288, lng: -112.077}, {lat: 44.11, lng: -110.842}, {lat: 43.923, lng: -109.642}, {lat: 43.727, lng: -108.472}, {lat: 43.522, lng: -107.332}, {lat: 43.307, lng: -106.218}, {lat: 43.085, lng: -105.132}, {lat: 42.855, lng: -104.07}, {lat: 42.618, lng: -103.032}, {lat: 42.375, lng: -102.015}, {lat: 42.123, lng: -101.02}, {lat: 41.867, lng: -100.043}, {lat: 41.603, lng: -99.087}, {lat: 41.333, lng: -98.148}, {lat: 41.058, lng: -97.227}, {lat: 40.777, lng: -96.322}, {lat: 40.49, lng: -95.432}, {lat: 40.198, lng: -94.555}, {lat: 39.902, lng: -93.693}, {lat: 39.598, lng: -92.843}, {lat: 39.292, lng: -92.007}, {lat: 38.98, lng: -91.182}, {lat: 38.663, lng: -90.367}, {lat: 38.342, lng: -89.562}, {lat: 38.015, lng: -88.767}, {lat: 37.685, lng: -87.98}, {lat: 37.35, lng: -87.202}, {lat: 37.012, lng: -86.432}, {lat: 36.668, lng: -85.667}, {lat: 36.32, lng: -84.91}, {lat: 35.968, lng: -84.157}, {lat: 35.612, lng: -83.41}, {lat: 35.252, lng: -82.667}, {lat: 34.887, lng: -81.927}, {lat: 34.518, lng: -81.19}, {lat: 34.145, lng: -80.457}, {lat: 33.767, lng: -79.723}, {lat: 33.385, lng: -78.992}, {lat: 32.998, lng: -78.26}, {lat: 32.608, lng: -77.528}, {lat: 32.212, lng: -76.795}, {lat: 31.812, lng: -76.06}, {lat: 31.408, lng: -75.323}, {lat: 30.998, lng: -74.582}, {lat: 30.585, lng: -73.835}, {lat: 30.165, lng: -73.083}, {lat: 29.74, lng: -72.325}, {lat: 29.312, lng: -71.56}, {lat: 28.875, lng: -70.785}, {lat: 28.435, lng: -70.002}, {lat: 27.987, lng: -69.205}, {lat: 27.533, lng: -68.398}, {lat: 27.073, lng: -67.575}, {lat: 26.607, lng: -66.737}, {lat: 26.133, lng: -65.88}, {lat: 25.65, lng: -65.003}, {lat: 25.16, lng: -64.103}, {lat: 24.662, lng: -63.178}, {lat: 24.152, lng: -62.225}, {lat: 23.633, lng: -61.24}, {lat: 23.102, lng: -60.218}, {lat: 22.558, lng: -59.155}, {lat: 22.002, lng: -58.045}, {lat: 21.43, lng: -56.88}, {lat: 20.84, lng: -55.652}, {lat: 20.232, lng: -54.35}, {lat: 19.6, lng: -52.958}, {lat: 18.94, lng: -51.46}, {lat: 18.247, lng: -49.828}, {lat: 17.513, lng: -48.023}, {lat: 16.725, lng: -45.99}, {lat: 15.86, lng: -43.627}, {lat: 14.877, lng: -40.74}, {lat: 13.66, lng: -36.81}, {lat: 11.26, lng: -27.332}, {lat: 10.782, lng: -27.552}, {lat: 13.477, lng: -38.467}, {lat: 14.587, lng: -42.078}, {lat: 15.512, lng: -44.827}, {lat: 16.333, lng: -47.108}, {lat: 17.088, lng: -49.09}, {lat: 17.793, lng: -50.857}, {lat: 18.462, lng: -52.46}, {lat: 19.098, lng: -53.935}, {lat: 19.712, lng: -55.308}, {lat: 20.302, lng: -56.595}, {lat: 20.873, lng: -57.808}, {lat: 21.43, lng: -58.962}, {lat: 21.97, lng: -60.062}, {lat: 22.498, lng: -61.117}, {lat: 23.015, lng: -62.128}, {lat: 23.522, lng: -63.107}, {lat: 24.018, lng: -64.052}, {lat: 24.505, lng: -64.97}, {lat: 24.983, lng: -65.862}, {lat: 25.453, lng: -66.732}, {lat: 25.917, lng: -67.582}, {lat: 26.372, lng: -68.413}, {lat: 26.822, lng: -69.23}, {lat: 27.263, lng: -70.032}, {lat: 27.7, lng: -70.82}, {lat: 28.132, lng: -71.597}, {lat: 28.557, lng: -72.365}, {lat: 28.977, lng: -73.123}, {lat: 29.392, lng: -73.873}, {lat: 29.802, lng: -74.617}, {lat: 30.207, lng: -75.355}, {lat: 30.607, lng: -76.088}, {lat: 31.003, lng: -76.817}, {lat: 31.393, lng: -77.543}, {lat: 31.78, lng: -78.267}, {lat: 32.163, lng: -78.988}, {lat: 32.54, lng: -79.71}, {lat: 32.915, lng: -80.432}, {lat: 33.283, lng: -81.153}, {lat: 33.65, lng: -81.875}, {lat: 34.01, lng: -82.6}, {lat: 34.368, lng: -83.327}, {lat: 34.722, lng: -84.058}, {lat: 35.07, lng: -84.792}, {lat: 35.415, lng: -85.53}, {lat: 35.757, lng: -86.273}, {lat: 36.093, lng: -87.023}, {lat: 36.425, lng: -87.778}, {lat: 36.753, lng: -88.542}, {lat: 37.078, lng: -89.31}, {lat: 37.398, lng: -90.088}, {lat: 37.713, lng: -90.875}, {lat: 38.025, lng: -91.672}, {lat: 38.332, lng: -92.477}, {lat: 38.633, lng: -93.293}, {lat: 38.93, lng: -94.122}, {lat: 39.223, lng: -94.963}, {lat: 39.512, lng: -95.817}, {lat: 39.793, lng: -96.683}, {lat: 40.072, lng: -97.565}, {lat: 40.343, lng: -98.462}, {lat: 40.612, lng: -99.373}, {lat: 40.872, lng: -100.303}, {lat: 41.128, lng: -101.252}, {lat: 41.377, lng: -102.218}, {lat: 41.62, lng: -103.205}, {lat: 41.857, lng: -104.213}, {lat: 42.087, lng: -105.243}, {lat: 42.308, lng: -106.298}, {lat: 42.523, lng: -107.377}, {lat: 42.732, lng: -108.483}, {lat: 42.93, lng: -109.617}, {lat: 43.122, lng: -110.78}, {lat: 43.303, lng: -111.975}, {lat: 43.475, lng: -113.203}, {lat: 43.637, lng: -114.468}, {lat: 43.787, lng: -115.772}, {lat: 43.927, lng: -117.117}, {lat: 44.053, lng: -118.507}, {lat: 44.167, lng: -119.943}, {lat: 44.267, lng: -121.433}, {lat: 44.35, lng: -122.982}, {lat: 44.418, lng: -124.592}, {lat: 44.467, lng: -126.27}, {lat: 44.493, lng: -128.027}, {lat: 44.5, lng: -129.87}, {lat: 44.478, lng: -131.813}, {lat: 44.428, lng: -133.87}, {lat: 44.345, lng: -136.062}, {lat: 44.22, lng: -138.413}, {lat: 44.048, lng: -140.963}, {lat: 43.813, lng: -143.765}, {lat: 43.5, lng: -146.908}, {lat: 43.072, lng: -150.548}, {lat: 42.455, lng: -155.018}, {lat: 41.42, lng: -161.407}, {lat: 39.48, lng: -171.433}];

  var eclipsePath = new google.maps.Polygon({
    path: eclipse_path_coordinates,
    strokeColor: '#000000',
    strokeOpacity: 0.8,
    strokeWeight: 3,
    fillColor: '#000000',
    fillOpacity: 0.35,
    clickable: false
  });

  eclipsePath.setMap(this.map);
}

EclipseSimulator.View.prototype.compute_wide_mode_altaz_centers = function()
{
    var ref_x = this.current_fov._x_ref;
    var ref_y = this.current_fov._y_ref;

    var max_time_offset_ms = 0.5 * 1000 * 60 * EclipseSimulator.VIEW_SLIDER_NSTEPS *
                             EclipseSimulator.VIEW_SLIDER_STEP_MIN[EclipseSimulator.VIEW_ZOOM_WIDE];
    // range is [-1, 1]. -1 corresponds to start of slider range, 0 corresponds to time of maximal
    // eclipse, and 1 corresponds to end of slider range.
    var time_ratio = (this.current_time.getTime() - this.eclipse_time.getTime()) / max_time_offset_ms;

    var ratios = {
        x: {
            start: EclipseSimulator.rad_diff(this.sun_beg_pos.az, this.eclipse_pos.az) / ref_x,
            end:   EclipseSimulator.rad_diff(this.sun_end_pos.az, this.eclipse_pos.az) / ref_x,
        },
        y: {
            start: EclipseSimulator.rad_diff(this.sun_beg_pos.alt, this.eclipse_pos.alt) / ref_y,
            end:   EclipseSimulator.rad_diff(this.sun_end_pos.alt, this.eclipse_pos.alt) / ref_y,
        },
    };

    return {
        az:  this.sunpos.az  + (this._wide_fov_tracking_poly(time_ratio, ratios.x) * this.current_fov.x),
        alt: this.sunpos.alt + (this._wide_fov_tracking_poly(time_ratio, ratios.y) * this.current_fov.y),
    };
};

// Polynomial to enable smooth tracking of sun when in wide mode.
// This is an interpolating polynomial of the following points:
//
//      p0 = (-1, ratios.start)
//      p1 = (0, 0)
//      p2 = (1, -ratios.end)
//
// We compute the polynomial at a given point t by computing the Lagrange basis
// polynomials l0, l1, l2 and returning (p0.y * l0(t)) + (p1.y * l1(t)) + (p2.y * l2(t))
//
// Note: we ignore since p1.y is 0
//
// For more information, see https://en.wikipedia.org/wiki/Lagrange_polynomial
//
EclipseSimulator.View.prototype._wide_fov_tracking_poly = function(t, ratios)
{
    var l0 = (t - 0) * (t - 1) / ((-1 - 0) * (-1 - 1));
    var l2 = (t + 1) * (t - 0) / (( 1 + 1) * ( 1 - 0));
    return (ratios.start * l0) + (-ratios.end * l2);
};

// Returns boundary times for slider. Currently only returns wide mode boundaries
// as these are the only ones we need sun positions for - these positions are used for tracking
// in wide mode - see EclipseSimulator.View.prototype.compute_wide_mode_altaz_centers
//
// ***NOTE:*** It is critical the the order of the times returned here i.e.
// [wide_mode_slider_start, wide_mode_slider_end] is the same as the order that the sun positions
// are digested by EclipseSimulator.View.prototype._set_slider_bound_positions
EclipseSimulator.View.prototype._get_slider_bound_times = function()
{
    var max_time_offset_ms = 0.5 * 1000 * 60 * EclipseSimulator.VIEW_SLIDER_NSTEPS *
                             EclipseSimulator.VIEW_SLIDER_STEP_MIN[EclipseSimulator.VIEW_ZOOM_WIDE];

    return [
        new Date(this.eclipse_time.getTime() - max_time_offset_ms),
        new Date(this.eclipse_time.getTime() + max_time_offset_ms),
    ];
};

// Used in concert with EclipseSimulator.View.prototype._get_slider_bound_times by the controller.
// The controller calls _get_slider_bound_times, computes the sun positions at these times, and
// passes these positions to this function to set them in the view.
//
// ***NOTE:*** It is critical the the order in which positions are processed here i.e.
// [wide_mode_slider_start, wide_mode_slider_end] is the same as the order that the times are
// returned by EclipseSimulator.View.prototype._get_slider_bound_times
EclipseSimulator.View.prototype._set_slider_bound_positions = function(positions)
{
    this.sun_beg_pos = positions[0];
    this.sun_end_pos = positions[1];
};


// ===================================
//
// EclipseSimulator.Controller methods
//
// ===================================

EclipseSimulator.Controller.prototype.init = function()
{
    this.view.init();

    var controller = this;

    // Trigger these computations asynchronously, with a timeout of 1ms
    // to give the browser the chance to re-render the DOM with the loading view
    // after it has been initialized by the call to view.init()
    setTimeout(function() {

        controller.model.init();

        $(controller.view).on('EclipseView_time_updated', function(event, val) {
            // Call the handler, converting the val from minutes to milliseconds
            controller.update_simulator_time_with_offset(parseFloat(val) * 60 * 1000);
        });

        $(controller.view).on('EclipseView_location_updated', function(event, location) {
            // Call the location event handler with new location info
            controller.update_simulator_location(location);
        });

        // Sets initial simulator location
        controller.update_simulator_location();

        // Simulator window/buttons, etc start out hidden so that the user doesn't see
        // a partially rendered view to start (e.g. height not set, etc). This only needs
        // to be shown once, so we do it manually
        controller.view.show();

        controller.update_simulator_time_with_offset(0);

        // Hide loading view - this starts out visible
        controller.view.toggle_loading();

        // Signal that initilization is complete, as this function completes asynchronously
        $(controller).trigger('EclipseController_init_complete');
    }, 1);
};

// Handler for when the slider gets changed
// sliderValueMS is expected to be passed in as milliseconds
EclipseSimulator.Controller.prototype.update_simulator_time_with_offset = function(time_offset_ms)
{
    // Get the computed eclipse time
    var new_sim_time_ms = this.model.eclipse_time.getTime() + time_offset_ms;

    // Update the displayed time by adding the slider value to the eclipse time
    this.model.date.setTime(new_sim_time_ms);
    this.view.current_time.setTime(new_sim_time_ms);

    // Compute sun/moon position based off of this.model.date value
    // which is the displayed time
    var pos  = this.model.get_sun_moon_position();
    // var sun  = pos.sun;
    // var moon = pos.moon;
    //
    // sun.r    = this.view.sunpos.r;
    // moon.r   = this.view.moonpos.r;

    // Update the view
    this.view.update_sun_moon_pos(pos.sun, pos.moon);
    this.view.refresh();

    if (EclipseSimulator.DEBUG)
    {
        console.log(
            this.model.date.toUTCString()
            + '\nlat: ' + this.model.coords.lat
            + '\nlng: ' + this.model.coords.lng
            + '\nS(alt: ' + sun.alt + ' az: ' + sun.az + ')'
            + '\nM(alt: ' + moon.alt + ' az: ' + moon.az + ')'
        );
    }
};

EclipseSimulator.Controller.prototype.update_simulator_location = function(location = undefined)
{
    if (location !== undefined)
    {
        this.model.coords = {
            lat: location.lat(),
            lng: location.lng()
        };
    }

    // This will set the model's eclipse_time attribute
    var res = this.model.compute_eclipse_time_and_pos();

    // Set model displayed date to eclipse time
    this.model.date.setTime(res.time.getTime());

    // Get new position of sun/moon
    var pos  = this.model.get_sun_moon_position();

    // Update the view
    this.view.update_sun_moon_pos(pos.sun, pos.moon);
    this.view.update_eclipse_info(res);
    this.view.current_time.setTime(res.time.getTime());
    this.view.reset_controls();
    this.view.update_slider();

    // Set the view slider bound sun positions
    var times     = this.view._get_slider_bound_times();
    var positions = [];
    for (var i = 0; i < times.length; i++)
    {
        positions.push(this.model._compute_sun_moon_pos(times[i]).sun);
    }
    this.view._set_slider_bound_positions(positions);
    this.view.refresh();
};


// ==============================
//
// EclipseSimulator.Model methods
//
// ==============================

EclipseSimulator.Model.prototype.init = function()
{
};

EclipseSimulator.Model.prototype.get_sun_moon_position = function()
{
    return this._compute_sun_moon_pos(this.date);
};

EclipseSimulator.Model.prototype.compute_eclipse_time_and_pos = function()
{
    // Initial date/time to begin looking for eclipse time
    var date = EclipseSimulator.ECLIPSE_DAY;
    date.setUTCHours(EclipseSimulator.ECLIPSE_WCOAST_HOUR);

    // Sun/Moon angular separation
    var prev_sep = Math.PI * 4;
    var sep      = Math.PI * 2;

    // Initial time increment of 5 minutes
    var step = 1000 * 60 * 5;

    // Set time back one step, as it will be incremented in the do while loop below, before its used
    var time = date.getTime() - step;

    // Doesn't matter
    var prev_time = 0;

    // Loop until we've reduced the step to a single second
    while (step >= 1000)
    {
        do
        {
            // Record previous iteration values
            prev_sep   = sep;
            prev_time  = time;

            // Update time for the current step
            time      += step;
            date.setTime(time);

            // Compute sun and moon position and angular separation
            var pos = this._compute_sun_moon_pos(date);
            sep     = EclipseSimulator.compute_sun_moon_sep(pos.sun, pos.moon);
        }
        while (sep < prev_sep);         // Loop until the sun/moon start getting further apart

        // Back off and reduce step
        time -= (2 * step);
        step /= 2;

        // This sets the value of prev_sep
        sep = Math.PI * 2;
    }

    // Compute eclipse position
    var pos = this._compute_sun_moon_pos(date);

    // Save eclipse time in the model
    this.eclipse_time.setTime(time);

    return {
        time: this.eclipse_time,
        az:   pos.sun.az,
        alt:  pos.sun.alt,
    };
};

EclipseSimulator.Model.prototype._compute_sun_moon_pos = function(date)
{
    var julian_date = new A.JulianDay(date);
    var coords      = A.EclCoord.fromWgs84(this.coords.lat, this.coords.lng, undefined);

    return {
        sun: A.Solar.topocentricPosition(julian_date, coords, true).hz,
        moon: A.Moon.topocentricPosition(julian_date, coords, true).hz,
    };
};


// ========================
//
// Simulator Initialization
//
// ========================

var global_controller = undefined;

function initSim() {

    // TEMP this is a demo - paste in a lat long from google maps
    // in the array below to position the simulator at that location!
    var c = [46.470113, -69.202133];

    var location = {
        name: 'Some location',
        coords: c,
    }

    // Makes the simulator choose the default, corvallis coords
    location = undefined;

    var controller = new EclipseSimulator.Controller(location);
    controller.init();

    return controller;
}

$(document).ready(function() {

    var controller = initSim();

    // In debug mode, add the controller instance to the global namespace
    if (EclipseSimulator.DEBUG)
    {
        global_controller = controller;
    }
});
