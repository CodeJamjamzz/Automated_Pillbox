package com.pillbox.api.service;

import com.pillbox.api.model.SensorData;
import org.springframework.stereotype.Service;

@Service
public class PillboxService {

    // Default state: All empty, GPS at 0,0
    private SensorData currentState = new SensorData(false, false, false, false, "0.0,0.0");

    // Called by ESP32 to update the "Truth"
    public void updateState(SensorData newData) {
        this.currentState = newData;
        System.out.println("Updated State: " + newData); // Log it so you can see it working
    }

    // Called by App to read the "Truth"
    public SensorData getCurrentState() {
        return this.currentState;
    }
}