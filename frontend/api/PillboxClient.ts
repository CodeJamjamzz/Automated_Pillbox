// frontend/api/PillboxClient.ts

// REPLACE with your Laptop's IP Address (e.g., 192.168.1.5)
// Do NOT use "localhost" (that refers to the phone itself)
const BASE_URL = 'http://192.168.1.5:8080/api/pillbox'; // Replace with YOUR IP
export interface SensorData {
    sensor1: boolean; // True = Pill Detected (Full), False = Empty
    sensor2: boolean;
    sensor3: boolean;
    sensor4: boolean;
    gpsCoordinates: string; // Format: "10.31,123.88"
}

export const PillboxClient = {
    // Fetch current status from Spring Boot
    getStatus: async (): Promise<SensorData | null> => {
        try {
            const response = await fetch(`${BASE_URL}/status`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) throw new Error("Server error");
            return await response.json();
        } catch (error) {
            // Fail silently (offline mode) so the app doesn't crash
            console.log("Polling Error:", error);
            return null;
        }
    }
};