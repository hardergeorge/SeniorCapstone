# https://www.chromosphere.co.uk/2015/03/18/eclipse-calculations-using-python/
import ephem
import math
from operator import itemgetter

import calendar
from datetime import datetime, timedelta
import pytz

local_tz = pytz.timezone('US/Pacific')

def utc_to_local(utc_dt):
    local_dt = utc_dt.replace(tzinfo=pytz.utc).astimezone(local_tz)
    return local_tz.normalize(local_dt) # .normalize might be unnecessary


def check_non_zero(x):
    return x > 0

def eclipse(timetuple, location):
    # Output list
    results=[]
    for x in range(0,100000):
        location.date= (ephem.date(ephem.date(timetuple)+x*ephem.second))
        sun.compute(location)
        moon.compute(location)
        r_sun=sun.size/2.0          # This is in arc seconds, not minutes, i.e. 1/360s of degrees
        r_moon=moon.size/2.0        # This is in arc seconds, not minutes, i.e. 1/360s of degrees
        dt = location.date.datetime()
        dt2 = utc_to_local(dt)
        # print(dt.strftime('%Y-%m-%d %H:%M:%S.%f %Z%z'), ephem.separation((sun.az, sun.alt), (moon.az, moon.alt)))
        s=math.degrees(ephem.separation((sun.az, sun.alt), (moon.az, moon.alt)))*60*60
        ## Calculate the size of the lune (http://mathworld.wolfram.com/Lune.html) in arcsec^2
        if s<((r_moon+r_sun)):

            a, b, c = r_sun, r_moon, s
            inner = (a + b + c) * (b + c - a) * (c + a - b) * (a + b - c)
            lunedelta = 0 if inner < 0 else (0.25 * math.sqrt(inner))

        else: ### If s>r_moon+r_sun there is no eclipse taking place
            lunedelta = None
            percent_eclipse = 0
        
        if lunedelta is not None and lunedelta > 0:
            lune_area=2*lunedelta + r_sun*r_sun*(math.acos(((r_moon*r_moon)-(r_sun*r_sun)-(s*s))/(2*r_sun*s))) - r_moon*r_moon*(math.acos(((r_moon*r_moon)+(s*s)-(r_sun*r_sun))/(2*r_moon*s)))
            percent_eclipse=(1-(lune_area/(math.pi*r_sun*r_sun)))*100 # Calculate percentage of sun's disc eclipsed using lune area and sun size
        elif lunedelta == 0:
            percent_eclipse = 100

        print(dt.strftime('%Y-%m-%d %H:%M:%S.%f %Z%z'), s, (moon.size - sun.size) / 360.0, percent_eclipse)
        results.append([location.date.datetime(), s, sun.size, moon.size, percent_eclipse]) ### Append to list of lists
    
    # gen=(x for x in results) ### Find Max percentage of eclipse...
    max_eclipse=max(results, key=itemgetter(-1))
    print("Max eclipse at: " + str(max_eclipse[0])) ### ...and return the time
    print("Max percent: " + '%.2f' % max_eclipse[5]) ### ...and return the percentage
    gen=(x for x in results)
    print("First contact: " + str(next(x for x in gen if check_non_zero(x[5]))[0])) # Find first contact...
    print("Last contact: " + str(next(x for x in gen if x[5]==0)[0])) ### ...and last contact


# Objects
sun, moon = ephem.Sun(), ephem.Moon()

timetuple = (2017, 8, 21, 9+7, 00, 00)
corvallis = ephem.Observer()
corvallis.lon = '-123:15:43.4'
corvallis.lat = '44:33:52.4'
corvallis.date=timetuple
eclipse(timetuple, corvallis)
