#include "HX711.h"
#include <ESP32Servo.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>

#define WIFI_SSID         "KONEK."
#define WIFI_PASSWORD     "1234567890"
#define FIREBASE_API_KEY  "AIzaSyCD0HR0qKk5BDbT1xD8OGSn06Y_80MP3ZI"
#define FIREBASE_DB_URL   "https://plastictorice-default-rtdb.firebaseio.com"
#define BIN_ID            "bin_001"

#define SERVO_PIN 13
Servo pusherServo;
const int SERVO_REST = 90;
const int SERVO_PUSH = 180;

#define RICE_SERVO_PIN 14
Servo riceServo;
const int RICE_OPEN = 8;
const int RICE_CLOSE = 38;

#define LOADCELL_DOUT_PIN 4
#define LOADCELL_SCK_PIN  5
HX711 scale;

float calibration_factor = -540.0;
const float MIN_BOTTLE_WEIGHT = 5.20;
const float MAX_BOTTLE_WEIGHT = 32.00;
const float DEADZONE = 0.07;
const int NUM_SAMPLES = 10;
const int SETTLE_SAMPLES = 8;
const float SETTLE_TOLERANCE = 0.50;
const unsigned long SETTLE_TIMEOUT_MS = 6000;
const unsigned long SESSION_TIMEOUT_MS = 60000;

String idToken = "";
uint32_t tokenExpiry = 0;

void connectWiFi()
{
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nWiFi connected - IP: %s\n", WiFi.localIP().toString().c_str());
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    Serial.print("Syncing NTP");
    while (time(nullptr) < 100000UL) {
      delay(500);
      Serial.print(".");
    }
    Serial.println(" OK");
  } else {
    Serial.println("\nWiFi failed - will retry.");
  }
}

bool refreshToken()
{
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=";
  url += FIREBASE_API_KEY;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST("{\"returnSecureToken\":true}");
  if (code != 200) {
    Serial.printf("Auth failed (HTTP %d)\n", code);
    http.end();
    return false;
  }

  DynamicJsonDocument doc(2048);
  deserializeJson(doc, http.getString());
  http.end();
  idToken = doc["idToken"].as<String>();
  uint32_t expiresIn = doc["expiresIn"] | 3600;
  tokenExpiry = millis() + (expiresIn - 60) * 1000UL;
  Serial.println("Firebase token refreshed.");
  return idToken.length() > 0;
}

bool ensureToken()
{
  if (WiFi.status() != WL_CONNECTED) return false;
  if (idToken.isEmpty() || millis() > tokenExpiry) return refreshToken();
  return true;
}

int rtdbGet(const String& path, String& payload)
{
  if (!ensureToken()) return -1;
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, String(FIREBASE_DB_URL) + path + ".json?auth=" + idToken);
  int code = http.GET();
  if (code == 200) payload = http.getString();
  http.end();
  return code;
}

int rtdbPatch(const String& path, const String& body)
{
  if (!ensureToken()) return -1;
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, String(FIREBASE_DB_URL) + path + ".json?auth=" + idToken);
  http.addHeader("Content-Type", "application/json");
  int code = http.sendRequest("PATCH", body);
  http.end();
  return code;
}

int rtdbPost(const String& path, const String& body)
{
  if (!ensureToken()) return -1;
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, String(FIREBASE_DB_URL) + path + ".json?auth=" + idToken);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  http.end();
  return code;
}

struct BinCommand {
  String status;
  String userId;
  String userName;
};

String currentIsoTimestamp()
{
  time_t now_t = time(nullptr);
  char ts[30];
  strftime(ts, sizeof(ts), "%Y-%m-%dT%H:%M:%SZ", gmtime(&now_t));
  return String(ts);
}

BinCommand checkBinCommand()
{
  BinCommand cmd = {"idle", "", ""};
  String payload;
  if (rtdbGet("/bin_commands/" BIN_ID, payload) != 200) return cmd;
  if (payload == "null") return cmd;

  DynamicJsonDocument doc(1024);
  if (deserializeJson(doc, payload)) return cmd;
  cmd.status = doc["status"] | "idle";
  cmd.userId = doc["userId"] | "";
  cmd.userName = doc["userName"] | "";
  return cmd;
}

