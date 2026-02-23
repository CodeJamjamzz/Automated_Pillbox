#include <WiFi.h>
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

// --- FIREBASE LIBRARIES ---
#include <FirebaseESP32.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>

// ================= FIREBASE CONFIG =================
#define FIREBASE_HOST "https://medsync-baef3-default-rtdb.asia-southeast1.firebasedatabase.app/" 
#define FIREBASE_AUTH "lr84SFxTok60vG5Y1mtYXOSCPauOgeOzydvl5DOh" 
#define DEVICE_ID "pillbox_001" 

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
HardwareSerial gpsSerial(1); 

// Firebase Objects
FirebaseData fbData;
FirebaseConfig fbConfig;
FirebaseAuth fbAuth;
bool firebaseReady = false;

// State Variables
bool confirmationMode = false;
unsigned long confirmationStartTime = 0;
int pendingSlotID = 0;
unsigned long lastBeepTime = 0;
bool buzzerState = false;
String savedSSID = "";
String savedPass = "";

// Time Settings
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 28800; // UTC+8
const int   daylightOffset_sec = 0;

// Unified Alarm Structure
struct Compartment {
  String alarms[MAX_ALARMS]; 
  int pillAmount = 0;
  int alarmCount = 0;
};
Compartment slots[4]; 

// Loop Timers
unsigned long lastSyncTime = 0;
int activeAlarmSlot = -1;
bool deviceConnected = false;
bool wifiConnected = false;
int lastTriggeredMinute = -1; 

// --- NEW THREAD-SAFE FLAG ---
bool newWifiReceived = false; 

// ================= FORWARD DECLARATIONS =================
void startConfirmation(int slotID);
void resolveAlarm(bool taken);
void completeTransaction(bool taken);
void logToFirebase(int triggeredSlot, String action);
void updateCloudPillCount(int slotIndex);
void setupWiFiAndFirebase(); // NEW

// ================= HELPER FUNCTIONS =================

String decodeBase64(String input) {
  unsigned char output[128];
  size_t olen = 0;
  mbedtls_base64_decode(output, 128, &olen, (const unsigned char*)input.c_str(), input.length());
  return String((char*)output).substring(0, olen);
}

// ================= FIREBASE SYNC FUNCTIONS =================

void syncFromFirebase() {
  if (!firebaseReady) return;

  Serial.println("--- Syncing with Firebase ---");

  for (int i = 0; i < 4; i++) {
    String path = "/" + String(DEVICE_ID) + "/slots/" + String(i + 1);

    if (Firebase.getInt(fbData, path + "/amount")) {
      slots[i].pillAmount = fbData.intData();
    }

    if (Firebase.getString(fbData, path + "/times")) {
      String times = fbData.stringData();
      
      int tStart = 0;
      int count = 0;
      while (tStart < times.length() && count < MAX_ALARMS) {
          int tEnd = times.indexOf(',', tStart);
          if (tEnd == -1) tEnd = times.length();
          slots[i].alarms[count] = times.substring(tStart, tEnd);
          count++;
          tStart = tEnd + 1;
      }
      slots[i].alarmCount = count;
    }
  }
}

