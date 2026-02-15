package com.pillbox.api.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "pill_logs")
public class PillLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private boolean sensor1;
    private boolean sensor2;
    private boolean sensor3;
    private boolean sensor4;
    private String gpsCoordinates;
    private LocalDateTime timestamp;

    public PillLog() {
    }

    // Constructor to convert SensorData to PillLog
    public PillLog(SensorData data) {
        this.sensor1 = data.isSensor1();
        this.sensor2 = data.isSensor2();
        this.sensor3 = data.isSensor3();
        this.sensor4 = data.isSensor4();
        this.gpsCoordinates = data.getGpsCoordinates();
        this.timestamp = LocalDateTime.now();
    }

    // Manual Getter for ID (Fixes the second error)
    public Long getId() {
        return id;
    }

    // Other Getters if needed later
    public LocalDateTime getTimestamp() { return timestamp; }
}