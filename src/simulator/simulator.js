'use strict';

// EclipseSimulator namespace
var EclipseSimulator = {

    DEBUG: true,

    View: function(location)
    {
        this.sim            = $('#sim').get(0);
        this.window         = $('#container').get(0);
        this.loading        = $('#loading').get(0);
        this.controls       = $('#controls').get(0);
        this.sun            = $('#sun').get(0);
        this.moon           = $('#moon').get(0);
        this.hills          = $('[id^=hill]');
        this.upbutton       = $('#upbutton').get(0);
        this.downbutton     = $('#downbutton').get(0);
        this.slider         = $('#tslider').get(0);
        this.error_snackbar = $('#error-snackbar').get(0);
        this.slider_labels  = $('[id^=slabel]');

        this.map            = new google.maps.Map(document.getElementById('map-canvas'), {
                                center: {lat: 44.5646, lng: -123.2620},
                                zoom: 11
                            });
        this.search_box     = undefined;
        this.marker         = undefined;

        // Sun/Moon start off screen
        this.sunpos  = {x: -100, y: 0, r: 0.5 * Math.PI / 180};
        this.moonpos = {x: -100, y: 0, r: 0.5 * Math.PI / 180};

        // Field of view in radians
        this.fov = {

            // Max x fov is 140 degrees
            x: 90 * Math.PI / 180,

            // Max y fov is 90 degrees
            y: 80 * Math.PI / 180
        };

        this.fov_buffer = 15 * Math.PI / 180;

        // Center of frame in radians
        this.az_center  = 0;
        this.alt_center = 40 * Math.PI / 180;

        this.location_name = location !== undefined ? location.name : EclipseSimulator.DEFAULT_LOCATION_NAME;
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

        // Date object to be passed to ephemeris
        this._ephemeris_date = {};

        // Computed eclipse time -- temp value, this will be set when
        // Model.compute_eclipse_time_and_az is called
        this.eclipse_time = new Date(EclipseSimulator.ECLIPSE_DAY);
    },

    alt_az_to_vec3d: function(alt, az)
    {
        var z   = Math.sin(alt);
        var hyp = Math.cos(alt);
        var y   = hyp * Math.cos(az);
        var x   = hyp * Math.sin(az);

        return [x, y, z];
    },

    dot3d: function(v1, v2)
    {
        return ((v1[0] * v2[0]) +
                (v1[1] * v2[1]) +
                (v1[2] * v2[2]));
    },

    normalize3d: function(v)
    {
        // Magnitude
        var m = Math.sqrt((v[0] * v[0]) +
                          (v[1] * v[1]) +
                          (v[2] * v[2]));

        return [v[0] / m,
                v[1] / m,
                v[2] / m];
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

    VIEW_TICK_SEP: 3 * 60 * 60 * 1000,

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

};


// =============================
//
// EclipseSimulator.View methods
//
// =============================

EclipseSimulator.View.prototype.init = function()
{
    this.refresh();
    this._refresh_hills();

    // Have to create a reference to this, because inside the window
    // refresh function callback this refers to the window object
    var view = this;

    //This makes the sun move along with the slider
    //A step toward calculating and displaying the sun and moon at a specific time based on the slider
    $("#tslider").on('input', function(){
        view.slider_change(view.slider.value);
    });

    //Increments the slider on a click
    $("#upbutton").click(function(){
        view.slider.MaterialSlider.change(parseInt(view.slider.value) + 2);
        view.slider_change(view.slider.value);
    });

    //Decrements the slider on a click
    $("#downbutton").click(function(){
        view.slider.MaterialSlider.change(parseInt(view.slider.value) - 2);
        view.slider_change(view.slider.value);
    });

    //Hide the map when the view initializes
    $("#map-canvas").hide();

    //Toggles the visibility of the map on click
    $("#mapbutton").click(function(){
        $("#map-canvas").toggle(resizeMap);

        function resizeMap() {
            var center2 = view.map.getCenter();
            google.maps.event.trigger(view.map, "resize"); // resize map
            view.map.setCenter(center2);
        }
    });

    this.initialize_location_entry();

    // Rescale the window when the parent iframe changes size
    $(window).resize(function() {
        view.refresh();
        view._refresh_hills();
    });
};

EclipseSimulator.View.prototype.initialize_location_entry = function()
{
    var view = this;

    // Create the search box and link it to the UI element.
    var input      = document.getElementById('pac-input');
    var options = {
        componentRestrictions: {country: 'us'}
    };
    view.search_box = new google.maps.places.Autocomplete(input, options);

    view.marker = new google.maps.Marker({
        map: this.map,
        position: {lat: 44.5646, lng: -123.2620}
    });

    view.marker.setVisible(true);

    var geocoder = new google.maps.Geocoder;

    // Listen for the event fired when the user selects a prediction and retrieve
    // more details for that place.
    view.search_box.addListener('place_changed', function() {

        view.marker.setVisible(false);
        var place = view.search_box.getPlace();

        if (!place.geometry)
        {
            view.display_error_to_user('Location not found!');
            return;
        }

        // If the place has a geometry, then present it on a map.
        if (place.geometry.viewport) {
            view.map.fitBounds(place.geometry.viewport);
            view.map.setZoom(11);
        } else {
            view.map.setCenter(place.geometry.location);
            view.map.setZoom(11);
        }
        view.marker.setPosition(place.geometry.location);
        view.marker.setVisible(true);

        // Update location name
        view.name = place.formatted_address;

        $(view).trigger('EclipseView_location_updated', place.geometry.location);
    });

    google.maps.event.addListener(view.map, 'click', function(event) {

        var place = event.latLng;

        var latlng = {lat: place.lat(), lng: place.lng()};

        geocoder.geocode({'location': latlng}, function(results, status) {
            if (status === 'OK') {
                if (results[1].formatted_address.includes('USA')) {

                    view.marker.setVisible(false);

                    // Update location name
                    view.name = results[1].formatted_address;
                    input.value = results[1].formatted_address;

                    if (!place)
                    {
                        view.display_error_to_user("No details available for: " + place.name);
                        return;
                    }

                    view.marker.setPosition(place);
                    view.marker.setVisible(true);

                    // Update location name
                    view.name = place;

                    $(view).trigger('EclipseView_location_updated', place);

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
    input.value = this.location_name;
};

EclipseSimulator.View.prototype.refresh = function()
{
    var window_height = $(window).height();

    $(this.window).attr('height', window_height - $(this.controls).height());
    $(this.window).attr('width', $(window).width());

    $(this.window).show();

    $(this.loading).css('height', window_height + 'px');

    // Position sun/moon. Cannot do this until window is displayed
    this.position_body_at_percent_coords(this.sun, this.sunpos);
    this.position_body_at_percent_coords(this.moon, this.moonpos);

    $(this.sun).show();
    $(this.moon).show();
};

EclipseSimulator.View.prototype.get_environment_size = function()
{
    return {
        width:  this.window.width.baseVal.value,
        height: this.window.height.baseVal.value,
    };
};

EclipseSimulator.View.prototype.position_body_at_percent_coords = function(target, pos)
{
    var env_size = this.get_environment_size();

    // Adjust radius
    target.style.r = env_size.width * Math.sin(pos.r);

    // with SVG, (0, 0) is top left corner
    target.style.cy = env_size.height * (1 - (pos.y / 100));
    target.style.cx = env_size.width * (pos.x / 100);
};

EclipseSimulator.View.prototype.position_sun_moon = function(sunpos, moonpos, time)
{
    // this.sunpos.x  = this.get_x_percent_from_az(sunpos.az, sunpos.r);
    // this.sunpos.y  = this.get_y_percent_from_alt(sunpos.alt);
    // this.moonpos.x = this.get_x_percent_from_az(moonpos.az, sunpos.r);
    // this.moonpos.y = this.get_y_percent_from_alt(moonpos.alt);

    this.sunpos.x  = this.get_percent_from_altaz(sunpos.az,   this.az_center,  this.fov.x, sunpos.r);
    this.sunpos.y  = this.get_percent_from_altaz(sunpos.alt,  this.alt_center, this.fov.y, sunpos.r);
    this.moonpos.x = this.get_percent_from_altaz(moonpos.az,  this.az_center,  this.fov.x, moonpos.r);
    this.moonpos.y = this.get_percent_from_altaz(moonpos.alt, this.alt_center, this.fov.y, moonpos.r);

    // get_percent_from_altaz = function(altaz, center, fov, body_r)

    this.update_slider_labels(time);
    this.refresh();
};

EclipseSimulator.View.prototype.get_percent_from_altaz = function(altaz, center, fov, body_r)
{
    var dist_from_center = Math.sin(altaz - center);
    var half_fov_width   = Math.sin(fov / 2);

    if (this.out_of_view(altaz, center, fov, body_r))
    {
        // Just move the body way way off screen
        dist_from_center += fov * 10;
    }

    return 50 + (50 * dist_from_center / half_fov_width);
};

EclipseSimulator.View.prototype.out_of_view = function(altaz, center, fov, body_r)
{
    var bound = center + (fov / 2);
    var dist  = EclipseSimulator.rad_diff(bound, altaz);

    bound += this.fov_buffer;

    // Body off screen in positive direction
    if (EclipseSimulator.rad_gt(altaz, bound) && dist > body_r)
    {
        return true;
    }

    bound = center - (fov / 2);
    dist  = EclipseSimulator.rad_diff(bound, altaz);

    bound -= this.fov_buffer;

    // Body off screen in negative direction
    if (EclipseSimulator.rad_gt(bound, altaz) && dist > body_r)
    {
        return true;
    }

    return false;
};

EclipseSimulator.View.prototype.slider_change = function(new_val)
{
    // Event triggering
    $(this).trigger('EclipseView_time_updated', new_val);
};

EclipseSimulator.View.prototype.toggle_loading = function()
{
    if ($(this.loading).is(':visible'))
    {
        $(this.loading).hide();
    }
    else
    {
        $(this.loading).show();
    }

};

EclipseSimulator.View.prototype.reset_controls = function()
{
    this.slider.MaterialSlider.change(0);
};

// Made this its own function, as we dont want to do it every time
// the sun and moon are moved
EclipseSimulator.View.prototype._refresh_hills = function()
{
    var env_size = this.get_environment_size();

    for (var i = 0; i < this.hills.length; i++)
    {
        var hill = this.hills.get(i);

        // Accessing the data attribute auto converts it to a float
        hill.style.cx = $(hill).data('cxtow-ratio') * env_size.width;
        hill.style.cy = $(hill).data('cy-offset')   * env_size.height + env_size.height;
        hill.style.r  = $(hill).data('rtoh-ratio')  * env_size.height;

        $(hill).show();
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

EclipseSimulator.View.prototype.update_slider_labels = function(time)
{
    var date = new Date(time.getTime() - (2 * EclipseSimulator.VIEW_TICK_SEP));

    for (var i = 0; i < this.slider_labels.length; i++)
    {
        $(this.slider_labels[i]).text(date.getHours() + ':' + date.getMinutes());
        date.setTime(date.getTime() + EclipseSimulator.VIEW_TICK_SEP);
    }
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

        var res  = controller.model.compute_eclipse_time_and_az();

        controller.view.az_center = res.az;
        controller.view.refresh();

        $(controller.view).on('EclipseView_time_updated', function(event, val) {
            // Call the handler, converting the val from minutes to milliseconds
            controller.update_simulator_time_with_offset(parseInt(val) * 60 * 1000);
        });

        $(controller.view).on('EclipseView_location_updated', function(event, location) {
            // Call the location event handler with new location info
            controller.update_simulator_location(location);
        })

        // Simulator window/buttons, etc start out hidden so that the user doesn't see
        // a partially rendered view to start (e.g. height not set, etc). This only needs
        // to be shown once, so we do it manually
        $(controller.view.sim).show();

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

    // Compute sun/moon position based off of this.model.date value
    // which is the displayed time
    var pos  = this.model.get_sun_moon_position();
    var sun  = pos.sun;
    var moon = pos.moon;

    sun.r    = this.view.sunpos.r;
    moon.r   = this.view.moonpos.r;

    // Update the view
    this.view.position_sun_moon(sun, moon, this.model.eclipse_time);
};

EclipseSimulator.Controller.prototype.update_simulator_location = function(location)
{
    this.model.coords = {
        lat: location.lat(),
        lng: location.lng()
    };

    // This will set the model's eclipse_time attribute
    var res = this.model.compute_eclipse_time_and_az();

    // Set model displayed date to eclipse time
    this.model.date.setTime(res.time.getTime());

    // Set view center
    this.view.az_center = res.az;

    // Get new position of sun/moon
    var pos  = this.model.get_sun_moon_position();
    var sun  = pos.sun;
    var moon = pos.moon;

    sun.r    = this.view.sunpos.r;
    moon.r   = this.view.moonpos.r;

    // Update the view
    this.view.reset_controls();
    this.view.position_sun_moon(sun, moon, res.time);
};


// ==============================
//
// EclipseSimulator.Model methods
//
// ==============================

EclipseSimulator.Model.prototype.init = function()
{
    $processor.init();
};

EclipseSimulator.Model.prototype.get_sun_moon_position = function()
{
    // Set date and position
    this._update_ephemeris();
    return this._compute_sun_moon_pos(this._ephemeris_date);
};

EclipseSimulator.Model.prototype.compute_eclipse_time_and_az = function()
{
    // Set up ephemeris position
    this._update_ephemeris();

    // Initial date/time to begin looking for eclipse time
    var date   = EclipseSimulator.ECLIPSE_DAY;
    var e_date = {};
    date.setUTCHours(EclipseSimulator.ECLIPSE_WCOAST_HOUR);

    // Sun/Moon angular separation
    var prev_sep = Math.PI * 4;
    var sep      = Math.PI * 2;

    // Initial time increment of 5 minutes
    var step = 1000 * 60 * 5;

    var time      = date.getTime() - step;
    var prev_time = 0;      // Doesn't matter

    while (step >= 1000)
    {
        do
        {
            prev_sep   = sep;
            prev_time  = time;
            time      += step;

            date.setTime(time);

            e_date = this._create_ephemeris_date(date);
            sep    = this._compute_sun_moon_sep(e_date);
        }
        while (sep < prev_sep);

        // Back off and reduce step
        time -= (2 * step);
        step /= 2;

        // This sets the value of prev_sep
        sep = Math.PI * 2;
    }

    // Compute eclipse azimuth
    var pos = this._compute_sun_moon_pos(e_date);

    // Save eclipse time in the model
    this.eclipse_time.setTime(time);

    return {
        time: date,
        az:   pos.sun.az,
    };
};

// Compute sun/moon angular seperation and moon radius
EclipseSimulator.Model.prototype._compute_sun_moon_sep = function(e_date)
{
    this._update_ephemeris();
    var pos = this._compute_sun_moon_pos(e_date);

    var sun_vec   = EclipseSimulator.alt_az_to_vec3d(pos.sun.alt, pos.sun.az);
    var moon_vec  = EclipseSimulator.alt_az_to_vec3d(pos.moon.alt, pos.moon.az);

    var norm_sun  = EclipseSimulator.normalize3d(sun_vec);
    var norm_moon = EclipseSimulator.normalize3d(moon_vec);
    var d         = EclipseSimulator.dot3d(norm_sun, norm_moon);

    return Math.acos(d);
};

// Computes sun and moon position at Model.coords for a given ephemeris_date
// object, which can be created by passing a normal Date object to Model._create_ephemeris_date.
// NOTE: Model._update_ephemeris must have been called prior to calling this
// function in order to register Model.coords with the ephemeris library
EclipseSimulator.Model.prototype._compute_sun_moon_pos = function(ephemeris_date)
{
    var sun  = $moshier.body.sun;
    var moon = $moshier.body.moon;

    $processor.calc(ephemeris_date, sun);
    $processor.calc(ephemeris_date, moon);

    var sunpos  = sun.position.altaz.topocentric;
    var moonpos = moon.position.altaz.topocentric;

    return {
        sun:  {az:  EclipseSimulator.deg2rad(sunpos.azimuth),
               alt: EclipseSimulator.deg2rad(sunpos.altitude),
        },
        moon: {az:  EclipseSimulator.deg2rad(moonpos.azimuth),
               alt: EclipseSimulator.deg2rad(moonpos.altitude),
        },
    };
};

EclipseSimulator.Model.prototype._create_ephemeris_date = function(date)
{
    return {
        year:    date.getFullYear(),
        month:   date.getMonth() + 1, // Date object months are zero indexed
        day:     date.getDate(),
        hours:   date.getUTCHours(),
        minutes: date.getMinutes(),
        seconds: date.getSeconds()
    };
};

EclipseSimulator.Model.prototype._update_ephemeris = function()
{
    $const.glat  = this.coords.lat;
    $const.tlong = this.coords.lng;

    this._ephemeris_date = this._create_ephemeris_date(this.date);
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
