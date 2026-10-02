package com.roboshop.shipping;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class Controller {

    private static final Logger logger = LoggerFactory.getLogger(Controller.class);

    // the warehouse everything ships from (Germany)
    private static final double HOME_LATITUDE = 51.164896;
    private static final double HOME_LONGITUDE = 7.068792;

    // used by /memory and /free to demo a memory leak
    private static final List<byte[]> bytesGlobal = Collections.synchronizedList(new ArrayList<>());

    private final CityRepository cityRepo;
    private final CodeRepository codeRepo;
    private final CartClient cartClient;

    public Controller(CityRepository cityRepo, CodeRepository codeRepo, CartClient cartClient) {
        this.cityRepo = cityRepo;
        this.codeRepo = codeRepo;
        this.cartClient = cartClient;
    }

    @GetMapping("/health")
    public String health() {
        return "OK";
    }

    // each call keeps 25 MB more in memory
    @GetMapping("/memory")
    public int memory() {
        byte[] bytes = new byte[1024 * 1024 * 25];
        Arrays.fill(bytes, (byte) 8);
        bytesGlobal.add(bytes);
        return bytesGlobal.size();
    }

    @GetMapping("/free")
    public int free() {
        bytesGlobal.clear();
        return bytesGlobal.size();
    }

    @GetMapping("/count")
    public long count() {
        return cityRepo.count();
    }

    @GetMapping("/codes")
    public List<Code> codes() {
        logger.info("all codes");
        return codeRepo.findAll(Sort.by(Sort.Direction.ASC, "name"));
    }

    @GetMapping("/cities/{code}")
    public List<City> cities(@PathVariable String code) {
        logger.info("cities by code {}", code);
        return cityRepo.findByCode(code);
    }

    @GetMapping("/match/{code}/{text}")
    public List<City> match(@PathVariable String code, @PathVariable String text) {
        logger.info("match code {} text {}", code, text);
        if (text.length() < 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "type at least 3 characters");
        }
        return cityRepo.findTop10ByCodeAndCityStartingWithOrderByNameAsc(code, text);
    }

    @GetMapping("/calc/{id}")
    public Ship calc(@PathVariable long id) {
        logger.info("calculation for {}", id);
        City city = cityRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "city not found"));

        long distance = Calculator.distanceKm(city.getLatitude(), city.getLongitude(), HOME_LATITUDE, HOME_LONGITUDE);
        // 5 cents per km
        double cost = Math.rint(distance * 5) / 100.0;
        Ship ship = new Ship(distance, cost);
        logger.info("shipping {}", ship);
        return ship;
    }

    // adds the shipping line to the cart and returns the cart
    @PostMapping(path = "/confirm/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public String confirm(@PathVariable String id, @RequestBody String body) {
        logger.info("confirm id: {}", id);
        String cart = cartClient.addShipping(id, body);
        if (cart == null || cart.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "cart not found");
        }
        return cart;
    }
}
