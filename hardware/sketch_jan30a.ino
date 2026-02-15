#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Preferences.h>
#include <time.h>
#include <mbedtls/base64.h>

// ================= PIN DEFINITIONS =================
#define LCD_SDA_PIN  21
#define LCD_SCL_PIN  22
#define BUTTON_YES_PIN 4
#define BUTTON_NO_PIN  5
#define BUZZER_PIN     18
#define GPS_RX_PIN     16
#define GPS_TX_PIN     17
#define MAX_ALARMS 24

const int SENSOR_PINS[4] = {34, 35, 13, 23};
const int LED_PINS[4]    = {32, 15, 25, 19};

// ================= UUIDS =================
#define SERVICE_UUID           "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHAR_WIFI_UUID         "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHAR_SCHEDULE_UUID     "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHAR_NOTIFY_UUID       "6E400004-B5A3-F393-E0A9-E50E24DCCA9E"

// ================= GLOBALS =================
LiquidCrystal_I2C lcd(0x27, 16, 2);
Preferences preferences;
BLECharacteristic* pNotifyChar = NULL;
TinyGPSPlus gps;
HardwareSerial gpsSerial(1); // Use UART1
bool confirmationMode = false;
unsigned long confirmationStartTime = 0;
int pendingSlotID = 0;
unsigned long lastBeepTime = 0;
bool buzzerState = false;

String savedSSID = "";
String savedPass = "";
// WARNING: Use your PC's IP here, NOT localhost
String SERVER_URL = "http://172.20.10.5:8080/api/pillbox/update";
String SCHEDULE_URL = "http://172.20.10.5:8080/api/schedule/sync";

// Time Settings
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 28800; // UTC+8
const int   daylightOffset_sec = 0;

// Unified Alarm Structure (Single Source of Truth)
struct Compartment {
  String alarms[MAX_ALARMS]; // Stores "HH:MM"
  int alarmCount = 0;
};
Compartment slots[4];

// State Variables
unsigned long lastSyncTime = 0;
unsigned long lastUpdate = 0; // Fixed: Was missing
int activeAlarmSlot = -1;
int lockedSensorID = 0;
bool deviceConnected = false;
bool wifiConnected = false;
int lastTriggeredMinute = -1; // New: Prevents double alarms without blocking delay

// ================= HELPER FUNCTIONS =================

String decodeBase64(String input) {
  unsigned char output[128];
  size_t olen = 0;
  mbedtls_base64_decode(output, 128, &olen, (const unsigned char*)input.c_str(), input.length());
  return String((char*)output).substring(0, olen);
}

// Unified Parsing Logic (Used by BOTH WiFi and BLE)
void parseSchedule(String payload) {
  // Format expected: "1|08:00,12:00;2|09:00;"
  // Note: App/Backend uses 1-based indexing, array uses 0-based

  // Safety check: Don't wipe everything if payload is empty
  // 1. SAFETY CHECK: If payload is empty or too short, stop immediately.
  if (payload.length() == 0 || payload == "{}") {
    Serial.println("Schedule is empty, skipping parse.");
    return;
  }

  // Clear old schedules
  for(int i=0; i<4; i++) slots[i].alarmCount = 0;

  int start = 0;
  while (start < payload.length()) {
    int end = payload.indexOf(';', start);
    if (end == -1) end = payload.length();

    String segment = payload.substring(start, end);

    int pipe = segment.indexOf('|');
    if (pipe != -1) {
      int slotID = segment.substring(0, pipe).toInt() - 1;
      if (slotID >= 0 && slotID < 4) {
        String times = segment.substring(pipe + 1);

        int tStart = 0;
        int count = 0;
        while (tStart < times.length() && count < MAX_ALARMS) {
          int tEnd = times.indexOf(',', tStart);
          if (tEnd == -1) tEnd = times.length();

          slots[slotID].alarms[count] = times.substring(tStart, tEnd);
          count++;
          tStart = tEnd + 1;
        }
        slots[slotID].alarmCount = count;
        Serial.printf("Slot %d updated with %d alarms.\n", slotID+1, count);
      }
    }
    start = end + 1;
  }
}

// ================= COMMUNICATIONS =================

