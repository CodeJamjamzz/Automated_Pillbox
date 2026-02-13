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

// ==========================================
//          MASTER PIN DEFINITIONS
// ==========================================

#define LCD_SDA_PIN  21
#define LCD_SCL_PIN  22
#define GPS_RX_PIN   16
#define GPS_TX_PIN   17
#define SIM_RX_PIN   26
#define SIM_TX_PIN   27
#define BUTTON_YES_PIN 4
#define BUTTON_NO_PIN  5
#define BUZZER_PIN     18
#define IR_PIN_1     34
#define IR_PIN_2     35
#define IR_PIN_3     13
#define IR_PIN_4     23
#define LED_PIN_1    32
#define LED_PIN_2    15
#define LED_PIN_3    25
#define LED_PIN_4    19

// ==========================================
//               GLOBAL OBJECTS
// ==========================================

String SERVER_URL = "http://192.168.1.5:8080/api/pillbox/update"; // CHECK YOUR IP

// BLE UUIDs
#define SERVICE_UUID           "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHAR_SENSOR_UUID       "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHAR_GPS_UUID          "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHAR_WIFI_CONFIG_UUID  "6E400004-B5A3-F393-E0A9-E50E24DCCA9E"

LiquidCrystal_I2C lcd(0x27, 16, 2);

const int SENSOR_PINS[4] = {IR_PIN_1, IR_PIN_2, IR_PIN_3, IR_PIN_4};
const int LED_PINS[4]    = {LED_PIN_1, LED_PIN_2, LED_PIN_3, LED_PIN_4};

TinyGPSPlus gps;
HardwareSerial GPS_Serial(2);
HardwareSerial SIM_Serial(1);
const int GPSBaud = 9600;

// --- GLOBAL VARIABLES ---
Preferences preferences;
BLEServer* pServer = NULL;

// 1. GLOBALS FOR WIFI CREDENTIALS (Moved to top)
String savedSSID = "";
String savedPass = "";

BLECharacteristic* pSensorChar = NULL;
BLECharacteristic* pGpsChar    = NULL;

bool deviceConnected = false;
bool wifiConnected = false;

// 2. CHANGED: Replaced 'shouldReboot' with 'shouldConnect'
bool shouldConnect = false;

unsigned long lastSendTime = 0;
const int SEND_INTERVAL = 2000;
unsigned long lastDisplayTime = 0;
const int DISPLAY_INTERVAL = 100;
unsigned long bleConnectTime = 0;
unsigned long lastWifiRetry = 0; // For background reconnection

int lockedSensorID = 0;
int lastTriggeredSensor = 0;
bool alarmActive = false;
bool confirmationSent = false;

// --- BLE CALLBACKS ---
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      bleConnectTime = millis();
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      BLEDevice::startAdvertising();
    }
};

class WifiCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      // 1. Get raw value from BLE
      String value = pCharacteristic->getValue();

      if (value.length() > 0) {
        String data = value;

        // --- DEBUGGING: Print EXACTLY what is received ---
        Serial.println("\n========== [BLE DATA RECEIVED] ==========");
        Serial.print("Raw String: \"");
        Serial.print(data);
        Serial.println("\"");

        // Print HEX values to check for hidden characters
        // Period (.) is 2E. Comma (,) is 2C.
        Serial.print("Hex Dump:   ");
        for(int i=0; i<data.length(); i++) {
            Serial.printf("%02X ", (uint8_t)data[i]);
        }
        Serial.println();
        // --------------------------------------------------

        // 2. Parse Logic
        // We look for the FIRST comma.
        // NOTE: If your SSID contains a comma (e.g., "My,Wifi"), this will fail.
        int commaIndex = data.indexOf(',');

        if (commaIndex > 0) {
          // Split the string
          String ssid = data.substring(0, commaIndex);
          String pass = data.substring(commaIndex + 1); // +1 skips the comma itself

          // 3. Clean up
          // trim() removes Spaces (0x20), Newlines (0x0A/0x0D), Tabs (0x09)
          // It DOES NOT remove periods (0x2E) or other punctuation.
          ssid.trim();
          pass.trim();

          Serial.println("--- [PARSED CREDENTIALS] ---");
          Serial.print("SSID: \""); Serial.print(ssid); Serial.println("\"");
          Serial.print("PASS: \""); Serial.print(pass); Serial.println("\"");

          // 4. Save & Trigger Connect
          if (ssid != savedSSID || pass != savedPass) {
             Serial.println(">>> New credentials detected. Saving...");
             savedSSID = ssid;
             savedPass = pass;

             preferences.begin("wifi_conf", false);
             preferences.putString("ssid", ssid);
             preferences.putString("pass", pass);
             preferences.end();

             shouldConnect = true;
          } else {
             Serial.println(">>> Credentials identical to saved. Ignoring.");
          }
        }
        else {
           Serial.println("ERROR: Separator ',' not found. Format must be 'SSID,PASS'");
        }
        Serial.println("=========================================\n");
      }
    }
};

