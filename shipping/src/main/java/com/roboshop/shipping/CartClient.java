package com.roboshop.shipping;

import java.net.http.HttpClient;
import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Calls the cart service to add the shipping line to a cart. */
@Component
public class CartClient {

    private static final Logger logger = LoggerFactory.getLogger(CartClient.class);

    private final RestClient restClient;

    public CartClient(@Value("${cart.endpoint}") String cartEndpoint) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofSeconds(5));

        this.restClient = RestClient.builder()
                .baseUrl("http://" + cartEndpoint)
                .requestFactory(factory)
                .build();
    }

    /** Returns the updated cart JSON, or null if the cart was not found or cart is down. */
    public String addShipping(String id, String shippingJson) {
        logger.info("add shipping to cart {}", id);
        try {
            return restClient.post()
                    .uri("/shipping/{id}", id)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(shippingJson)
                    .retrieve()
                    .body(String.class);
        } catch (RestClientException e) {
            logger.warn("cart call failed: {}", e.getMessage());
            return null;
        }
    }
}
