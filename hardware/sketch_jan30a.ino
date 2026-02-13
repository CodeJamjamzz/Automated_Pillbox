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

// --- CONSTANTS ---
String SERVER_URL = "http://192.168.1.5:8080/api/pillbox"; // CHECK YOUR IP

// BLE UUIDs
#define SERVICE_UUID           "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHAR_WIFI_CONFIG_UUID  "6E400004-B5A3-F393-E0A9-E50E24DCCA9E"

// --- HARDWARE PINS ---
LiquidCrystal_I2C lcd(0x27, 16, 2);
const int SENSOR_PINS[4] = {14, 27, 26, 25};

// GPS
TinyGPSPlus gps;
HardwareSerial GPS_Serial(2);
const int RXPin = 16;
const int TXPin = 17;
const int GPSBaud = 9600;

// --- GLOBAL VARIABLES ---
Preferences preferences;
BLEServer* pServer = NULL;
bool deviceConnected = false;
bool wifiConnected = false;

// Timers
unsigned long lastSendTime = 0;
const int SEND_INTERVAL = 2000;
unsigned long lastDisplayTime = 0;
const int DISPLAY_INTERVAL = 200; // Faster display update for responsiveness

// --- LOCKING STATE ---
// 0 = No sensor active
// 1 = Sensor 1 locked
// 2 = Sensor 2 locked, etc.
int lockedSensorID = 0;

// --- BLE CALLBACKS ---
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) { deviceConnected = true; };
    void onDisconnect(BLEServer* pServer) { deviceConnected = false; BLEDevice::startAdvertising(); }
};

class WifiCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String value = pCharacteristic->getValue();
      if (value.length() > 0) {
        String data = value;
        int commaIndex = data.indexOf(',');
        if (commaIndex > 0) {
          String ssid = data.substring(0, commaIndex);
          String pass = data.substring(commaIndex + 1);
          preferences.begin("wifi_conf", false);
          preferences.putString("ssid", ssid);
          preferences.putString("pass", pass);
          preferences.end();
          lcd.clear(); lcd.setCursor(0, 0); lcd.print("Creds Saved!");
          delay(2000); ESP.restart();
        }
      }
    }
};

void setup() {
  Serial.begin(115200);

  // 1. Init Hardware
  Wire.begin();
  lcd.init();
  lcd.backlight();
  for (int i = 0; i < 4; i++) pinMode(SENSOR_PINS[i], INPUT);
  GPS_Serial.begin(GPSBaud, SERIAL_8N1, RXPin, TXPin);

  // 2. Init BLE
  BLEDevice::init("MedBox Device");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  BLECharacteristic *pWifiChar = pService->createCharacteristic(CHAR_WIFI_CONFIG_UUID, BLECharacteristic::PROPERTY_WRITE);
  pWifiChar->setCallbacks(new WifiCallbacks());
  pService->start();
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  BLEDevice::startAdvertising();

  // 3. Connect Wi-Fi
  preferences.begin("wifi_conf", true);
  String savedSSID = preferences.getString("ssid", "");
  String savedPass = preferences.getString("pass", "");
  preferences.end();

  if(savedSSID != "") {
    lcd.setCursor(0, 0); lcd.print("Connecting...");
    WiFi.begin(savedSSID.c_str(), savedPass.c_str());
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 10) { delay(500); attempts++; }
    if(WiFi.status() == WL_CONNECTED) {
      wifiConnected = true;
      lcd.clear(); lcd.print("Online!"); delay(1000);
    }
  }
  lcd.clear();
}

void loop() {
  // 1. GPS Read
  while (GPS_Serial.available() > 0) gps.encode(GPS_Serial.read());

  // 2. CRITICAL: Update Locking Logic
  updateSensorLock();

  // 3. Local Display (Runs fast)
  if (millis() - lastDisplayTime > DISPLAY_INTERVAL) {
    lastDisplayTime = millis();
    displayStatus();
  }

  // 4. Server Sync (Runs slower)
  if (wifiConnected && (millis() - lastSendTime > SEND_INTERVAL)) {
    lastSendTime = millis();
    sendDataToServer();
  }
}

// --- CORE LOGIC: FIRST-COME-FIRST-SERVED ---
void updateSensorLock() {
  // 1. Check if we are currently locked onto a sensor
  if (lockedSensorID > 0) {
    // Check if the LOCKED sensor is still active (Pin index is ID - 1)
    // Assuming active LOW (0 = Object detected)
    bool stillActive = !digitalRead(SENSOR_PINS[lockedSensorID - 1]);

    if (!stillActive) {
      // Release lock if object removed
      lockedSensorID = 0;
    }
    // If stillActive is true, WE DO NOTHING.
    // We ignore all other sensors until this one is released.

  } else {
    // 2. No sensor locked, scan for new triggers
    for (int i = 0; i < 4; i++) {
      if (!digitalRead(SENSOR_PINS[i])) { // If sensor i is active
        lockedSensorID = i + 1; // Lock it (ID is 1-4)
        break; // Stop checking others! Priority established.
      }
    }
  }
}

void displayStatus() {
  lcd.setCursor(0, 0);

  if (lockedSensorID == 0) {
    lcd.print("Ready...        ");
  } else {
    // Show only the locked sensor
    lcd.printf("ACTIVE: Slot %d  ", lockedSensorID);
  }

  lcd.setCursor(0, 1);
  lcd.print(wifiConnected ? "WiFi: ON " : "WiFi: OFF");
}

void sendDataToServer() {
  if (WiFi.status() != WL_CONNECTED) { WiFi.reconnect(); return; }

  // Construct data based ONLY on the locked ID
  bool s1 = (lockedSensorID == 1);
  bool s2 = (lockedSensorID == 2);
  bool s3 = (lockedSensorID == 3);
  bool s4 = (lockedSensorID == 4);

  String gpsData = "0.0,0.0";
  if (gps.location.isValid()) {
    gpsData = String(gps.location.lat(), 6) + "," + String(gps.location.lng(), 6);
  }

  String jsonPayload = "{";
  jsonPayload += "\"sensor1\": " + String(s1 ? "true" : "false") + ",";
  jsonPayload += "\"sensor2\": " + String(s2 ? "true" : "false") + ",";
  jsonPayload += "\"sensor3\": " + String(s3 ? "true" : "false") + ",";
  jsonPayload += "\"sensor4\": " + String(s4 ? "true" : "false") + ",";
  jsonPayload += "\"gpsCoordinates\": \"" + gpsData + "\"";
  jsonPayload += "}";

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  int httpCode = http.POST(jsonPayload);
  http.end();

  if(httpCode > 0) Serial.printf("Sent: Active Slot %d\n", lockedSensorID);
  else Serial.println("Send Error");
}