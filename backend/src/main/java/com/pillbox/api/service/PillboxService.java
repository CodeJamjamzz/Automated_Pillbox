package com.pillbox.api.service;

import com.pillbox.api.model.PillLog;
import com.pillbox.api.model.SensorData;
import com.pillbox.api.repository.PillLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PillboxService {

    @Autowired
    private PillLogRepository repository;

    // Initialize with default values using the manual constructor
    private SensorData currentState = new SensorData(false, false, false, false, "0.0,0.0");

    // Called by ESP32 to update the "Truth"
    public void updateState(SensorData newData) {
        // 1. Update the live memory state
        this.currentState = newData;

        // 2. SAVE TO DATABASE
        PillLog log = new PillLog(newData);
        repository.save(log);

        System.out.println("State Updated & Saved to DB");
    }

    public SensorData getCurrentState() {
        return this.currentState;
    }

    // Optional: Get history
    public List<PillLog> getHistory() {
        return repository.findTop10ByOrderByTimestampDesc();
    }
}