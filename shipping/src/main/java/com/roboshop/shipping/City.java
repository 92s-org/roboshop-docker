package com.roboshop.shipping;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "cities")
public class City {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long uuid;

    @Column(name = "country_code")
    private String code;
    private String city;
    private String name;
    private String region;
    private double latitude;
    private double longitude;

    public long getUuid() {
        return uuid;
    }

    public String getCode() {
        return code;
    }

    public String getCity() {
        return city;
    }

    public String getName() {
        return name;
    }

    public String getRegion() {
        return region;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    @Override
    public String toString() {
        return "Country: %s City: %s Region: %s Coords: %f %f".formatted(code, city, region, latitude, longitude);
    }
}
