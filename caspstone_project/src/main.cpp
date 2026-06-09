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

#define FIREBASE_API_KEY  "AIzaSyCl-w8lOqUnOV1Del22js2783sYgapd4hw"
#define FIREBASE_PROJECT  "hardwareadmin-e1793"
#define BIN_ID            "bin_001"

// ─────────────────────────── HX711 ───────────────────────────────────────────
#define LOADCELL_DOUT_PIN 4
#define LOADCELL_SCK_PIN  5
HX711 scale;

// ─────────────────────────── Servo ───────────────────────────────────────────
#define SERVO_PIN   13
Servo pusherServo;
const int SERVO_REST = 90;
const int SERVO_PUSH = 180;

// ─────────────────────────── Weight Config ───────────────────────────────────
float calibration_factor      = -540.0;
const float MIN_BOTTLE_WEIGHT = 5.20;
const float MAX_BOTTLE_WEIGHT = 32.00;
const float DEADZONE          = 0.07;
const int   NUM_SAMPLES       = 10;
const int   SETTLE_SAMPLES    = 8;
const float SETTLE_TOLERANCE  = 0.50;
const unsigned long SETTLE_TIMEOUT_MS  = 6000;
const unsigned long SESSION_TIMEOUT_MS = 60000;  // user has 60 s to drop bottle

// ─────────────────────────── Firebase token cache ────────────────────────────
String   idToken     = "";
uint32_t tokenExpiry = 0;

// ─────────────────────────── WiFi + NTP ──────────────────────────────────────
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
    Serial.printf("\nWiFi connected — IP: %s\n", WiFi.localIP().toString().c_str());
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    Serial.print("Syncing NTP");
    while (time(nullptr) < 100000UL) { delay(500); Serial.print("."); }
    Serial.println(" OK");
  } else {
    Serial.println("\nWiFi failed.");
  }
}

// ─────────────────────────── Anonymous Firebase auth ─────────────────────────
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

// ─────────────────────────── bin_commands GET ────────────────────────────────
struct BinCommand {
  String status;    // idle | waiting | active | done | expired
  String userId;
  String userName;
};

BinCommand checkBinCommand()
{
  BinCommand cmd = { "idle", "", "" };
  if (!ensureToken()) return cmd;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String url = "https://firestore.googleapis.com/v1/projects/";
  url += FIREBASE_PROJECT;
  url += "/databases/(default)/documents/bin_commands/";
  url += BIN_ID;

  http.begin(client, url);
  http.addHeader("Authorization", "Bearer " + idToken);
  int code = http.GET();

  if (code != 200) { http.end(); return cmd; }   // 404 → no doc → idle

  DynamicJsonDocument doc(4096);
  deserializeJson(doc, http.getString());
  http.end();

  if (!doc.containsKey("fields")) return cmd;
  JsonObject fields = doc["fields"];

  auto getStr = [&](const char* key) -> String {
    if (fields.containsKey(key) && fields[key].containsKey("stringValue"))
      return fields[key]["stringValue"].as<String>();
    return "";
  };

  cmd.status   = getStr("status");
  cmd.userId   = getStr("userId");
  cmd.userName = getStr("userName");
  return cmd;
}

// ─────────────────────────── bin_commands PATCH ──────────────────────────────
// Partial update: only the listed fields in the updateMask are written.
bool patchBinCommand(const char* newStatus, float weightKg = 0.0)
{
  if (!ensureToken()) return false;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String url = "https://firestore.googleapis.com/v1/projects/";
  url += FIREBASE_PROJECT;
  url += "/databases/(default)/documents/bin_commands/";
  url += BIN_ID;
  url += "?updateMask.fieldPaths=status";
  if (weightKg > 0) url += "&updateMask.fieldPaths=weightKg";

  StaticJsonDocument<256> payload;
  JsonObject fields = payload.createNestedObject("fields");
  fields["status"]["stringValue"] = newStatus;
  if (weightKg > 0) fields["weightKg"]["doubleValue"] = weightKg;

  String body;
  serializeJson(payload, body);

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + idToken);

  int code = http.sendRequest("PATCH", body);
  http.end();

  Serial.printf("patchBinCommand → %s (HTTP %d)\n", newStatus, code);
  return code == 200;
}

