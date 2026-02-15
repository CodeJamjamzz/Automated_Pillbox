package com.pillbox.api.repository;

import com.pillbox.api.model.PillLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PillLogRepository extends JpaRepository<PillLog, Long> {
    // Custom query to get the 10 most recent logs
    List<PillLog> findTop10ByOrderByTimestampDesc();
}