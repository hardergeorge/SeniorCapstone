// EclipseSimulator namespace
var EclipseSimulator = {

    View: function()
    {
        this.window   = $('#container').get(0);
        this.controls = $('#controls').get(0);
        this.sun      = $('#sun').get(0);
        this.moon     = $('#moon').get(0);

        this.sunpos  = {x: 50, y: 50};
        this.moonpos = {x: 25, y: 25};
    },

    Controller: function()
    {
        this.view  = new EclipseSimulator.View();
        // this.model = new EclipseSimulator.Model();
    },

    // Model: function() {},
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
    this.position_body_at_percent_coords(this.sun, this.sunpos.x, this.sunpos.y);
    this.position_body_at_percent_coords(this.moon, this.moonpos.x, this.moonpos.y);

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

EclipseSimulator.View.prototype.position_body_at_percent_coords = function(target, x_percent, y_percent)
{
    var env_size = this.get_environment_size();

    console.log(env_size);

    target.style.cx = env_size.width * (x_percent / 100);
    target.style.cy = env_size.height * (y_percent / 100);
};



//
// EclipseSimulator.Controller methods
//
EclipseSimulator.Controller.prototype.init = function() 
{
    this.view.init();
    // this.model.init();
}


function initSim() {
    var controller = new EclipseSimulator.Controller();
    controller.init();
}


$(document).ready(initSim);