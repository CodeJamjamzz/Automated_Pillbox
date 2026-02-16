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
#define LCD_SDA_PIN    21
#define LCD_SCL_PIN    22
#define BUTTON_YES_PIN 4
#define BUTTON_NO_PIN  5
#define BUZZER_PIN     18
#define GPS_RX_PIN     16
#define GPS_TX_PIN     17
#define MAX_ALARMS     24

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

// State Variables
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

// Unified Alarm Structure
struct Compartment {
  String alarms[MAX_ALARMS];
  int alarmCount = 0;
};
Compartment slots[4];

// Loop Timers
unsigned long lastSyncTime = 0;
unsigned long lastUpdate = 0;
int activeAlarmSlot = -1;
bool deviceConnected = false;
bool wifiConnected = false;
int lastTriggeredMinute = -1;

// ================= FORWARD DECLARATIONS (Fixes Scope Errors) =================
void startConfirmation(int slotID);
void resolveAlarm(bool taken);
void completeTransaction(bool taken);
void sendToSpringboot(int triggeredSlot);

// ================= HELPER FUNCTIONS =================

String decodeBase64(String input) {
  unsigned char output[128];
  size_t olen = 0;
  mbedtls_base64_decode(output, 128, &olen, (const unsigned char*)input.c_str(), input.length());
  return String((char*)output).substring(0, olen);
}

void parseSchedule(String payload) {
  if (payload.length() == 0 || payload == "{}") return;

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

// FIXED: Now accepts triggeredSlot (Default 0 if called empty)
void sendToSpringboot(int triggeredSlot) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");

    // Sensor Logic: TRUE if physically held OR if it was the specific trigger event
    bool s1 = (digitalRead(SENSOR_PINS[0]) == LOW) || (triggeredSlot == 1);
    bool s2 = (digitalRead(SENSOR_PINS[1]) == LOW) || (triggeredSlot == 2);
    bool s3 = (digitalRead(SENSOR_PINS[2]) == LOW) || (triggeredSlot == 3);
    bool s4 = (digitalRead(SENSOR_PINS[3]) == LOW) || (triggeredSlot == 4);

    String gpsCoords = "0.0,0.0";
    if (gps.location.isValid()) {
      gpsCoords = String(gps.location.lat(), 6) + "," + String(gps.location.lng(), 6);
    }

    String jsonPayload = "{";
    jsonPayload += "\"sensor1\": " + String(s1 ? "true" : "false") + ",";
    jsonPayload += "\"sensor2\": " + String(s2 ? "true" : "false") + ",";
    jsonPayload += "\"sensor3\": " + String(s3 ? "true" : "false") + ",";
    jsonPayload += "\"sensor4\": " + String(s4 ? "true" : "false") + ",";
    jsonPayload += "\"gpsCoordinates\": \"" + gpsCoords + "\"";
    jsonPayload += "}";

    Serial.println("Sending Payload (Trigger=" + String(triggeredSlot) + "): " + jsonPayload);

    int httpResponseCode = http.POST(jsonPayload);
    if (httpResponseCode > 0) {
      Serial.println("Response: " + String(httpResponseCode));
    } else {
      Serial.println("Error Sending: " + String(httpResponseCode));
    }
    http.end();
  }
}

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

// ================= LOGIC FUNCTIONS =================

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

void resolveAlarm(bool taken){
  if(activeAlarmSlot==-1) return;

  digitalWrite(BUZZER_PIN, LOW);
  buzzerState = false;
  digitalWrite(LED_PINS[activeAlarmSlot], LOW);

  lcd.clear();
  lcd.print(taken?"   CONFIRMED!   ":"    SKIPPED     ");

  if(taken && deviceConnected){
    pNotifyChar->setValue("RESULT:TAKEN");
    pNotifyChar->notify();
  }

  // SEND LOG with specific slot ID (activeAlarmSlot is 0-based, add 1)
  sendToSpringboot(activeAlarmSlot + 1);

  activeAlarmSlot=-1;
  delay(1500);
}

