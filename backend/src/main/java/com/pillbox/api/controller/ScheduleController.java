package com.pillbox.api.controller;

import com.pillbox.api.model.MedicationConfig;
import com.pillbox.api.repository.MedicationConfigRepository; // You'll need to create this simple interface
import org.springframework.beans.factory.annotation.Autowired;
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
        List<String> times = new ArrayList<>();
        LocalTime current = config.getStartTime();

        // Safety: Prevent infinite loops if interval is 0
        if (config.getIntervalHours() <= 0) config.setIntervalHours(24);

        // Keep adding times as long as we are still in the SAME day
        // AND we haven't exceeded a safety limit (e.g. 24)
        LocalTime start = config.getStartTime();

        do {
            times.add(current.format(DateTimeFormatter.ofPattern("HH:mm")));

            // Move to next interval
            current = current.plusHours(config.getIntervalHours());

            // STOP if the new time is earlier than the start time (meaning we crossed midnight)
            // OR if the new time is exactly the start time (24-hour loop)
        } while (current.isAfter(start) && times.size() < 24);

        // Join into string "08:00,12:00,16:00..."
        config.setCalculatedTimes(String.join(",", times));

        repository.save(config);
        return "Schedule Updated for Slot " + config.getSlotId();
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
}