void logToFirebase(int triggeredSlot, String action) {
  if (!firebaseReady) return;

  int currentCount = 0;
  String counterPath = "/" + String(DEVICE_ID) + "/log_counter";
  if (Firebase.getInt(fbData, counterPath)) {
    currentCount = fbData.intData();
  }
  
  int newCount = currentCount + 1;
  char logName[10];
  sprintf(logName, "log_%03d", newCount);
  
  FirebaseJson json;
  json.set("slot_id", triggeredSlot);
  json.set("action", action);
  json.set("timestamp", (double)time(NULL));

  String gpsCoords = "0.0,0.0";
  if (gps.location.isValid()) {
      gpsCoords = String(gps.location.lat(), 6) + "," + String(gps.location.lng(), 6);
  }
  json.set("gps", gpsCoords);

  FirebaseJson sensorsJson;
  bool s1 = (digitalRead(SENSOR_PINS[0]) == LOW) || (triggeredSlot == 1);
  bool s2 = (digitalRead(SENSOR_PINS[1]) == LOW) || (triggeredSlot == 2);
  bool s3 = (digitalRead(SENSOR_PINS[2]) == LOW) || (triggeredSlot == 3);
  bool s4 = (digitalRead(SENSOR_PINS[3]) == LOW) || (triggeredSlot == 4);

  sensorsJson.set("s1", s1);
  sensorsJson.set("s2", s2);
  sensorsJson.set("s3", s3);
  sensorsJson.set("s4", s4);
  json.set("sensors", sensorsJson);

  String path = "/" + String(DEVICE_ID) + "/logs/" + String(logName);
  
  if (Firebase.setJSON(fbData, path, json)) {
      Serial.println("Log saved: " + String(logName));
      Firebase.setInt(fbData, counterPath, newCount);
  } else {
      Serial.println("Log failed: " + fbData.errorReason());
  }
}

void updateCloudPillCount(int slotIndex) {
  if (!firebaseReady) return;

  String path = "/" + String(DEVICE_ID) + "/slots/" + String(slotIndex + 1) + "/amount";
  if (Firebase.setInt(fbData, path, slots[slotIndex].pillAmount)) {
      Serial.println("Cloud pill count updated.");
  } else {
      Serial.println("Update failed: " + fbData.errorReason());
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

  if(taken) {
      lcd.print("   CONFIRMED!   ");
      if(slots[activeAlarmSlot].pillAmount > 0) {
          slots[activeAlarmSlot].pillAmount--;
          updateCloudPillCount(activeAlarmSlot);
      }
      lcd.setCursor(0, 1);
      lcd.print("Rem: " + String(slots[activeAlarmSlot].pillAmount));

      if(deviceConnected){
        pNotifyChar->setValue("RESULT:TAKEN");
        pNotifyChar->notify();
      }
      logToFirebase(activeAlarmSlot + 1, "TAKEN");

  } else {
      lcd.print("    SKIPPED     ");
      lcd.setCursor(0, 1);
      lcd.print("Rem: " + String(slots[activeAlarmSlot].pillAmount));
      logToFirebase(activeAlarmSlot + 1, "SKIPPED");
  }

  // --- NEW: CLEAR THE FLAG ---
  if (firebaseReady) {
      Firebase.setInt(fbData, "/" + String(DEVICE_ID) + "/active_sensor_slot", 0);
  }

  activeAlarmSlot = -1;
  confirmationMode = false; 
  pendingSlotID = 0;

  delay(2000); 
  lcd.clear(); 
}

void completeTransaction(bool taken) {
    lcd.clear();

    if (taken) {
        lcd.print("  Recorded: YES ");
        if (pendingSlotID > 0 && slots[pendingSlotID - 1].pillAmount > 0) {
             slots[pendingSlotID - 1].pillAmount--;
             updateCloudPillCount(pendingSlotID - 1);
        }
        logToFirebase(pendingSlotID, "MANUAL_TAKE");
    } else {
        lcd.print("  Recorded: NO  ");
        logToFirebase(pendingSlotID, "OPENED_NO_TAKE");
    }
    
    if (pendingSlotID > 0) {
       lcd.setCursor(0, 1);
       lcd.print("Rem: " + String(slots[pendingSlotID - 1].pillAmount)); 
    }

    // --- NEW: CLEAR THE FLAG ---
    if (firebaseReady) {
        Firebase.setInt(fbData, "/" + String(DEVICE_ID) + "/active_sensor_slot", 0);
    }

    delay(2000); 
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

    // --- NEW: TELL FIREBASE THE SENSOR WAS TRIPPED ---
    if (firebaseReady) {
        Firebase.setInt(fbData, "/" + String(DEVICE_ID) + "/active_sensor_slot", slotID);
    }
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
        if (elapsed > 30000) { 
            if (activeAlarmSlot != -1) resolveAlarm(true); 
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
    // --- UPDATED DISPLAY FOR NO WIFI ---
    if (WiFi.status() != WL_CONNECTED) {
        lcd.print("MedSync - Setup ");
        lcd.setCursor(0, 1); 
        lcd.print("Connect via App ");
        return;
    } else {
        lcd.print("MedSync         ");
    }

    lcd.setCursor(0, 1);
    struct tm timeinfo;
    if (getLocalTime(&timeinfo, 500)) { 
        lcd.printf("%02d:%02d", timeinfo.tm_hour, timeinfo.tm_min);
        lcd.print(" WiFi:OK ");
    } else {
        lcd.print("NTP Error/Sync..");
    }
}

// ================= CONNECTION HANDLER =================
// Centralized function to connect and fetch data
void setupWiFiAndFirebase() {
  lcd.clear();
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
    lcd.setCursor(0, 1); lcd.print("Success!        ");
    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

    // Initialize Firebase ONLY after WiFi connects
    if (!firebaseReady) {
        fbConfig.database_url = FIREBASE_HOST;
        fbConfig.signer.tokens.legacy_token = FIREBASE_AUTH;
        Firebase.begin(&fbConfig, &fbAuth);
        Firebase.reconnectWiFi(true);
        firebaseReady = true;
    }

    // Fetch the data immediately
    syncFromFirebase();
    lastSyncTime = millis();

  } else {
    wifiConnected = false;
    lcd.setCursor(0, 1); lcd.print("WiFi Failed!    ");
  }
}

// ================= BLE & WIFI CALLBACKS =================
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) { deviceConnected = true; };
    void onDisconnect(BLEServer* pServer) { deviceConnected = false; BLEDevice::startAdvertising(); }
};

class WifiCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String value = pCharacteristic->getValue();
      String rawData = String(value.c_str());
      if (rawData.length() == 0) return;

      int split = rawData.indexOf(':');
      if (split > 0) {
        String ssid = rawData.substring(0, split);
        String pass = rawData.substring(split + 1);
        
        preferences.begin("wifi_conf", false);
        preferences.putString("ssid", ssid);
        preferences.putString("pass", pass);
        preferences.end();
        
        savedSSID = ssid;
        savedPass = pass;
        
        // Signal the main loop to handle the heavy processing safely
        newWifiReceived = true; 
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

  // BLE INIT
  BLEDevice::init("MedSync");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pService->createCharacteristic(CHAR_WIFI_UUID, BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new WifiCallbacks());
  pService->createCharacteristic(CHAR_NOTIFY_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  pNotifyChar = pService->createCharacteristic(CHAR_NOTIFY_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  pNotifyChar->addDescriptor(new BLE2902());
  pService->start();
  BLEDevice::startAdvertising();

  // Load Saved WiFi
  preferences.begin("wifi_conf", true);
  savedSSID = preferences.getString("ssid", ""); // Default empty
  savedPass = preferences.getString("pass", "");
  preferences.end();

  // Initial Boot Connection Attempt
  if (savedSSID != "") {
      setupWiFiAndFirebase();
  }
}

void loop(){
  while (gpsSerial.available() > 0) gps.encode(gpsSerial.read());

  // 1. Check for New WiFi Credentials from BLE
  if (newWifiReceived) {
      newWifiReceived = false;
      setupWiFiAndFirebase();
  }

  // 2. Sync Schedule Every 60s
  if (millis() - lastSyncTime > 60000 || lastSyncTime == 0) {
    if(wifiConnected && firebaseReady) {
        syncFromFirebase();
        lastSyncTime = millis();
    }
  }

  // 3. Buzzer Logic
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