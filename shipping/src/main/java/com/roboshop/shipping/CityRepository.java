package com.roboshop.shipping;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CityRepository extends JpaRepository<City, Long> {

    List<City> findByCode(String code);

    // auto-complete: first 10 cities in the country starting with the text
    List<City> findTop10ByCodeAndCityStartingWithOrderByNameAsc(String code, String text);
}