// 1. Send Sensor Data to Spring Boot
void sendToSpringboot() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");

    // Read Sensors
    bool s1 = digitalRead(SENSOR_PINS[0]) == LOW;
    bool s2 = digitalRead(SENSOR_PINS[1]) == LOW;
    bool s3 = digitalRead(SENSOR_PINS[2]) == LOW;
    bool s4 = digitalRead(SENSOR_PINS[3]) == LOW;

    // Default GPS to avoid "null" errors
    String gpsCoords = "0.0,0.0";
    if (gps.location.isValid()) {
      gpsCoords = String(gps.location.lat(), 6) + "," + String(gps.location.lng(), 6);
    }

    // --- JSON CONSTRUCTION FIX ---
    // We use \" to ensure quotes are placed correctly around strings, but NOT booleans
    String jsonPayload = "{";
    jsonPayload += "\"sensor1\": " + String(s1 ? "true" : "false") + ",";
    jsonPayload += "\"sensor2\": " + String(s2 ? "true" : "false") + ",";
    jsonPayload += "\"sensor3\": " + String(s3 ? "true" : "false") + ",";
    jsonPayload += "\"sensor4\": " + String(s4 ? "true" : "false") + ",";
    jsonPayload += "\"gpsCoordinates\": \"" + gpsCoords + "\"";
    jsonPayload += "}";

    // Debug Print (So you can see exactly what you are sending)
    Serial.println("Sending Payload: " + jsonPayload);

    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode > 0) {
      Serial.println("Spring Boot Response: " + String(httpResponseCode)); // Look for 200 here
    } else {
      Serial.println("Error Sending: " + String(httpResponseCode));
    }
    http.end();
  }
}
// 2. Sync Schedule from Spring Boot
void syncSchedule() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SCHEDULE_URL);
    int httpCode = http.GET();

    if (httpCode == 200) {
      String payload = http.getString();
      Serial.println("Syncing: " + payload);
      parseSchedule(payload);
    }
    http.end();
  }
}

// ================= BLE CALLBACKS =================
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) { deviceConnected = true; };
    void onDisconnect(BLEServer* pServer) { deviceConnected = false; BLEDevice::startAdvertising(); }
};

class WifiCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String encoded = pCharacteristic->getValue().c_str();
      if (encoded.length() == 0) return;

      String decoded = decodeBase64(encoded);
      int split = decoded.indexOf(':');

      if (split > 0) {
        String ssid = decoded.substring(0, split);
        String pass = decoded.substring(split + 1);

        preferences.begin("wifi_conf", false);
        preferences.putString("ssid", ssid);
        preferences.putString("pass", pass);
        preferences.end();

        // --- FIX: Disconnect before reconnecting ---
        WiFi.disconnect();
        delay(100);
        WiFi.begin(ssid.c_str(), pass.c_str());

        lcd.clear();
        lcd.print("New WiFi Set!");
      }
    }
};

class ScheduleCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String val = pCharacteristic->getValue().c_str();
      // Reuse the same parsing logic!
      // Ensure React Native sends format: "1|08:00,12:00;"
      if (val.length() > 0) {
         Serial.println("BLE Schedule Recv: " + val);
         parseSchedule(val);
      }
    }
};

// ================= SETUP =================
// ================= DEBUG SETUP =================
void setup() {
  Serial.begin(115200);

  // 1. Initialize Hardware
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  lcd.init(); lcd.backlight();
  pinMode(BUTTON_YES_PIN, INPUT_PULLUP);
  pinMode(BUTTON_NO_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);

  // Setup Sensors
  for(int i=0; i<4; i++){
    if(SENSOR_PINS[i]>=34 && SENSOR_PINS[i]<=39) pinMode(SENSOR_PINS[i], INPUT);
    else pinMode(SENSOR_PINS[i], INPUT_PULLUP);
    pinMode(LED_PINS[i], OUTPUT); digitalWrite(LED_PINS[i], LOW);
  }

  // 2. BLE Setup
  BLEDevice::init("MedBox Pro");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pService->createCharacteristic(CHAR_WIFI_UUID, BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new WifiCallbacks());
  pService->createCharacteristic(CHAR_SCHEDULE_UUID, BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new ScheduleCallbacks());
  pNotifyChar = pService->createCharacteristic(CHAR_NOTIFY_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  pNotifyChar->addDescriptor(new BLE2902());
  pService->start();
  BLEDevice::startAdvertising();

  // 3. Wi-Fi Connection (VERBOSE DEBUGGING)
  savedSSID = "AJ Lomocso"; // Verify this is 2.4GHz (ESP32 cannot see 5GHz)
  savedPass = "piyang2004";

  lcd.setCursor(0, 0);
  lcd.print("WiFi Connecting...");
  Serial.println("\n--------------------------------");
  Serial.println("Starting Wi-Fi Connection...");
  Serial.print("Target SSID: "); Serial.println(savedSSID);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

  WiFi.begin(savedSSID.c_str(), savedPass.c_str());

  // Wait up to 15 seconds for connection
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  // Report Result
  Serial.println("\n--------------------------------");
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("SUCCESS: Wi-Fi Connected!");
    Serial.print("IP Address: "); Serial.println(WiFi.localIP());
    Serial.print("Signal Strength (RSSI): "); Serial.println(WiFi.RSSI());
    lcd.setCursor(0, 1); lcd.print("Success!");

    // 4. Start Time Sync ONLY after Wi-Fi is good
    Serial.println("Starting NTP Time Sync...");
    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  } else {
    Serial.println("FAILURE: Could not connect to Wi-Fi.");
    Serial.print("Error Code: "); Serial.println(WiFi.status());
    // Codes: 1=No SSID, 4=Connect Fail, 5=Lost, 6=Disconnected
    lcd.setCursor(0, 1); lcd.print("WiFi Failed!");
  }
  Serial.println("--------------------------------\n");

}

