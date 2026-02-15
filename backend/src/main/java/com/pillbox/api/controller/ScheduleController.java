package com.pillbox.api.controller;

import com.pillbox.api.model.MedicationConfig;
import com.pillbox.api.repository.MedicationConfigRepository; // You'll need to create this simple interface
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/schedule")
@CrossOrigin(origins = "*")
public class ScheduleController {

    @Autowired
    private MedicationConfigRepository repository;

    // 1. App sends settings here
    @PostMapping("/set")
    public String setSchedule(@RequestBody MedicationConfig config) {

        // --- VALIDATION LOCK ---
        // Ensure we only touch Slots 1-4
        if (config.getSlotId() == null || config.getSlotId() < 1 || config.getSlotId() > 4) {
            throw new RuntimeException("ERROR: Only Slots 1-4 are allowed.");
        }

        List<String> times = new ArrayList<>();

        // Use existing start time or default to now if missing
        LocalTime current = (config.getStartTime() != null) ? config.getStartTime() : LocalTime.now();
        LocalTime start = current;

        // Safety: Prevent infinite loops if interval is 0 (disable alarms)
        if (config.getIntervalHours() <= 0) {
            config.setCalculatedTimes(""); // Clear alarms
            repository.save(config);
            return "Alarms Disabled for Slot " + config.getSlotId();
        }

        // Logic to generate 08:00, 12:00, etc.
        do {
            times.add(current.format(DateTimeFormatter.ofPattern("HH:mm")));
            current = current.plusHours(config.getIntervalHours());
        } while (current.isAfter(start) && times.size() < 24); // Limit to 24 alarms max

        // Join into string "08:00,12:00..."
        config.setCalculatedTimes(String.join(",", times));

        // JPA "save" acts as an UPDATE because the ID (1-4) already exists
        repository.save(config);

        return "Schedule Updated for Slot " + config.getSlotId();
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<String> setSchedule(@PathVariable Integer id, @RequestBody MedicationConfig updatedData) {
        // 1. Find the existing slot by ID (slotId)
        return repository.findById(id).map(config -> {

            // 2. Map basic medicine and illness info
            config.setPillName(updatedData.getPillName());
            config.setIllnessName(updatedData.getIllnessName());
            config.setPillAmount(updatedData.getPillAmount());
            config.setDosage(updatedData.getDosage());
            config.setColorCode(updatedData.getColorCode());

            // 3. Map timing and duration
            config.setStartDate(updatedData.getStartDate());
            config.setStartTime(updatedData.getStartTime());
            config.setIntervalHours(updatedData.getIntervalHours());
            config.setDurationDays(updatedData.getDurationDays());

            // 4. Handle Calculated Times (If your React app still sends a list)
            // This is useful for the hardware to have a ready-to-use comma-separated string
            if (updatedData.getCalculatedTimes() != null) {
                config.setCalculatedTimes(updatedData.getCalculatedTimes());
            }

            repository.save(config);

            return ResponseEntity.ok("Schedule Updated for Slot " + id);
        }).orElse(ResponseEntity.notFound().build());
    }

    // 2. ESP32 calls this to get the simple list
    @GetMapping("/sync")
    public String getSyncData() {
        // --- ADDED LOG ---
        System.out.println(">>> ESP32 REQUESTED SCHEDULE SYNC");

        List<MedicationConfig> configs = repository.findAll();
        StringBuilder sb = new StringBuilder();

        for (MedicationConfig c : configs) {
            sb.append(c.getSlotId()).append("|").append(c.getCalculatedTimes()).append(";");
        }
        return sb.toString();
    }

    @PostMapping("/decrement/{slotId}")
    public String decrementPills(@PathVariable Integer slotId) {
        MedicationConfig config = repository.findById(slotId).orElse(null);
        if (config != null && config.getPillAmount() > 0) {
            config.setPillAmount(config.getPillAmount() - 1);
            repository.save(config);
            System.out.println(">>> PILL TAKEN! Slot " + slotId + " count is now: " + config.getPillAmount());
            return "Decremented";
        }
        return "Slot not found or empty";
    }
}