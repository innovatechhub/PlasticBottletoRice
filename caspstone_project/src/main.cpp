#include "HX711.h"
#include <ESP32Servo.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>

// ─────────────────────────── Credentials ─────────────────────────────────────
#define WIFI_SSID        "KONEK>"
#define WIFI_PASSWORD    "1234567890"

#define FIREBASE_API_KEY  "AIzaSyCD0HR0qKk5BDbT1xD8OGSn06Y_80MP3ZI"
#define FIREBASE_DB_URL   "https://plastictorice-default-rtdb.firebaseio.com"
#define BIN_ID            "bin_001"

// ─────────────────────────── Bottle-input servo ──────────────────────────────
#define SERVO_PIN   13
Servo pusherServo;
const int SERVO_REST = 90;
const int SERVO_PUSH = 180;

// ─────────────────────────── Rice-dispenser servo ────────────────────────────
#define RICE_SERVO_PIN  14
Servo riceServo;
const int RICE_OPEN  = 8;
const int RICE_CLOSE = 38;

// ─────────────────────────── HX711 ───────────────────────────────────────────
#define LOADCELL_DOUT_PIN 4
#define LOADCELL_SCK_PIN  5
HX711 scale;

// ─────────────────────────── Weight Config ───────────────────────────────────
float calibration_factor      = -540.0;
const float MIN_BOTTLE_WEIGHT = 5.20;
const float MAX_BOTTLE_WEIGHT = 32.00;
const float DEADZONE          = 0.07;
const int   NUM_SAMPLES       = 10;
const int   SETTLE_SAMPLES    = 8;
const float SETTLE_TOLERANCE  = 0.50;
const unsigned long SETTLE_TIMEOUT_MS  = 6000;
const unsigned long SESSION_TIMEOUT_MS = 60000;

// ─────────────────────────── Firebase token ──────────────────────────────────
String   idToken     = "";
uint32_t tokenExpiry = 0;

// ─────────────────────────── WiFi + NTP ──────────────────────────────────────
void connectWiFi()
{
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500); Serial.print("."); attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nWiFi connected — IP: %s\n", WiFi.localIP().toString().c_str());
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    Serial.print("Syncing NTP");
    while (time(nullptr) < 100000UL) { delay(500); Serial.print("."); }
    Serial.println(" OK");
  } else {
    Serial.println("\nWiFi failed.");
  }
}

// ─────────────────────────── Firebase anonymous auth ─────────────────────────
bool refreshToken()
{
  WiFiClientSecure client; client.setInsecure();
  HTTPClient http;
  String url = "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=";
  url += FIREBASE_API_KEY;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST("{\"returnSecureToken\":true}");
  if (code != 200) { Serial.printf("Auth failed (HTTP %d)\n", code); http.end(); return false; }
  DynamicJsonDocument doc(2048);
  deserializeJson(doc, http.getString());
  http.end();
  idToken = doc["idToken"].as<String>();
  uint32_t expiresIn = doc["expiresIn"] | 3600;
  tokenExpiry = millis() + (expiresIn - 60) * 1000UL;
  Serial.println("Token refreshed.");
  return idToken.length() > 0;
}

bool ensureToken()
{
  if (WiFi.status() != WL_CONNECTED) return false;
  if (idToken.isEmpty() || millis() > tokenExpiry) return refreshToken();
  return true;
}

// ─────────────────────────── Realtime Database helpers ───────────────────────
// GET a node — returns HTTP status, fills payload with the JSON value.
int rtdbGet(const String& path, String& payload)
{
  if (!ensureToken()) return -1;
  WiFiClientSecure client; client.setInsecure();
  HTTPClient http;
  String url = String(FIREBASE_DB_URL) + path + ".json?auth=" + idToken;
  http.begin(client, url);
  int code = http.GET();
  if (code == 200) payload = http.getString();
  http.end();
  return code;
}

// PATCH a node — merges body fields into the existing node.
int rtdbPatch(const String& path, const String& body)
{
  if (!ensureToken()) return -1;
  WiFiClientSecure client; client.setInsecure();
  HTTPClient http;
  String url = String(FIREBASE_DB_URL) + path + ".json?auth=" + idToken;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  int code = http.sendRequest("PATCH", body);
  http.end();
  return code;
}

// POST to a node — creates a new child with an auto-generated key.
int rtdbPost(const String& path, const String& body)
{
  if (!ensureToken()) return -1;
  WiFiClientSecure client; client.setInsecure();
  HTTPClient http;
  String url = String(FIREBASE_DB_URL) + path + ".json?auth=" + idToken;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  http.end();
  return code;
}

// ─────────────────────────── bin_commands ────────────────────────────────────
struct BinCommand {
  String status;
  String userId;
  String userName;
};

BinCommand checkBinCommand()
{
  BinCommand cmd = { "idle", "", "" };
  String payload;
  if (rtdbGet("/bin_commands/" BIN_ID, payload) != 200) return cmd;
  if (payload == "null") return cmd;
  DynamicJsonDocument doc(1024);
  if (deserializeJson(doc, payload)) return cmd;
  cmd.status   = doc["status"]   | "idle";
  cmd.userId   = doc["userId"]   | "";
  cmd.userName = doc["userName"] | "";
  return cmd;
}

bool patchBinCommand(const char* status, float weightKg = 0.0)
{
  StaticJsonDocument<128> payload;
  payload["status"] = status;
  if (weightKg > 0) payload["weightKg"] = weightKg;
  String body; serializeJson(payload, body);
  int code = rtdbPatch("/bin_commands/" BIN_ID, body);
  Serial.printf("patchBinCommand → %s (HTTP %d)\n", status, code);
  return code == 200;
}