// ================= DEBUG LOOP =================
void loop(){
  // 1. GPS Feed
  while (gpsSerial.available() > 0) gps.encode(gpsSerial.read());

  // FORCE SEND every 3 seconds
  if (millis() - lastUpdate > 3000) {
     Serial.println("--- LOOP: Attempting to Send Sensor Data ---"); // Debug print
     sendToSpringboot();
     lastUpdate = millis();
  }

  if (millis() - lastSyncTime > 60000 || lastSyncTime == 0) {
    if(wifiConnected) {
        syncSchedule();
        lastSyncTime = millis();
    }
  }

 // Inside loop()
  if (activeAlarmSlot != -1 && !confirmationMode) { // Added !confirmationMode
      if (millis() - lastBeepTime > 500) {
          buzzerState = !buzzerState;
          digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
          lastBeepTime = millis();
      }
  } else {
      digitalWrite(BUZZER_PIN, LOW);
  }

  checkLocalSchedule();
  updateSensors();
  checkButtons();
  updateDisplay(); // See modified function below

  delay(50);
}

// ================= LOGIC =================
void checkLocalSchedule(){
  struct tm timeinfo;
  if(getLocalTime(&timeinfo)){

    // Safety: Only trigger if we haven't already triggered this minute
    if (timeinfo.tm_min == lastTriggeredMinute) return;

    char timeStr[6];
    sprintf(timeStr, "%02d:%02d", timeinfo.tm_hour, timeinfo.tm_min);

    // --- DEBUG PRINT (Add this to see the clock ticking) ---
    Serial.println("Current Time: " + String(timeStr));

    for(int s=0; s<4; s++) {
      for(int a=0; a < slots[s].alarmCount; a++) {
        // Simple String comparison
        if(slots[s].alarms[a].equals(timeStr) && activeAlarmSlot == -1) {
             Serial.println("!!! MATCH FOUND !!! Triggering Alarm..."); // <--- Debug
             triggerAlarm(s);
             lastTriggeredMinute = timeinfo.tm_min; // Lock this minute
        }
      }
    }
  }
}

void triggerAlarm(int slotIdx){
  activeAlarmSlot = slotIdx;
  digitalWrite(LED_PINS[slotIdx], HIGH);

  if(deviceConnected){
    String msg = "CONFIRM:"+String(slotIdx+1);
    pNotifyChar->setValue(msg.c_str());
    pNotifyChar->notify();
  }
  Serial.println("Alarm Triggered on slot: "+String(slotIdx));
}

void checkButtons() {
    // Priority 1: Confirmation Question (Either from Alarm or Random Access)
    if (confirmationMode) {
        unsigned long elapsed = millis() - confirmationStartTime;
        if (elapsed > 30000) {
            if (activeAlarmSlot != -1) resolveAlarm(true);
            else completeTransaction(true);
            return;
        }

        if (digitalRead(BUTTON_YES_PIN) == LOW) {
            delay(250); // Hard debounce to prevent double-trigger
            if (activeAlarmSlot != -1) resolveAlarm(true);
            else completeTransaction(true);
        }
        else if (digitalRead(BUTTON_NO_PIN) == LOW) {
            delay(250);
            if (activeAlarmSlot != -1) resolveAlarm(false);
            else completeTransaction(false);
        }
        if (activeAlarmSlot != -1) {
          // If we want the buzzer to stop after, say, 5 minutes (300,000 ms)
          // you would need to track when the alarm started.

          if (digitalRead(BUTTON_YES_PIN) == LOW) resolveAlarm(true);
          else if (digitalRead(BUTTON_NO_PIN) == LOW) resolveAlarm(false);
      }
        return; // EXIT HERE so we don't process "Alarm" buttons separately
    }

    // Priority 2: Standalone Alarm (Ringing but sensor NOT yet touched)
    if (activeAlarmSlot != -1) {
        if (digitalRead(BUTTON_YES_PIN) == LOW) resolveAlarm(true);
        else if (digitalRead(BUTTON_NO_PIN) == LOW) resolveAlarm(false);
    }
}