void setup() {
  Serial.begin(115200);

  GPS_Serial.begin(GPSBaud, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  SIM_Serial.begin(9600, SERIAL_8N1, SIM_RX_PIN, SIM_TX_PIN);

  Wire.begin(LCD_SDA_PIN, LCD_SCL_PIN);
  lcd.init();
  lcd.backlight();

  for (int i = 0; i < 4; i++) {
    pinMode(SENSOR_PINS[i], INPUT);
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
  }

  pinMode(BUTTON_YES_PIN, INPUT_PULLUP);
  pinMode(BUTTON_NO_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(BUZZER_PIN, HIGH); delay(100); digitalWrite(BUZZER_PIN, LOW);

  // --- BLE SETUP ---
  BLEDevice::init("MedBox Device");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  BLECharacteristic *pWifiChar = pService->createCharacteristic(
                                   CHAR_WIFI_CONFIG_UUID,
                                   BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
                                 );
  pWifiChar->setCallbacks(new WifiCallbacks());

  pSensorChar = pService->createCharacteristic(
                                     CHAR_SENSOR_UUID,
                                     BLECharacteristic::PROPERTY_NOTIFY
                                   );
  pSensorChar->addDescriptor(new BLE2902());

  pGpsChar = pService->createCharacteristic(
                                  CHAR_GPS_UUID,
                                  BLECharacteristic::PROPERTY_NOTIFY
                                );
  pGpsChar->addDescriptor(new BLE2902());

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  BLEDevice::startAdvertising();

  // --- WIFI SETUP ---
  preferences.begin("wifi_conf", true);
  savedSSID = preferences.getString("ssid", ""); // Load into global
  savedPass = preferences.getString("pass", ""); // Load into global
  preferences.end();

  if(savedSSID != "") {
    lcd.setCursor(0, 0); lcd.print("Connecting...");
    WiFi.begin(savedSSID.c_str(), savedPass.c_str());

    // Quick blocking check on startup (optional, good for user feedback)
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) { // 10 seconds wait
        delay(500);
        attempts++;
        Serial.print(".");
    }

    if(WiFi.status() == WL_CONNECTED) {
      wifiConnected = true;
      lcd.clear(); lcd.print("Online!"); delay(1000);
    }
  }
  lcd.clear();
}

void loop() {
  while (GPS_Serial.available() > 0) gps.encode(GPS_Serial.read());

  updateSensorLock();
  updateLEDs();
  checkButtons();
  notifyAppOfSensors();

  // 4. HANDLING NEW CREDENTIALS WITHOUT REBOOT
  if (shouldConnect) {
     shouldConnect = false; // Reset flag

     lcd.clear();
     lcd.setCursor(0, 0);
     lcd.print("New WiFi...");

     // Disconnect previous and start new
     WiFi.disconnect(true);
     delay(500);
     WiFi.mode(WIFI_STA);    // Ensure Station mode
     WiFi.begin(savedSSID.c_str(), savedPass.c_str());

     lastWifiRetry = millis(); // Reset retry timer so background logic waits
     Serial.println("Attempting connection to new WiFi: " + savedSSID);
  }

  if (alarmActive) {
    digitalWrite(BUZZER_PIN, HIGH);
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }

  if (millis() - lastDisplayTime > DISPLAY_INTERVAL) {
    lastDisplayTime = millis();
    displayStatus();
  }

  // 5. BACKGROUND RECONNECTION LOGIC
  if (wifiConnected && (millis() - lastSendTime > SEND_INTERVAL)) {
    lastSendTime = millis();
    sendDataToServer();
  }

  // Check if WiFi dropped, try to reconnect every 10s
  if (WiFi.status() != WL_CONNECTED) {
     wifiConnected = false;
     if (millis() - lastWifiRetry > 10000 && savedSSID != "") {
        Serial.println("WiFi lost. Reconnecting...");
        WiFi.disconnect();
        WiFi.begin(savedSSID.c_str(), savedPass.c_str());
        lastWifiRetry = millis();
     }
  } else {
     wifiConnected = true;
  }
}

// ... (Rest of functions: notifyAppOfSensors, checkButtons, updateSensorLock, updateLEDs, displayStatus, sendDataToServer remain EXACTLY the same) ...

void notifyAppOfSensors() {
  if (!deviceConnected) return;
  int currentActiveSensor = 0;
  for (int i = 0; i < 4; i++) {
    if (!digitalRead(SENSOR_PINS[i])) {
       currentActiveSensor = i + 1;
       break;
    }
  }
  if (currentActiveSensor != lastTriggeredSensor) {
    lastTriggeredSensor = currentActiveSensor;
    String message = String(currentActiveSensor);
    pSensorChar->setValue(message.c_str());
    pSensorChar->notify();
    Serial.println("Sent Sensor Update: " + message);
  }
}

void checkButtons() {
  if (alarmActive) {
    if (digitalRead(BUTTON_YES_PIN) == LOW) {
      alarmActive = false;
      confirmationSent = true;
      lcd.clear(); lcd.print("   CONFIRMED!   ");
      delay(1000);
    }
    if (digitalRead(BUTTON_NO_PIN) == LOW) {
      alarmActive = false;
      confirmationSent = false;
      lcd.clear(); lcd.print("    SKIPPED     ");
      delay(1000);
    }
  }
}

void updateSensorLock() {
  if (lockedSensorID > 0) {
    bool stillActive = !digitalRead(SENSOR_PINS[lockedSensorID - 1]);
    if (!stillActive) {
      lockedSensorID = 0;
    }
  } else {
    for (int i = 0; i < 4; i++) {
      if (!digitalRead(SENSOR_PINS[i])) {
        lockedSensorID = i + 1;
        break;
      }
    }
  }
}

void updateLEDs() {
  for(int i=0; i<4; i++) {
    if (lockedSensorID == (i + 1)) {
       digitalWrite(LED_PINS[i], HIGH);
    } else {
       digitalWrite(LED_PINS[i], LOW);
    }
  }
}

void displayStatus() {
  if (deviceConnected && (millis() - bleConnectTime < 3000)) {
    lcd.setCursor(0, 0); lcd.print("Device          ");
    lcd.setCursor(0, 1); lcd.print("Connected!      ");
    return;
  }

  if (alarmActive) {
    lcd.setCursor(0, 0); lcd.print("Taken Pills?    ");
    lcd.setCursor(0, 1); lcd.print("NO[<]      [>]YES");
    return;
  }

  lcd.setCursor(0, 0);
  if (lockedSensorID == 0) {
    lcd.print("Ready...        ");
  } else {
    lcd.setCursor(0,0);
    lcd.print("Taking Slot ");
    lcd.print(lockedSensorID);
    lcd.print("   ");
  }

  lcd.setCursor(0, 1);
  if (shouldConnect) {
     lcd.print("Connecting...   ");
  } else {
     lcd.print(wifiConnected ? "WiFi: ON        " : "WiFi: OFF       ");
  }
}

void sendDataToServer() {
  if (WiFi.status() != WL_CONNECTED) return;

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
  jsonPayload += "\"gpsCoordinates\": \"" + gpsData + "\",";
  jsonPayload += "\"confirmation\": " + String(confirmationSent ? "true" : "false");
  jsonPayload += "}";

  confirmationSent = false;

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.POST(jsonPayload);

  if(httpCode > 0) {
      String response = http.getString();
      if ((response.indexOf("\"alarm\":true") > 0 || response.indexOf("\"alarm\": true") > 0)) {
        if (!alarmActive) {
           alarmActive = true;
        }
      }
  }
  http.end();
}