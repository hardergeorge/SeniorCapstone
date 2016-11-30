
// Return height/width of an SVG element
function getPosition(obj) {

  var height = obj.height.baseVal.value;
  // For some reason, with a width size of 100%, the value returns 0.
  var width = obj.width.baseVal.value;

  return [height, width];
}

// Takes in a percent and object, and places the object
// at the corresponding location on the window
// E.g: Percent = .5 would result in the object being
// in the center of the screen
function alterPosByPercent(xy_dim, percent, obj) {

  // xy_dim[0] corresponds to window height
  // xy_dim[1] corresponds to width

  var newPos_Y = xy_dim[0]*percent;
  var newPos_X = xy_dim[1]*percent;

  obj.style.cx = newPos_X;
  obj.style.cy = newPos_Y;
}

function initSim() {
  var svg = document.getElementById("cont");
  var sun = document.getElementById("sun");
  var moon = document.getElementById("moon");

  xy_dim = getPosition(svg);

  var sun_percent = .5;
  var moon_percent = .75;

  alterPosByPercent(xy_dim, sun_percent, sun);
  alterPosByPercent(xy_dim, moon_percent, moon);
}
