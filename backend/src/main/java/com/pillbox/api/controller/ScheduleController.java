package com.pillbox.api.controller;

import com.pillbox.api.model.MedicationConfig;
import com.pillbox.api.repository.MedicationConfigRepository;
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
        // Calculate the alarms based on Start Time and Interval
        List<String> times = new ArrayList<>();
        LocalTime current = config.getStartTime();

        // Limit to max 4 alarms per day as requested
        for (int i = 0; i < 4; i++) {
            times.add(current.format(DateTimeFormatter.ofPattern("HH:mm")));
            current = current.plusHours(config.getIntervalHours());

            // Break if we wrap around to the next day (optional logic)
            // if (current.isBefore(config.getStartTime())) break;
        }

        // Join into string "08:00,12:00,16:00"
        config.setCalculatedTimes(String.join(",", times));

        repository.save(config);
        return "Schedule Updated for Slot " + config.getSlotId();
    }

    @GetMapping("/")
    public List<MedicationConfig> getSchedule(){
        List<MedicationConfig> list = repository.findAll();
        return list;
    }

    @PutMapping("/update/{id}")
    public ResponseEntity<String> setSchedule(@PathVariable Integer id, @RequestBody MedicationConfig updatedData) {
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
        List<MedicationConfig> configs = repository.findAll();
        StringBuilder sb = new StringBuilder();

        for (MedicationConfig c : configs) {
            sb.append(c.getSlotId()).append("|").append(c.getCalculatedTimes()).append(";");
        }

        return sb.toString();
    }
}