void completeTransaction(bool taken) {
    lcd.clear();
    if (taken) {
        lcd.print("  Recorded: YES ");
        Serial.println("User confirmed pill taken from Slot " + String(pendingSlotID));

        // --- NEW CODE START ---
        if (WiFi.status() == WL_CONNECTED) {
            HTTPClient http;
            // MAKE SURE THIS IP MATCHES YOUR SERVER_URL
            String url = "http://172.20.10.5:8080/api/schedule/decrement/" + String(pendingSlotID);

            http.begin(url);
            // We send an empty POST request because the ID is in the URL
            int httpCode = http.POST("");

            if (httpCode > 0) {
                Serial.println("Decrement Request Sent. Code: " + String(httpCode));
            } else {
                Serial.println("Decrement Failed. Error: " + String(httpCode));
            }
            http.end();
        }
        // --- NEW CODE END ---

    } else {
        lcd.print("  Recorded: NO  ");
        Serial.println("User said NO (just checking box).");
    }

    delay(2000); // Show result for 2 seconds

    // Reset State
    confirmationMode = false;
    pendingSlotID = 0;
    lcd.clear();
}

void resolveAlarm(bool taken){
  if(activeAlarmSlot==-1) return;

  // Stop Buzzers
  digitalWrite(BUZZER_PIN, LOW);
  buzzerState = false;
  digitalWrite(LED_PINS[activeAlarmSlot], LOW);

  lcd.clear();
  lcd.print(taken?"   CONFIRMED!   ":"    SKIPPED     ");

  // Notify BLE
  if(taken && deviceConnected){
    pNotifyChar->setValue("RESULT:TAKEN");
    pNotifyChar->notify();
  }

  // Immediate Cloud Update (Fast response)
  sendToSpringboot();

  activeAlarmSlot=-1;
  delay(1500); // Short freeze for UI feedback
}

void updateSensors() {
    // If a question is already being asked, LOCK the sensors
    if (confirmationMode) return;

    for (int i = 0; i < 4; i++) {
        if (digitalRead(SENSOR_PINS[i]) == LOW) {
            // Found a trigger!
            if (activeAlarmSlot == i) {
                // It's the right pill for the alarm
                startConfirmation(i + 1);
            }
            else if (activeAlarmSlot == -1) {
                // No alarm, just random access
                startConfirmation(i + 1);
            }
            break; // Stop looking at other sensors this frame
        }
    }
}
void startConfirmation(int slotID) {
    confirmationMode = true;
    pendingSlotID = slotID;
    confirmationStartTime = millis();

    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("Slot " + String(slotID) + " Opened!");
    lcd.setCursor(0, 1); lcd.print("Taken? (Yes/No)");
    Serial.println("Confirmation Mode Started for Slot " + String(slotID));
}

void updateDisplay() {
    // If asking a question, FREEZE the display (don't overwrite it)
    if (confirmationMode) return;

    // Standard Display Logic
    static bool lastAlarmState = false;
    if (lastAlarmState != (activeAlarmSlot != -1)) {
        lcd.clear();
        lastAlarmState = (activeAlarmSlot != -1);
    }

    if (activeAlarmSlot != -1) {
        lcd.setCursor(0, 0); lcd.print("! ALARM ACTIVE !");
        lcd.setCursor(0, 1); lcd.print(" CONFIRM? (Y/N) ");
        return;
    }

    // Normal Home Screen
    lcd.setCursor(0, 0);
    lcd.print("MedBox Pro      ");

    lcd.setCursor(0, 1);
    // 1. Check Wi-Fi First
    if (WiFi.status() != WL_CONNECTED) {
        lcd.print("No WiFi Connect ");
        return;
    }

    // 2. Check Time Second
    struct tm timeinfo;
    if (getLocalTime(&timeinfo, 500)) {
        lcd.printf("%02d:%02d", timeinfo.tm_hour, timeinfo.tm_min);
        lcd.print(" WiFi:OK ");
    } else {
        lcd.print("NTP Error/Sync..");
    }
}