// ─────────────────────────── bin_events POST (transaction log) ───────────────
bool sendBinEvent(float weightG)
{
  if (!ensureToken()) return false;

  time_t now_t = time(nullptr);
  char ts[30];
  strftime(ts, sizeof(ts), "%Y-%m-%dT%H:%M:%SZ", gmtime(&now_t));

  StaticJsonDocument<512> payload;
  JsonObject fields = payload.createNestedObject("fields");
  fields["binId"]["stringValue"]      = BIN_ID;
  fields["weightG"]["doubleValue"]    = weightG;
  fields["weightKg"]["doubleValue"]   = weightG / 1000.0;
  fields["timestamp"]["stringValue"]  = ts;
  fields["processed"]["booleanValue"] = false;

  String body;
  serializeJson(payload, body);

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String url = "https://firestore.googleapis.com/v1/projects/";
  url += FIREBASE_PROJECT;
  url += "/databases/(default)/documents/bin_events";

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + idToken);

  int code = http.POST(body);
  http.end();

  return (code == 200 || code == 201);
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
  int   filled = 0;
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

void pushBottle()
{
  pusherServo.write(SERVO_PUSH);
  delay(600);
  pusherServo.write(135);
  delay(500);
  pusherServo.write(SERVO_REST);
}

// ─────────────────────────── Setup ───────────────────────────────────────────
void setup()
{
  Serial.begin(115200);
  pusherServo.attach(SERVO_PIN);
  pusherServo.write(SERVO_REST);

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
  // ── Reconnect if WiFi dropped ─────────────────────────────────────────────
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost — reconnecting...");
    connectWiFi();
    delay(1000);
    return;
  }

  // ── Poll Firestore for a web-triggered command ────────────────────────────
  BinCommand cmd = checkBinCommand();

  if (cmd.status != "waiting") {
    delay(5000);   // nothing pending — check again in 5 s
    return;
  }

  // ── Command received: "waiting" ───────────────────────────────────────────
  Serial.printf("Command from '%s' — activating bin.\n", cmd.userName.c_str());
  patchBinCommand("active");
  scale.tare();   // fresh zero for this session
  Serial.printf("Ready. Waiting up to %lu s for a bottle...\n",
                SESSION_TIMEOUT_MS / 1000);

  // ── Wait for user to drop a bottle (SESSION_TIMEOUT_MS window) ───────────
  float weight = 0;
  unsigned long deadline = millis() + SESSION_TIMEOUT_MS;

  while (millis() < deadline) {
    float raw = quickRead();
    if (raw >= MIN_BOTTLE_WEIGHT) {
      weight = waitForSettle();
      if (weight >= MIN_BOTTLE_WEIGHT && weight <= MAX_BOTTLE_WEIGHT) break;
      weight = 0;   // settle returned out-of-range — keep waiting
    }
    delay(200);
  }

  // ── Bottle confirmed ──────────────────────────────────────────────────────
  if (weight >= MIN_BOTTLE_WEIGHT && weight <= MAX_BOTTLE_WEIGHT) {
    Serial.printf("Bottle: %.2f g — pushing...\n", weight);
    pushBottle();

    float wKg = weight / 1000.0;
    patchBinCommand("done", wKg);   // web app credits the user
    sendBinEvent(weight);           // also logs in bin_events for history

    Serial.println("Push done.");
    delay(1500);
  } else {
    // ── Session expired — no bottle placed ───────────────────────────────
    patchBinCommand("expired");
    Serial.println("Session expired — no bottle detected.");
  }

  delay(2000);   // brief cooldown before polling again
}
