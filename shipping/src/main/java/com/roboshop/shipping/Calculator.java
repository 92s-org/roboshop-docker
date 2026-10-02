package com.roboshop.shipping;

/**
 * Distance between two points on earth using the Haversine formula.
 * https://www.movable-type.co.uk/scripts/latlong.html
 */
public final class Calculator {

    private static final double EARTH_RADIUS_KM = 6371.0;

    private Calculator() {
    }

    /** Distance in whole km between two decimal lat/long points. */
    public static long distanceKm(double lat1, double lon1, double lat2, double lon2) {
        double lat1R = Math.toRadians(lat1);
        double lat2R = Math.toRadians(lat2);
        double diffLatR = Math.toRadians(lat2 - lat1);
        double diffLonR = Math.toRadians(lon2 - lon1);

        double a = Math.sin(diffLatR / 2) * Math.sin(diffLatR / 2)
                + Math.cos(lat1R) * Math.cos(lat2R)
                * Math.sin(diffLonR / 2) * Math.sin(diffLonR / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return Math.round(EARTH_RADIUS_KM * c);
    }
}
