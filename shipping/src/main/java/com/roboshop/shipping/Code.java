package com.roboshop.shipping;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** A country code, e.g. "in" - "India". */
@Entity
@Table(name = "codes")
public class Code {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long uuid;

    private String code;
    private String name;

    public long getUuid() {
        return uuid;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    @Override
    public String toString() {
        return "Code: %s Name: %s".formatted(code, name);
    }
}