void completeTransaction(bool taken) {
    lcd.clear();

    // 1. Handle "YES" - Decrement Pill Count
    if (taken) {
        lcd.print("  Recorded: YES ");
        Serial.println("User confirmed pill taken from Slot " + String(pendingSlotID));

        if (WiFi.status() == WL_CONNECTED) {
            HTTPClient http;
            String url = "http://172.20.10.5:8080/api/schedule/decrement/" + String(pendingSlotID);
            http.begin(url);
            int httpCode = http.POST("");
            http.end();
        }
    } else {
        lcd.print("  Recorded: NO  ");
        Serial.println("User said NO.");
    }

    // 2. SEND LOG with specific slot ID
    Serial.println("Logging Transaction to Database...");
    sendToSpringboot(pendingSlotID);

    delay(2000);

    // Reset State
    confirmationMode = false;
    pendingSlotID = 0;
    lcd.clear();
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

void checkLocalSchedule(){
  struct tm timeinfo;
  if(getLocalTime(&timeinfo)){
    if (timeinfo.tm_min == lastTriggeredMinute) return;

    char timeStr[6];
    sprintf(timeStr, "%02d:%02d", timeinfo.tm_hour, timeinfo.tm_min);

    for(int s=0; s<4; s++) {
      for(int a=0; a < slots[s].alarmCount; a++) {
        if(slots[s].alarms[a].equals(timeStr) && activeAlarmSlot == -1) {
             Serial.println("!!! MATCH FOUND !!! Triggering Alarm...");
             triggerAlarm(s);
             lastTriggeredMinute = timeinfo.tm_min;
        }
      }
    }
  }
}

void checkButtons() {
    if (confirmationMode) {
        unsigned long elapsed = millis() - confirmationStartTime;
        if (elapsed > 30000) { // Timeout after 30s
            if (activeAlarmSlot != -1) resolveAlarm(true); // Default to taken/resolved on timeout? Or false?
            else completeTransaction(true);
            return;
        }

        if (digitalRead(BUTTON_YES_PIN) == LOW) {
            delay(250);
            if (activeAlarmSlot != -1) resolveAlarm(true);
            else completeTransaction(true);
        }
        else if (digitalRead(BUTTON_NO_PIN) == LOW) {
            delay(250);
            if (activeAlarmSlot != -1) resolveAlarm(false);
            else completeTransaction(false);
        }
        return;
    }

    // Stop alarm manually even if sensor wasn't touched?
    if (activeAlarmSlot != -1) {
        if (digitalRead(BUTTON_YES_PIN) == LOW) resolveAlarm(true);
        else if (digitalRead(BUTTON_NO_PIN) == LOW) resolveAlarm(false);
    }
}

void updateSensors() {
    if (confirmationMode) return;

    for (int i = 0; i < 4; i++) {
        if (digitalRead(SENSOR_PINS[i]) == LOW) {
            if (activeAlarmSlot == i) startConfirmation(i + 1);
            else if (activeAlarmSlot == -1) startConfirmation(i + 1);
            break;
        }
    }
}

void updateDisplay() {
    if (confirmationMode) return;

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

    lcd.setCursor(0, 0);
    lcd.print("MedSync         ");
    lcd.setCursor(0, 1);
    if (WiFi.status() != WL_CONNECTED) {
        lcd.print("No WiFi Connect ");
        return;
    }
    struct tm timeinfo;
    if (getLocalTime(&timeinfo, 500)) {
        lcd.printf("%02d:%02d", timeinfo.tm_hour, timeinfo.tm_min);
        lcd.print(" WiFi:OK ");
    } else {
        lcd.print("NTP Error/Sync..");
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
        WiFi.disconnect();
        delay(100);
        WiFi.begin(ssid.c_str(), pass.c_str());
        lcd.clear(); lcd.print("New WiFi Set!");
      }
    }
};

class ScheduleCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String val = pCharacteristic->getValue().c_str();
      if (val.length() > 0) {
         Serial.println("BLE Schedule Recv: " + val);
         parseSchedule(val);
      }
    }
};

// ================= SETUP & LOOP =================

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  lcd.init(); lcd.backlight();
  pinMode(BUTTON_YES_PIN, INPUT_PULLUP);
  pinMode(BUTTON_NO_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);

  for(int i=0; i<4; i++){
    if(SENSOR_PINS[i]>=34 && SENSOR_PINS[i]<=39) pinMode(SENSOR_PINS[i], INPUT);
    else pinMode(SENSOR_PINS[i], INPUT_PULLUP);
    pinMode(LED_PINS[i], OUTPUT); digitalWrite(LED_PINS[i], LOW);
  }

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

  savedSSID = "AJ Lomocso";
  savedPass = "piyang2004";
  lcd.setCursor(0, 0); lcd.print("WiFi Connecting...");

  WiFi.mode(WIFI_STA);
  WiFi.disconnect(); delay(100);
  WiFi.begin(savedSSID.c_str(), savedPass.c_str());

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500); Serial.print("."); attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    lcd.setCursor(0, 1); lcd.print("Success!");
    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  } else {
    lcd.setCursor(0, 1); lcd.print("WiFi Failed!");
  }
}

void loop(){
  while (gpsSerial.available() > 0) gps.encode(gpsSerial.read());

  // 1. Sync Schedule Every 60s
  if (millis() - lastSyncTime > 60000 || lastSyncTime == 0) {
    if(wifiConnected) {
        syncSchedule();
        lastSyncTime = millis();
    }
  }

  // 2. Buzzer Logic
  if (activeAlarmSlot != -1 && !confirmationMode) {
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
  updateDisplay();
  delay(50);
}