package com.worksheet.shared.security;

import com.worksheet.shared.errors.ApiError;
import com.worksheet.shared.errors.RequestIdFilter;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.crypto.password.Pbkdf2PasswordEncoder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import tools.jackson.databind.ObjectMapper;

import static org.springframework.security.crypto.password.Pbkdf2PasswordEncoder.SecretKeyFactoryAlgorithm.PBKDF2WithHmacSHA256;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    @Bean
    PasswordEncoder passwordEncoder() {
        return new Pbkdf2PasswordEncoder("", 16, 600_000, PBKDF2WithHmacSHA256);
    }

    @Bean
    UserDetailsService noFormLoginUsers() {
        return username -> { throw new UsernameNotFoundException("Form login is not used by this application."); };
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper mapper,
                                            @Value("${app.security.csrf-enabled:true}") boolean csrfEnabled)
            throws Exception {
        http.cors(cors -> { });
        if (csrfEnabled) {
            CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
            repository.setCookiePath("/api");
            CsrfTokenRequestAttributeHandler handler = new CsrfTokenRequestAttributeHandler();
            handler.setCsrfRequestAttributeName("_csrf");
            http.csrf(csrf -> csrf.csrfTokenRepository(repository).csrfTokenRequestHandler(handler));
        } else {
            http.csrf(csrf -> csrf.disable());
        }
        http.authorizeHttpRequests(auth -> auth
            .requestMatchers("/", "/index.html", "/favicon.svg", "/assets/**", "/img/**", "/sounds/**", "/error").permitAll()
            .requestMatchers(HttpMethod.GET, "/login", "/signup", "/home", "/home/*", "/account", "/sheets",
                "/teacher", "/teacher/*", "/kids", "/kids/*", "/classes", "/classes/*",
                "/assignments", "/assignments/*", "/attempts/*").permitAll()
            .requestMatchers(HttpMethod.GET, "/classes/*/children/*", "/classes/*/children/*/tests/*", "/home/*/*").permitAll()
            .requestMatchers(HttpMethod.GET, "/assignments/classes/*", "/assignments/classes/*/worksheets/*").permitAll()
            .requestMatchers("/api/auth/signup", "/api/auth/login", "/api/auth/csrf").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/play/join", "/api/play/login").permitAll()
            .requestMatchers(HttpMethod.GET, "/student", "/student/**", "/results", "/classes/*/access-cards").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/minigames", "/api/minigames/*").permitAll()
            .requestMatchers("/api/minigame1/**", "/api/count-match/**").permitAll()
            .requestMatchers("/api/admin/**").hasRole("ADMIN")
            .anyRequest().authenticated());
        http.exceptionHandling(errors -> errors
            .authenticationEntryPoint((request, response, exception) -> writeError(
                mapper, request, response, 401, "UNAUTHORIZED", "Please log in."))
            .accessDeniedHandler((request, response, exception) -> writeError(
                mapper, request, response, 403, "FORBIDDEN", "This account does not have permission for this action.")));
        http.sessionManagement(session -> session.sessionFixation(fixation -> fixation.changeSessionId()));
        return http.build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${app.auth.allowed-origin:http://localhost:5173}") String allowedOrigin) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(allowedOrigin));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Content-Type", "X-XSRF-TOKEN", "X-Auth-Request", "X-Request-ID"));
        configuration.setExposedHeaders(List.of("X-Request-ID"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }

    private void writeError(ObjectMapper mapper, jakarta.servlet.http.HttpServletRequest request,
                            jakarta.servlet.http.HttpServletResponse response, int status,
                            String code, String message) throws java.io.IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        String requestId = (String) request.getAttribute(RequestIdFilter.REQUEST_ID_ATTRIBUTE);
        mapper.writeValue(response.getOutputStream(), new ApiError(code, message, Map.of(), requestId, Instant.now()));
    }
}
