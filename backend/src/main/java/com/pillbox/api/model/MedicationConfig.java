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
    private String illnessName;
    private int pillAmount;
    private String dosage;
    private LocalTime startDate;
    private String colorCode;

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

    public String getillnessName() {
        return illnessName;
    }

    public void setillnessName(String illnessName) {
        this.illnessName = illnessName;
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

    public String getDosage() { return dosage; }

    public void setDosage(String dosage) { this.dosage = dosage; }

    public LocalTime getStartDate() { return startDate; }

    public void setStartDate(LocalTime startDate) { this.startDate = startDate; }

    public void getcolorCode() { return this.colorCode; }

    public void setcolorCode(String colorCode) { this.colorCode = colorCode; }

}