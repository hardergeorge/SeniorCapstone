"use strict";

function radiansToDegrees(radians) {
  return radians * 180 / Math.PI;
}

function degreesToRad(degrees) {
  return degrees / 180 * Math.PI;
}

function dot(a, b) {
  var c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return c;
}

function mag(a) {
  return Math.sqrt(a[0]*a[0] + a[1]*a[1] + a[2]*a[2]);
}

function norm(a) {
  var m = mag(a)
  var c = [ a[0]/m, a[1]/m, a[2]/m ];
  return c;
}

function altazToVec(altitude, azimuth) {
  var z = Math.sin(altitude);
  var hyp = Math.cos(altitude);
  var y = hyp*Math.cos(azimuth);
  var x = hyp*Math.sin(azimuth);
  return [x,y,z];
}

function sunMoonAngle(sunpos, moonpos) {
  var sunvec = altazToVec(degreesToRad(sunpos.altitude),
                          degreesToRad(sunpos.azimuth));

  var moonvec = altazToVec(degreesToRad(moonpos.altitude),
                           degreesToRad(moonpos.azimuth));
  var m = mag([sunvec[0]-moonvec[0],sunvec[1]-moonvec[1],sunvec[2]-moonvec[2]])
  var normsun = norm(sunvec);
  var normmoon = norm(moonvec);

  var d = dot(normsun, normmoon);
  var angle = Math.acos(d) * 180 / Math.PI;
  return [m, angle];
}

function compute() {
  const long_ = -122.0839; // longitude
  const lat = 37.38583; // latitude
  var date = new Date();
  var sunpos = SunCalc.getPosition(date, lat, long_);
  console.log(date, radiansToDegrees(sunpos.altitude), -(radiansToDegrees(-sunpos.azimuth)-180));
  // var moonpos = SunCalc.getMoonPosition(date, lat, long_);
  // var dvec = [radiansToDegrees(sunpos.altitude-moonpos.altitude), radiansToDegrees(sunpos.azimuth-moonpos.azimuth)];
  // var vmag = Math.sqrt(dvec[0]*dvec[0] + dvec[1]*dvec[1]);
  // var x = sunMoonAngle(sunpos, moonpos);
  // var m = x[0];
  // var angle = x[1];
  // console.log(date, m, angle);
}
compute();