// ─────────────────────────── rice_commands ───────────────────────────────────
struct RiceCommand {
  String status;
  String userId;
  float  amountKg;
};

RiceCommand checkRiceCommand()
{
  RiceCommand cmd = { "idle", "", 0.0 };
  String payload;
  if (rtdbGet("/rice_commands/" BIN_ID, payload) != 200) return cmd;
  if (payload == "null") return cmd;
  DynamicJsonDocument doc(1024);
  if (deserializeJson(doc, payload)) return cmd;
  cmd.status   = doc["status"]   | "idle";
  cmd.userId   = doc["userId"]   | "";
  cmd.amountKg = doc["amountKg"] | 0.0f;
  return cmd;
}

bool patchRiceCommand(const char* status)
{
  StaticJsonDocument<64> payload;
  payload["status"] = status;
  String body; serializeJson(payload, body);
  int code = rtdbPatch("/rice_commands/" BIN_ID, body);
  Serial.printf("patchRiceCommand → %s (HTTP %d)\n", status, code);
  return code == 200;
}

// ─────────────────────────── bin_events log ──────────────────────────────────
void sendBinEvent(float weightG)
{
  time_t now_t = time(nullptr);
  char ts[30];
  strftime(ts, sizeof(ts), "%Y-%m-%dT%H:%M:%SZ", gmtime(&now_t));

  StaticJsonDocument<256> payload;
  payload["binId"]     = BIN_ID;
  payload["weightG"]   = weightG;
  payload["weightKg"]  = weightG / 1000.0;
  payload["timestamp"] = ts;
  payload["processed"] = false;
  String body; serializeJson(payload, body);
  rtdbPost("/bin_events", body);
}

// ─────────────────────────── Scale helpers ───────────────────────────────────
float quickRead()
{
  if (!scale.is_ready()) return -1;
  float w = scale.get_units();
  return (w < DEADZONE) ? 0 : w;
}

float getAverageWeight()
{
  float sum = 0; int count = 0;
  for (int i = 0; i < NUM_SAMPLES; i++) {
    if (scale.is_ready()) { sum += scale.get_units(); count++; }
    delay(20);
  }
  float avg = (count > 0) ? sum / count : 0;
  return (avg < DEADZONE) ? 0 : avg;
}

float waitForSettle()
{
  float buf[SETTLE_SAMPLES] = {};
  int filled = 0;
  unsigned long start = millis();
  while (millis() - start < SETTLE_TIMEOUT_MS) {
    float w = quickRead();
    if (w < 0) { delay(20); continue; }
    buf[filled % SETTLE_SAMPLES] = w;
    filled++;
    if (filled >= SETTLE_SAMPLES) {
      float ref = buf[(filled - 1) % SETTLE_SAMPLES];
      bool stable = true;
      for (int i = 0; i < SETTLE_SAMPLES; i++)
        if (fabs(buf[i] - ref) > SETTLE_TOLERANCE) { stable = false; break; }
      if (stable) { Serial.println("Scale settled."); return getAverageWeight(); }
    }
    delay(50);
  }
  Serial.println("Settle timeout.");
  return 0;
}

// ─────────────────────────── Actuators ───────────────────────────────────────
void pushBottle()
{
  pusherServo.write(SERVO_PUSH);
  delay(600);
  pusherServo.write(135);
  delay(500);
  pusherServo.write(SERVO_REST);
}

void dispenseRice()
{
  Serial.println("Dispensing rice...");
  riceServo.write(RICE_CLOSE);
  delay(3000);
  riceServo.write(RICE_OPEN);
  delay(3000);
  riceServo.write(RICE_CLOSE);
  Serial.println("Rice dispensed.");
}

// ─────────────────────────── Setup ───────────────────────────────────────────
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
  Serial.printf("Bin ID: %s — Ready.\n", BIN_ID);
}

// ─────────────────────────── Loop ────────────────────────────────────────────
void loop()
{
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost — reconnecting...");
    connectWiFi();
    delay(1000);
    return;
  }

  // ── 1. Bottle-input command ───────────────────────────────────────────────
  BinCommand binCmd = checkBinCommand();

  if (binCmd.status == "waiting") {
    Serial.printf("Bottle command from '%s' — activating.\n", binCmd.userName.c_str());
    patchBinCommand("active");
    scale.tare();
    Serial.printf("Ready — user has %lu s to drop a bottle.\n",
                  SESSION_TIMEOUT_MS / 1000);

    float weight = 0;
    unsigned long deadline = millis() + SESSION_TIMEOUT_MS;
    while (millis() < deadline) {
      float raw = quickRead();
      if (raw >= MIN_BOTTLE_WEIGHT) {
        weight = waitForSettle();
        if (weight >= MIN_BOTTLE_WEIGHT && weight <= MAX_BOTTLE_WEIGHT) break;
        weight = 0;
      }
      delay(200);
    }

    if (weight >= MIN_BOTTLE_WEIGHT && weight <= MAX_BOTTLE_WEIGHT) {
      Serial.printf("Bottle confirmed: %.2f g — pushing.\n", weight);
      pushBottle();
      patchBinCommand("done", weight / 1000.0);
      sendBinEvent(weight);
      Serial.println("Bottle push done.");
      delay(1500);
    } else {
      patchBinCommand("expired");
      Serial.println("Bottle session expired.");
    }
    return;
  }

  // ── 2. Rice-dispense command ──────────────────────────────────────────────
  RiceCommand riceCmd = checkRiceCommand();

  if (riceCmd.status == "dispensing") {
    Serial.printf("Rice command: %.3f kg for '%s'\n",
                  riceCmd.amountKg, riceCmd.userId.c_str());
    dispenseRice();
    patchRiceCommand("done");
    delay(1000);
    return;
  }

  delay(5000);
}
