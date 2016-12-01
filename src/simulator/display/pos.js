function initSim() {
    var view = new View();
    view.init();
}

// Jake, this fixes the issue you were seeing where when width was set to 100%
// you were getting a 0 value - this is because the code was executing before that
// svg element was actually rendered/had a width associated with it. This jQuery function
// below, $(document).ready takes a function as an argument and calls it when the document
// is ready, i.e. when that svg has a width associated with it.
//
// Also, it is better practice call your init methods from within your js file than from
// within your HTML, that is why I commented out this call in the HTML file.
$(document).ready(initSim);


// I think now is a good time to start working the view as a "class". This is because the
// view should have some properties associated with it, like the sun/moon objects. Also
// this results in ultimately cleaner code. JavaScript "classes" are actually functions.
// Here we define the View "class". Instances of it can be instantiated like this:
//
//  var view = new View();
//
function View()
{
    // $('#cont') is jQuery shorthand for document.getElementById("cont")
    // but returns an array - that is why we call get(0) on it, this is the same
    // as $('#cont')[0]
    this.window = $('#cont').get(0);
    this.sun    = $('#sun').get(0);
    this.moon   = $('#moon').get(0);
}

// These prototype functions act as methods of the class, i.e. they can be called like this:
//
//  var view = new View();
//  view.init();
//
View.prototype.init = function()
{
    this.position_body_at_percent_coords(this.sun, 25, 50);
    this.position_body_at_percent_coords(this.moon, 50, 50);
}

View.prototype.get_window_size = function()
{
    // This is a dictionary/object and can be accessed as follows:
    //
    //  var w = view.get_window_size().width
    //
    return {
        width:  this.window.width.baseVal.value,
        height: this.window.height.baseVal.value,
    }
}

View.prototype.position_body_at_percent_coords = function(target, x_percent, y_percent)
{
    var window_size = this.get_window_size();

    target.style.cx = window_size.width * (x_percent / 100);
    target.style.cy = window_size.height * (y_percent / 100);
}
