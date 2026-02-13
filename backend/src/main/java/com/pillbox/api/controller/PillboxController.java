package com.pillbox.api.controller;

import com.pillbox.api.model.SensorData;
import com.pillbox.api.service.PillboxService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/pillbox")
@CrossOrigin(origins = "*") // Allows your Phone to talk to your Laptop
public class PillboxController {

    @Autowired
    private PillboxService service;

    // 1. ESP32 sends data here
    // URL: http://[YOUR_IP]:8080/api/pillbox/update
    @PostMapping("/update")
    public String updateStatus(@RequestBody SensorData data) {
        service.updateState(data);
        return "OK";
    }

    // 2. App reads data from here
    // URL: http://[YOUR_IP]:8080/api/pillbox/status
    @GetMapping("/status")
    public SensorData getStatus() {
        return service.getCurrentState();
    }
}