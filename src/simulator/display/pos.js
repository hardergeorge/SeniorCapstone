// EclipseSimulator namespace
var EclipseSimulator = {

    DEBUG: true,

    View: function()
    {
        this.window   = $('#container').get(0);
        this.controls = $('#controls').get(0);
        this.sun      = $('#sun').get(0);
        this.moon     = $('#moon').get(0);

        this.sunpos  = {x: 50, y: 50, r: 2 * Math.PI / 180};  // temp radius values
        this.moonpos = {x: 25, y: 25, r: 2 * Math.PI / 180};  // temp radius values

        // Field of view in radians
        this.fov = {x: 80 * Math.PI / 180, y: 80 * Math.PI / 180};

        // Center of frame in radians
        this.az_center = 0 * Math.PI / 180;
    },

    Controller: function(coords)
    {
        this.view  = new EclipseSimulator.View();
        this.model = new EclipseSimulator.Model();

        this.coords = coords !== undefined ? coords : EclipseSimulator.CORVALLIS_COORDS;
    },

    Model: function() {},

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

    CORVALLIS_COORDS: {
        lat: 44.567353,
        lng: -123.278622,
    },
};


//
// EclipseSimulator.View methods
//
EclipseSimulator.View.prototype.init = function()
{
    this.refresh();

    // Have to create a reference to this, because inside the window
    // refresh function callback this refers to the window object
    var view = this;

    // Rescale the window when the parent iframe changes size
    $(window).resize(function() {
        view.refresh();
    });
};

EclipseSimulator.View.prototype.refresh = function()
{
    $(this.window).attr('height', $(window).height() - $(this.controls).height());
    $(this.window).attr('width', $(window).width());

    $(this.window).show();

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
    }
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

EclipseSimulator.View.prototype.position_sun_moon = function(sunpos, moonpos)
{
    this.sunpos.x  = this.get_x_percent_from_az(sunpos.az, sunpos.r);
    this.sunpos.y  = this.get_y_percent_from_alt(sunpos.alt);
    this.moonpos.x = this.get_x_percent_from_az(moonpos.az, sunpos.r);
    this.moonpos.y = this.get_y_percent_from_alt(moonpos.alt);

    this.refresh();
}

EclipseSimulator.View.prototype.get_x_percent_from_az = function(az, radius)
{
    var dist_from_center = Math.sin(az - this.az_center);
    var half_fov_width   = Math.sin(this.fov.x / 2);

    if (this.az_out_of_view(az, radius))
    {
        // Just move the body way way off screen
        dist_from_center += this.fov.x * 10;
    }

    return 50 + (50 * dist_from_center / half_fov_width);
}

// This may need some re-visiting... the current computations imply a field of view of 2*fov.y
// Compute y coordinate in simulator window as a percentage of the window height
// Assumes altitude is <= (pi/2)
EclipseSimulator.View.prototype.get_y_percent_from_alt = function(alt)
{
    var height     = Math.sin(alt);
    var fov_height = Math.sin(this.fov.y);

    return 100 * height / fov_height;
}

EclipseSimulator.View.prototype.az_out_of_view = function(az, radius)
{
    var bound = this.az_center + (this.fov.x / 2);
    var dist  = EclipseSimulator.rad_diff(bound, az);

    // Body off screen to the right
    if (EclipseSimulator.rad_gt(az, bound) && dist > radius)
    {
        return true;
    }

    bound = this.az_center - (this.fov.x / 2);
    dist  = EclipseSimulator.rad_diff(bound, az);

    // Body off screen to the left
    if (EclipseSimulator.rad_gt(bound, az) && dist > radius)
    {
        return true;
    }

    return false;
}


//
// EclipseSimulator.Controller methods
//
EclipseSimulator.Controller.prototype.init = function() 
{
    this.view.init();
    // this.model.init();

    // Demo
    // playFunc(this.view, 0, 0);
}


function playFunc(view, sundegx, moondegx)
{
    view.position_sun_moon(
        {az: EclipseSimulator.deg2rad(sundegx),  alt: view.sunpos.alt,  r: view.sunpos.r},
        {az: EclipseSimulator.deg2rad(moondegx), alt: view.moonpos.alt, r: view.moonpos.r}
    );

    if (sundegx >= 360)
    {
        return;
    }

    setTimeout(function() {
        playFunc(view, sundegx + 1, moondegx - 1);
    }, 10);
}


function initSim() {
    var controller = new EclipseSimulator.Controller();
    controller.init();
}


$(document).ready(initSim);