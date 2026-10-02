package com.roboshop.shipping;

import java.net.http.HttpClient;
import java.net.http.HttpTimeoutException;
import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

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

    /**
     * Returns the updated cart JSON.
     * 404 from cart -> 404 cart not found, slow cart -> 504, cart down or broken -> 502.
     */
    public String addShipping(String id, String shippingJson) {
        logger.info("add shipping to cart {}", id);
        try {
            return restClient.post()
                    .uri("/shipping/{id}", id)
                    .header(RequestLogFilter.HEADER, MDC.get(RequestLogFilter.MDC_KEY))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(shippingJson)
                    .retrieve()
                    .body(String.class);
        } catch (HttpClientErrorException.NotFound e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "cart not found");
        } catch (HttpClientErrorException.BadRequest e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "shipping data missing");
        } catch (ResourceAccessException e) {
            logger.error("cart call failed: {}", e.getMessage());
            if (e.getCause() instanceof HttpTimeoutException) {
                throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "cart did not answer in time");
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "cart service not available");
        } catch (RestClientException e) {
            logger.error("cart call failed: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "cart service error");
        }
    }
}
