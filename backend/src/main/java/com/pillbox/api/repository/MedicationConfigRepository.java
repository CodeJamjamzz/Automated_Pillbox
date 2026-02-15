package com.pillbox.api.repository;

import com.pillbox.api.model.MedicationConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MedicationConfigRepository extends JpaRepository<MedicationConfig, Integer> {
    // This interface automatically gives you methods like:
    // .save(), .findAll(), .findById(), .delete()
    // No extra code needed!
}