bool patchBinCommand(const char* status,
                     float lastWeightKg = -1.0f,
                     int acceptedCount = -1,
                     const String& lastAcceptedAt = "",
                     const String& lastValidationStatus = "",
                     const String& lastValidationMessage = "",
                     const String& lastValidationAt = "")
{
  StaticJsonDocument<384> body;
  body["status"] = status;
  if (lastWeightKg >= 0.0f) {
    body["weightKg"] = lastWeightKg;
    body["lastWeightKg"] = lastWeightKg;
  }
  if (acceptedCount >= 0) body["acceptedCount"] = acceptedCount;
  if (lastAcceptedAt.length() > 0) body["lastAcceptedAt"] = lastAcceptedAt;
  if (lastValidationStatus.length() > 0) body["lastValidationStatus"] = lastValidationStatus;
  if (lastValidationMessage.length() > 0) body["lastValidationMessage"] = lastValidationMessage;
  if (lastValidationAt.length() > 0) body["lastValidationAt"] = lastValidationAt;

  String s;
  serializeJson(body, s);
  int code = rtdbPatch("/bin_commands/" BIN_ID, s);
  Serial.printf("  bin_commands -> \"%s\" (HTTP %d)\n", status, code);
  return code == 200;
}

struct RiceCommand {
  String status;
  String userId;
  float amountKg;
};

RiceCommand checkRiceCommand()
{
  RiceCommand cmd = {"idle", "", 0.0f};
  String payload;
  if (rtdbGet("/rice_commands/" BIN_ID, payload) != 200) return cmd;
  if (payload == "null") return cmd;

  DynamicJsonDocument doc(1024);
  if (deserializeJson(doc, payload)) return cmd;
  cmd.status = doc["status"] | "idle";
  cmd.userId = doc["userId"] | "";
  cmd.amountKg = doc["amountKg"] | 0.0f;
  return cmd;
}

bool patchRiceCommand(const char* status)
{
  StaticJsonDocument<64> body;
  body["status"] = status;
  String s;
  serializeJson(body, s);
  int code = rtdbPatch("/rice_commands/" BIN_ID, s);
  Serial.printf("  rice_commands -> \"%s\" (HTTP %d)\n", status, code);
  return code == 200;
}

void sendBinEvent(float weightG, const String& userId, const String& userName)
{
  StaticJsonDocument<320> body;
  body["binId"] = BIN_ID;
  body["userId"] = userId;
  body["userName"] = userName;
  body["weightG"] = weightG;
  body["weightKg"] = weightG / 1000.0f;
  body["timestamp"] = currentIsoTimestamp();
  body["processed"] = false;

  String s;
  serializeJson(body, s);
  int code = rtdbPost("/bin_events", s);
  Serial.printf("  bin_events posted %.2f g for %s (HTTP %d)\n",
                weightG, userName.c_str(), code);
}

float quickRead()
{
  if (!scale.is_ready()) return -1.0f;
  float w = scale.get_units();
  return (w < DEADZONE) ? 0.0f : w;
}

float getAverageWeight()
{
  float sum = 0.0f;
  int count = 0;
  for (int i = 0; i < NUM_SAMPLES; i++) {
    if (scale.is_ready()) {
      sum += scale.get_units();
      count++;
    }
    delay(20);
  }
  float avg = (count > 0) ? sum / count : 0.0f;
  return (avg < DEADZONE) ? 0.0f : avg;
}

float waitForSettle()
{
  float buf[SETTLE_SAMPLES] = {};
  int filled = 0;
  unsigned long start = millis();

  while (millis() - start < SETTLE_TIMEOUT_MS) {
    float w = quickRead();
    if (w < 0) {
      delay(20);
      continue;
    }

    buf[filled % SETTLE_SAMPLES] = w;
    filled++;
    if (filled >= SETTLE_SAMPLES) {
      float ref = buf[(filled - 1) % SETTLE_SAMPLES];
      bool stable = true;
      for (int i = 0; i < SETTLE_SAMPLES; i++) {
        if (fabs(buf[i] - ref) > SETTLE_TOLERANCE) {
          stable = false;
          break;
        }
      }
      if (stable) {
        Serial.println("  Scale settled.");
        return getAverageWeight();
      }
    }
    delay(50);
  }

  Serial.println("  Scale settle timeout.");
  return 0.0f;
}

void pushBottle()
{
  Serial.println("  Pushing bottle in...");
  pusherServo.write(SERVO_PUSH);
  delay(600);
  pusherServo.write(135);
  delay(500);
  pusherServo.write(SERVO_REST);
  Serial.println("  Pusher returned to rest.");
}

