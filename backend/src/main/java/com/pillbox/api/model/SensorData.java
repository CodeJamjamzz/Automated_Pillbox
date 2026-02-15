package com.pillbox.api.model;

public class SensorData {
    private boolean sensor1;
    private boolean sensor2;
    private boolean sensor3;
    private boolean sensor4;
    private String gpsCoordinates;

    // 1. Manual No-Args Constructor
    public SensorData() {
    }

    // 2. Manual All-Args Constructor (Fixes the first error)
    public SensorData(boolean sensor1, boolean sensor2, boolean sensor3, boolean sensor4, String gpsCoordinates) {
        this.sensor1 = sensor1;
        this.sensor2 = sensor2;
        this.sensor3 = sensor3;
        this.sensor4 = sensor4;
        this.gpsCoordinates = gpsCoordinates;
    }

    // 3. Manual Getters (Required for the App to read data)
    public boolean isSensor1() { return sensor1; }
    public boolean isSensor2() { return sensor2; }
    public boolean isSensor3() { return sensor3; }
    public boolean isSensor4() { return sensor4; }
    public String getGpsCoordinates() { return gpsCoordinates; }

    // 4. Manual Setters (Required for Spring to fill data)
    public void setSensor1(boolean sensor1) { this.sensor1 = sensor1; }
    public void setSensor2(boolean sensor2) { this.sensor2 = sensor2; }
    public void setSensor3(boolean sensor3) { this.sensor3 = sensor3; }
    public void setSensor4(boolean sensor4) { this.sensor4 = sensor4; }
    public void setGpsCoordinates(String gpsCoordinates) { this.gpsCoordinates = gpsCoordinates; }
}