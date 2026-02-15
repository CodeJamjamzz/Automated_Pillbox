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
            // Loop through IDs 1 to 4
            for (int i = 1; i <= 4; i++) {
                // Try to find the slot. If it doesn't exist, create it.
                if (!repository.existsById(i)) {
                    MedicationConfig defaultSlot = new MedicationConfig();
                    defaultSlot.setSlotId(i); // Force ID 1, 2, 3, or 4
                    defaultSlot.setPillName("Empty Slot " + i);
                    defaultSlot.setStartTime(LocalTime.of(8, 0)); // Default 08:00 AM
                    defaultSlot.setIntervalHours(0); // No alarms by default
                    defaultSlot.setCalculatedTimes(""); // No alarms string

                    repository.save(defaultSlot);
                    System.out.println(">>> Created Default Entry for Slot " + i);
                }
            }
            System.out.println(">>> Database initialized with 4 Fixed Slots.");
        };
    }
}