unsigned long getDispenseDurationMs(float amountKg)
{
  if (amountKg >= 0.99f) return 20000UL;
  return 10000UL;
}

void dispenseRice(float amountKg)
{
  unsigned long dispenseMs = getDispenseDurationMs(amountKg);
  Serial.println("  Rice gate: OPENING");
  riceServo.write(RICE_OPEN);
  delay(dispenseMs);
  riceServo.write(RICE_CLOSE);
  Serial.println("  Rice gate: CLOSED");
}

void setup()
{
  Serial.begin(115200);

  pusherServo.attach(SERVO_PIN);
  pusherServo.write(SERVO_REST);

  riceServo.attach(RICE_SERVO_PIN);
  riceServo.write(RICE_CLOSE);

  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  scale.set_scale(calibration_factor);
  Serial.println("Taring scale...");
  scale.tare();
  Serial.println("Tare complete.");

  connectWiFi();
  Serial.printf("\nBin ID: %s - Ready to accept bottles.\n\n", BIN_ID);
}

void loop()
{
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost - reconnecting...");
    connectWiFi();
    delay(1000);
    return;
  }

  BinCommand binCmd = checkBinCommand();

  if (binCmd.status == "waiting") {
    Serial.printf("[BOTTLE] Command from '%s' - activating bin.\n",
                  binCmd.userName.c_str());

    patchBinCommand("active", 0.0f, 0, "", "ready", "Bin active and ready.", currentIsoTimestamp());
    scale.tare();
    Serial.printf("  Waiting up to %lu s for bottles...\n",
                  SESSION_TIMEOUT_MS / 1000);

    unsigned long deadline = millis() + SESSION_TIMEOUT_MS;
    unsigned long nextStatusPoll = 0;
    int acceptedCount = 0;
    bool cancelled = false;
    bool awaitingRemoval = false;

    while (millis() < deadline) {
      if (millis() >= nextStatusPoll) {
        BinCommand liveCmd = checkBinCommand();
        if (liveCmd.status != "active" && liveCmd.status != "waiting") {
          cancelled = true;
          break;
        }
        nextStatusPoll = millis() + 1000;
      }

      float raw = quickRead();
      if (awaitingRemoval) {
        if (raw < DEADZONE) {
          awaitingRemoval = false;
        }
        delay(200);
        continue;
      }

      if (raw >= MIN_BOTTLE_WEIGHT) {
        float weight = waitForSettle();
        if (weight >= MIN_BOTTLE_WEIGHT && weight <= MAX_BOTTLE_WEIGHT) {
          float weightKg = weight / 1000.0f;
          String acceptedAt = currentIsoTimestamp();
          Serial.printf("[BOTTLE] Accepted: %.2f g (%.4f kg) - pushing.\n",
                        weight, weightKg);

          pushBottle();
          acceptedCount++;

          patchBinCommand("active", weightKg, acceptedCount, acceptedAt, "accepted", "Bottle accepted.", acceptedAt);
          sendBinEvent(weight, binCmd.userId, binCmd.userName);

          deadline = millis() + SESSION_TIMEOUT_MS;
          scale.tare();
          delay(900);
        } else if (weight > 0.0f) {
          String rejectedAt = currentIsoTimestamp();
          String reason = "Bottle not accepted. Weight must be between ";
          reason += String(MIN_BOTTLE_WEIGHT, 2);
          reason += " g and ";
          reason += String(MAX_BOTTLE_WEIGHT, 2);
          reason += " g.";
          Serial.printf("[BOTTLE] Rejected: %.2f g - outside allowed range.\n", weight);
          patchBinCommand("active", -1.0f, acceptedCount, "", "rejected", reason, rejectedAt);
          awaitingRemoval = true;
        }
      }

      delay(200);
    }

    if (cancelled) {
      Serial.println("[BOTTLE] Session closed by user.\n");
    } else {
      patchBinCommand("expired");
      Serial.println("[BOTTLE] Session expired - no bottle received before timeout.\n");
    }
    return;
  }

  RiceCommand riceCmd = checkRiceCommand();

  if (riceCmd.status == "dispensing") {
    Serial.printf("[RICE] Dispensing %.3f kg for user '%s'\n",
                  riceCmd.amountKg, riceCmd.userId.c_str());

    dispenseRice(riceCmd.amountKg);
    patchRiceCommand("done");

    Serial.println("[RICE] Dispensing complete.\n");
    delay(1000);
    return;
  }

  delay(5000);
}
