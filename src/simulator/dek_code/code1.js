function degreesToRad(degrees) {
  return degrees / 180 * Math.PI;
}

function sunMoonAngle(sunpos, moonpos) {
  var sunvec = altazToVec(degreesToRad(sunpos.altitude),
			  degreesToRad(sunpos.azimuth));

  var moonvec = altazToVec(degreesToRad(moonpos.altitude),
			   degreesToRad(moonpos.azimuth));

  console.log(date + " " + sunpos.altitude + " " + sunpos.azimuth);
  var normsun = norm(sunvec);
  var normmoon = norm(moonvec);

  var d = dot(normsun, normmoon);
  var angle = Math.acos(d) * 180 / Math.PI;

  return angle;
}

$processor.init ();

function runEclipse() {
  var date = new Date();
  $const.tlong = -122.0839; // longitude
  $const.glat = 37.39583; // latitude
  var da = {year: date.getFullYear(), month: date.getMonth(), day: date.getDate(), hours: date.getHours()+7, minutes: date.getMinutes(), seconds: date.getSeconds()};
  var sun = $moshier.body.sun;
  $processor.calc(da, sun);
  // var moon = $moshier.body.moon;
  // $processor.calc(da, moon);
  var sunpos = sun.position.altaz.topocentric;
  console.log(date, sunpos.altitude, sunpos.azimuth);
  // var moonpos = moon.position.altaz.topocentric;
  // var angle = sunMoonAngle(date);
}
runEclipse();
