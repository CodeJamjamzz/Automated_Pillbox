package com.pillbox.api.config;

import com.pillbox.api.model.MedicationConfig;
import com.pillbox.api.repository.MedicationConfigRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalTime;

@Configuration
public class DataInitializer {

    @Bean
    CommandLineRunner initDatabase(MedicationConfigRepository repository) {
        return args -> {
            // Only add data if the database is empty
            if (repository.count() == 0) {
                System.out.println(">>> DATABASE IS EMPTY. AUTO-FILLING DEFAULT SCHEDULE...");

                MedicationConfig config = new MedicationConfig();
                config.setSlotId(1);
                config.setPillName("Test Pill");
                config.setTakerName("Grandma");
                config.setPillAmount(10);
                config.setStartTime(LocalTime.of(8, 0)); // 8:00 AM
                config.setIntervalHours(4);

                // Pre-calculate the times string for the ESP32
                config.setCalculatedTimes("08:00,12:00,16:00,20:00");

                repository.save(config);

                System.out.println(">>> DEFAULT SCHEDULE ADDED! ESP32 WILL NO LONGER CRASH.");
            }
        };
    }
}
