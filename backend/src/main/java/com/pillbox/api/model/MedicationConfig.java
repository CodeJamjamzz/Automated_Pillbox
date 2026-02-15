package com.pillbox.api.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalTime;

@Entity
@Data
@NoArgsConstructor
@Table(name = "medication_configs")
public class MedicationConfig {

    @Id
    private Integer slotId; // 1, 2, 3, or 4 (Manually assigned)

    private String pillName;
    private String takerName;
    private int pillAmount;

    private LocalTime startTime;
    private int intervalHours; // e.g., 4, 6, 8, 12, 24
    private int durationDays;  // Optional

    // We store the calculated times as a simple string for the ESP32
    // Format: "08:00,12:00,16:00"
    private String calculatedTimes;

    public Integer getSlotId() {
        return slotId;
    }

    public void setSlotId(Integer slotId) {
        this.slotId = slotId;
    }

    public String getPillName() {
        return pillName;
    }

    public void setPillName(String pillName) {
        this.pillName = pillName;
    }

    public String getTakerName() {
        return takerName;
    }

    public void setTakerName(String takerName) {
        this.takerName = takerName;
    }

    public int getPillAmount() {
        return pillAmount;
    }

    public void setPillAmount(int pillAmount) {
        this.pillAmount = pillAmount;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalTime startTime) {
        this.startTime = startTime;
    }

    public int getIntervalHours() {
        return intervalHours;
    }

    public void setIntervalHours(int intervalHours) {
        this.intervalHours = intervalHours;
    }

    public int getDurationDays() {
        return durationDays;
    }

    public void setDurationDays(int durationDays) {
        this.durationDays = durationDays;
    }

    public String getCalculatedTimes() {
        return calculatedTimes;
    }

    public void setCalculatedTimes(String calculatedTimes) {
        this.calculatedTimes = calculatedTimes;
    }
}