package com.pillbox.api.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class SensorData {
    // true = Pill Detected (FULL), false = Empty
    private boolean sensor1;
    private boolean sensor2;
    private boolean sensor3;
    private boolean sensor4;

    // Format: "10.31,123.88"
    private String gpsCoordinates;
}