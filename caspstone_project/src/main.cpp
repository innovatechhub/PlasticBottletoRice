#include "HX711.h"
#include <ESP32Servo.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <math.h>
#include <time.h>

#define WIFI_SSID         "Admin"
#define WIFI_PASSWORD     "P4ssword#369"
#define FIREBASE_API_KEY  "AIzaSyCD0HR0qKk5BDbT1xD8OGSn06Y_80MP3ZI"
#define FIREBASE_DB_URL   "https://plastictorice-default-rtdb.firebaseio.com"
#define BIN_ID            "bin_001"

#define SERVO_PIN 13
Servo pusherServo;
const int SERVO_REST = 90;
const int SERVO_PUSH = 180;
int currentPusherServoAngle = SERVO_REST;
String currentPusherServoState = "rest";

#define RICE_SERVO_PIN 14
Servo riceServo;
const int RICE_OPEN = 8;
const int RICE_CLOSE = 38;
const int RICE_OPEN_BOOST = 0;
const int RICE_NUDGE_CLOSE = 18;
int currentRiceServoAngle = RICE_CLOSE;
String currentRiceServoState = "closed";

#define RICE_LEVEL_TRIG_PIN 18
#define RICE_LEVEL_ECHO_PIN 34
#define BOTTLE_LEVEL_TRIG_PIN 19
#define BOTTLE_LEVEL_ECHO_PIN 35

#define BOTTLE_LOADCELL_DOUT_PIN 4
#define BOTTLE_LOADCELL_SCK_PIN  5
#define RICE_LOADCELL_DOUT_PIN   32
#define RICE_LOADCELL_SCK_PIN    33
#define INDUCTIVE_SENSOR_PIN     25
HX711 bottleScale;
HX711 riceScale;

float bottleCalibrationFactor = -214.4414f;
float riceCalibrationFactor = -103.7132f;
const float MIN_BOTTLE_WEIGHT = 5.20;
const float MAX_BOTTLE_WEIGHT = 250.00;
const int MAX_SCALE_FILTER_SAMPLES = 16;
const int MAX_SCALE_SETTLE_SAMPLES = 12;
const unsigned long SESSION_TIMEOUT_MS = 60000;
const unsigned long LEVEL_PUBLISH_INTERVAL_MS = 5000;
const unsigned long BIN_IDLE_POLL_INTERVAL_MS = 250;
const unsigned long BIN_ACTIVE_STATUS_POLL_INTERVAL_MS = 300;
const unsigned long BIN_ACTIVE_LOOP_DELAY_MS = 100;
const unsigned long BIN_REMOVAL_LOOP_DELAY_MS = 100;
const unsigned long BIN_METAL_REMOVAL_LOOP_DELAY_MS = 40;
const unsigned long BIN_WEIGHT_PRINT_INTERVAL_MS = 700;
const unsigned long RICE_DISPENSE_BASE_TIMEOUT_MS = 45000;
const unsigned long RICE_DISPENSE_EXTRA_TIMEOUT_PER_500G_MS = 20000;
const unsigned long RICE_POST_DISPENSE_SETTLE_MS = 1500;
const unsigned long RICE_SERVO_OPEN_BOOST_MS = 250;
const unsigned long RICE_SERVO_NUDGE_CLOSE_MS = 140;
const unsigned long RICE_SERVO_NUDGE_OPEN_MS = 180;
const unsigned long RICE_SERVO_NUDGE_INTERVAL_MS = 2500;
const float RICE_PROGRESS_DELTA_G = 12.0f;
const float ULTRASONIC_MAX_VALID_DISTANCE_CM = 400.0f;
const float RICE_EMPTY_DISTANCE_CM = 40.0f;
const float RICE_FULL_DISTANCE_CM = 8.0f;
const float BOTTLE_EMPTY_DISTANCE_CM = 55.0f;
const float BOTTLE_FULL_DISTANCE_CM = 12.0f;
const float RICE_TARGET_500G = 490.0f;
const float RICE_TARGET_1000G = 990.0f;
const float RICE_TARGET_SELECTION_TOLERANCE_G = 30.0f;
const float RICE_DISPENSE_UNDER_TARGET_TOLERANCE_G = 30.0f;
const int INDUCTIVE_ACTIVE_STATE = LOW;

struct ScaleProfile {
  const char* label;
  float deadzoneG;
  int filterSamples;
  int settleWindow;
  float settleToleranceG;
  unsigned long settleTimeoutMs;
  unsigned long sampleDelayMs;
};

const ScaleProfile BOTTLE_SCALE_PROFILE = {
  "Bottle scale",
  0.10f,
  9,
  6,
  0.45f,
  3500UL,
  18UL
};

const ScaleProfile RICE_SCALE_PROFILE = {
  "Rice scale",
  0.40f,
  12,
  8,
  2.50f,
  5000UL,
  25UL
};

String idToken = "";
uint32_t tokenExpiry = 0;
unsigned long nextLevelPublishAt = 0;

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

bool patchRiceCommand(const char* status,
                      float dispensedKg = -1.0f,
                      const String& lastDispenseAt = "",
                      const String& message = "")
{
  StaticJsonDocument<192> body;
  body["status"] = status;
  if (dispensedKg >= 0.0f) body["dispensedKg"] = dispensedKg;
  if (lastDispenseAt.length() > 0) body["lastDispenseAt"] = lastDispenseAt;
  if (message.length() > 0) body["message"] = message;
  String s;
  serializeJson(body, s);
  int code = rtdbPatch("/rice_commands/" BIN_ID, s);
  Serial.printf("  rice_commands -> \"%s\" (HTTP %d)\n", status, code);
  return code == 200;
}

bool patchBinStatus(float riceDistanceCm,
                    float riceLevelPercent,
                    float bottleDistanceCm,
                    float bottleLevelPercent,
                    bool metalDetected,
                    float riceScaleWeightG,
                    float bottleScaleWeightG)
{
  StaticJsonDocument<640> body;
  body["binId"] = BIN_ID;
  body["updatedAt"] = currentIsoTimestamp();
  body["riceDistanceCm"] = riceDistanceCm;
  body["riceLevelPercent"] = riceLevelPercent;
  body["bottleDistanceCm"] = bottleDistanceCm;
  body["bottleLevelPercent"] = bottleLevelPercent;
  body["inductiveMetalDetected"] = metalDetected;
  body["riceScaleWeightG"] = riceScaleWeightG;
  body["bottleScaleWeightG"] = bottleScaleWeightG;
  body["pusherServoAngle"] = currentPusherServoAngle;
  body["pusherServoState"] = currentPusherServoState;
  body["riceServoAngle"] = currentRiceServoAngle;
  body["riceServoState"] = currentRiceServoState;
  body["wifiConnected"] = WiFi.status() == WL_CONNECTED;

  String s;
  serializeJson(body, s);
  int code = rtdbPatch("/bin_status/" BIN_ID, s);
  Serial.printf("  bin_status published (HTTP %d)\n", code);
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

float applyScaleDeadzone(float weightG, const ScaleProfile& profile)
{
  return (fabs(weightG) < profile.deadzoneG) ? 0.0f : weightG;
}

void sortFloatBuffer(float* values, int count)
{
  for (int i = 1; i < count; i++) {
    float key = values[i];
    int j = i - 1;
    while (j >= 0 && values[j] > key) {
      values[j + 1] = values[j];
      j--;
    }
    values[j + 1] = key;
  }
}

float readScaleUnits(HX711& loadCell, const ScaleProfile& profile)
{
  if (!loadCell.is_ready()) return -1.0f;
  return applyScaleDeadzone(loadCell.get_units(), profile);
}

float getAverageWeight(HX711& loadCell,
                       const ScaleProfile& profile,
                       int sampleCount = -1)
{
  const int requestedSamples =
    (sampleCount > 0) ? sampleCount : profile.filterSamples;
  const int cappedSamples = min(requestedSamples, MAX_SCALE_FILTER_SAMPLES);
  float samples[MAX_SCALE_FILTER_SAMPLES] = {};
  int count = 0;

  for (int i = 0; i < cappedSamples; i++) {
    if (loadCell.is_ready()) {
      samples[count++] = applyScaleDeadzone(loadCell.get_units(), profile);
    }
    delay(profile.sampleDelayMs);
  }

  if (count == 0) {
    return -1.0f;
  }

  sortFloatBuffer(samples, count);

  int trimCount = 0;
  if (count >= 9) {
    trimCount = 2;
  } else if (count >= 5) {
    trimCount = 1;
  }

  float sum = 0.0f;
  int used = 0;
  for (int i = trimCount; i < count - trimCount; i++) {
    sum += samples[i];
    used++;
  }

  if (used == 0) {
    return -1.0f;
  }

  return applyScaleDeadzone(sum / used, profile);
}

bool waitForScaleReady(HX711& loadCell,
                       const char* label,
                       unsigned long timeoutMs = 5000)
{
  unsigned long start = millis();
  while (!loadCell.is_ready() && (millis() - start < timeoutMs)) {
    delay(20);
  }

  if (!loadCell.is_ready()) {
    Serial.printf("%s not ready after %lu ms.\n", label, timeoutMs);
    return false;
  }

  return true;
}

float waitForSettle(HX711& loadCell, const ScaleProfile& profile)
{
  const int settleWindow = min(profile.settleWindow, MAX_SCALE_SETTLE_SAMPLES);
  const int quickSampleCount = max(3, min(profile.filterSamples / 2, 6));
  float buf[MAX_SCALE_SETTLE_SAMPLES] = {};
  int filled = 0;
  unsigned long start = millis();

  while (millis() - start < profile.settleTimeoutMs) {
    float w = getAverageWeight(loadCell, profile, quickSampleCount);
    if (w < 0) {
      delay(profile.sampleDelayMs);
      continue;
    }

    buf[filled % settleWindow] = w;
    filled++;

    if (filled >= settleWindow) {
      float minWeight = buf[0];
      float maxWeight = buf[0];
      float sum = 0.0f;
      for (int i = 0; i < settleWindow; i++) {
        minWeight = min(minWeight, buf[i]);
        maxWeight = max(maxWeight, buf[i]);
        sum += buf[i];
      }

      const float spread = maxWeight - minWeight;
      if (spread <= profile.settleToleranceG) {
        Serial.printf("  %s settled (spread %.2f g).\n", profile.label, spread);
        return applyScaleDeadzone(sum / settleWindow, profile);
      }
    }

    delay(profile.sampleDelayMs);
  }

  Serial.printf("  %s settle timeout.\n", profile.label);
  float fallbackWeight = getAverageWeight(loadCell, profile);
  return (fallbackWeight < 0.0f) ? 0.0f : fallbackWeight;
}

bool tareScale(HX711& loadCell, const ScaleProfile& profile)
{
  Serial.printf("Taring %s...\n", profile.label);
  if (!waitForScaleReady(loadCell, profile.label)) {
    Serial.printf("%s tare skipped.\n", profile.label);
    return false;
  }
  loadCell.tare(profile.filterSamples);
  Serial.printf("%s tare complete.\n", profile.label);
  return true;
}

bool isMetalDetected()
{
  return digitalRead(INDUCTIVE_SENSOR_PIN) == INDUCTIVE_ACTIVE_STATE;
}

void setPusherServo(int angle, const char* state)
{
  currentPusherServoAngle = angle;
  currentPusherServoState = state;
  pusherServo.write(angle);
}

void setRiceServo(int angle, const char* state)
{
  currentRiceServoAngle = angle;
  currentRiceServoState = state;
  riceServo.write(angle);
}

unsigned long resolveRiceDispenseTimeoutMs(float targetWeightG)
{
  const int extraSteps =
    max(0, static_cast<int>(ceil(targetWeightG / RICE_TARGET_500G)) - 1);
  return RICE_DISPENSE_BASE_TIMEOUT_MS +
         (static_cast<unsigned long>(extraSteps) * RICE_DISPENSE_EXTRA_TIMEOUT_PER_500G_MS);
}

void primeRiceGateFlow()
{
  Serial.println("  Rice gate: OPENING");
  setRiceServo(RICE_OPEN_BOOST, "open-boost");
  delay(RICE_SERVO_OPEN_BOOST_MS);
  setRiceServo(RICE_OPEN, "open");
}

void nudgeRiceGate()
{
  Serial.println("  Rice flow slow - nudging gate.");
  setRiceServo(RICE_NUDGE_CLOSE, "nudging");
  delay(RICE_SERVO_NUDGE_CLOSE_MS);
  setRiceServo(RICE_OPEN_BOOST, "open-boost");
  delay(RICE_SERVO_NUDGE_OPEN_MS);
  setRiceServo(RICE_OPEN, "open");
}

void pushBottle()
{
  Serial.println("  Pushing bottle in...");
  setPusherServo(SERVO_PUSH, "pushing");
  delay(600);
  setPusherServo(135, "returning");
  delay(500);
  setPusherServo(SERVO_REST, "rest");
  Serial.println("  Pusher returned to rest.");
}

bool resolveRiceTargetWeight(float amountKg, float& targetWeightG, String& message)
{
  const float requestedWeightG = amountKg * 1000.0f;

  if (fabs(requestedWeightG - RICE_TARGET_500G) <= RICE_TARGET_SELECTION_TOLERANCE_G) {
    targetWeightG = RICE_TARGET_500G;
    return true;
  }

  if (fabs(requestedWeightG - RICE_TARGET_1000G) <= RICE_TARGET_SELECTION_TOLERANCE_G) {
    targetWeightG = RICE_TARGET_1000G;
    return true;
  }

  message = "Only 500 g and 1000 g rice redemption amounts are supported.";
  return false;
}

bool dispenseRiceByWeight(float amountKg, float& dispensedKg, String& message)
{
  dispensedKg = 0.0f;

  if (amountKg <= 0.0f) {
    message = "Invalid dispense amount requested.";
    return false;
  }

  float targetWeightG = 0.0f;
  if (!resolveRiceTargetWeight(amountKg, targetWeightG, message)) {
    return false;
  }

  if (!riceScale.is_ready()) {
    message = "Rice reward scale is not ready.";
    return false;
  }

  Serial.printf("  Rice target: %.1f g\n", targetWeightG);

  if (!tareScale(riceScale, RICE_SCALE_PROFILE)) {
    message = "Rice reward scale could not be tared.";
    return false;
  }
  delay(200);

  const unsigned long dispenseTimeoutMs = resolveRiceDispenseTimeoutMs(targetWeightG);
  unsigned long startedAt = millis();
  unsigned long nextPrintAt = 0;
  unsigned long nextNudgeAt = millis() + RICE_SERVO_NUDGE_INTERVAL_MS;
  float highestWeightG = 0.0f;

  primeRiceGateFlow();

  while (millis() - startedAt < dispenseTimeoutMs) {
    float currentWeightG = getAverageWeight(riceScale, RICE_SCALE_PROFILE, 4);

    if (currentWeightG > highestWeightG + RICE_PROGRESS_DELTA_G) {
      highestWeightG = currentWeightG;
      nextNudgeAt = millis() + RICE_SERVO_NUDGE_INTERVAL_MS;
    }

    if (millis() >= nextPrintAt) {
      if (currentWeightG >= 0.0f) {
        Serial.printf("  Rice scale: %.1f g / %.1f g (best %.1f g)\n",
                      currentWeightG, targetWeightG, highestWeightG);
      } else {
        Serial.println("  Rice scale: not ready");
      }
      nextPrintAt = millis() + 500;
    }

    if (currentWeightG >= targetWeightG) {
      Serial.printf("  Rice target reached at %.1f g. Closing gate.\n", currentWeightG);
      break;
    }

    if (millis() >= nextNudgeAt) {
      nudgeRiceGate();
      nextNudgeAt = millis() + RICE_SERVO_NUDGE_INTERVAL_MS;
    }

    delay(80);
  }

  setRiceServo(RICE_CLOSE, "closed");
  Serial.println("  Rice gate: CLOSED");

  delay(RICE_POST_DISPENSE_SETTLE_MS);
  float finalWeightG = waitForSettle(riceScale, RICE_SCALE_PROFILE);
  if (finalWeightG <= 0.0f) {
    finalWeightG = getAverageWeight(riceScale, RICE_SCALE_PROFILE);
  }

  dispensedKg = finalWeightG / 1000.0f;

  if (finalWeightG <= 0.0f) {
    message = "No rice measured on the reward scale.";
    return false;
  }

  if ((millis() - startedAt) >= dispenseTimeoutMs &&
      finalWeightG < targetWeightG - RICE_DISPENSE_UNDER_TARGET_TOLERANCE_G) {
    message = "Rice dispense timed out before reaching the requested weight.";
    return false;
  }

  if (finalWeightG < targetWeightG - RICE_DISPENSE_UNDER_TARGET_TOLERANCE_G) {
    message = "Rice dispensed below the requested weight.";
    return false;
  }

  message = "Rice dispensed successfully.";
  return true;
}

float readUltrasonicDistanceCm(int trigPin, int echoPin)
{
  digitalWrite(trigPin, LOW);
  delayMicroseconds(3);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  unsigned long durationUs = pulseIn(echoPin, HIGH, 25000UL);
  if (durationUs == 0) return -1.0f;

  float distanceCm = durationUs * 0.0343f / 2.0f;
  if (distanceCm <= 0.0f || distanceCm > ULTRASONIC_MAX_VALID_DISTANCE_CM) {
    return -1.0f;
  }
  return distanceCm;
}

float distanceToLevelPercent(float distanceCm, float emptyDistanceCm, float fullDistanceCm)
{
  if (distanceCm < 0.0f) return -1.0f;

  float range = emptyDistanceCm - fullDistanceCm;
  if (range <= 0.0f) return -1.0f;

  float percent = ((emptyDistanceCm - distanceCm) / range) * 100.0f;
  if (percent < 0.0f) percent = 0.0f;
  if (percent > 100.0f) percent = 100.0f;
  return percent;
}

void publishLevelStatusIfDue()
{
  if (millis() < nextLevelPublishAt) return;

  float riceDistanceCm = readUltrasonicDistanceCm(RICE_LEVEL_TRIG_PIN, RICE_LEVEL_ECHO_PIN);
  float bottleDistanceCm = readUltrasonicDistanceCm(BOTTLE_LEVEL_TRIG_PIN, BOTTLE_LEVEL_ECHO_PIN);
  float riceScaleWeightG = getAverageWeight(riceScale, RICE_SCALE_PROFILE, 4);
  float bottleScaleWeightG = getAverageWeight(bottleScale, BOTTLE_SCALE_PROFILE, 4);
  bool metalDetected = isMetalDetected();
  float riceLevelPercent = distanceToLevelPercent(
    riceDistanceCm,
    RICE_EMPTY_DISTANCE_CM,
    RICE_FULL_DISTANCE_CM
  );
  float bottleLevelPercent = distanceToLevelPercent(
    bottleDistanceCm,
    BOTTLE_EMPTY_DISTANCE_CM,
    BOTTLE_FULL_DISTANCE_CM
  );

  if (riceDistanceCm >= 0.0f) {
    Serial.printf("  Rice level: %.1f cm -> %.0f%%\n", riceDistanceCm, riceLevelPercent);
  } else {
    Serial.println("  Rice level: sensor timeout");
  }

  if (bottleDistanceCm >= 0.0f) {
    Serial.printf("  Bottle level: %.1f cm -> %.0f%%\n", bottleDistanceCm, bottleLevelPercent);
  } else {
    Serial.println("  Bottle level: sensor timeout");
  }

  Serial.printf("  Inductive sensor: %s\n", metalDetected ? "METAL DETECTED" : "clear");
  if (riceScaleWeightG >= 0.0f) {
    Serial.printf("  Rice reward scale: %.1f g\n", riceScaleWeightG);
  } else {
    Serial.println("  Rice reward scale: not ready");
  }
  if (bottleScaleWeightG >= 0.0f) {
    Serial.printf("  Bottle scale: %.1f g\n", bottleScaleWeightG);
  } else {
    Serial.println("  Bottle scale: not ready");
  }
  Serial.printf("  Pusher servo: %s (%d)\n",
                currentPusherServoState.c_str(),
                currentPusherServoAngle);
  Serial.printf("  Rice servo: %s (%d)\n",
                currentRiceServoState.c_str(),
                currentRiceServoAngle);

  patchBinStatus(
    riceDistanceCm,
    riceLevelPercent,
    bottleDistanceCm,
    bottleLevelPercent,
    metalDetected,
    riceScaleWeightG,
    bottleScaleWeightG
  );
  nextLevelPublishAt = millis() + LEVEL_PUBLISH_INTERVAL_MS;
}

void setup()
{
  Serial.begin(115200);

  pusherServo.attach(SERVO_PIN);
  setPusherServo(SERVO_REST, "rest");

  riceServo.attach(RICE_SERVO_PIN);
  setRiceServo(RICE_CLOSE, "closed");

  pinMode(RICE_LEVEL_TRIG_PIN, OUTPUT);
  pinMode(RICE_LEVEL_ECHO_PIN, INPUT);
  pinMode(BOTTLE_LEVEL_TRIG_PIN, OUTPUT);
  pinMode(BOTTLE_LEVEL_ECHO_PIN, INPUT);
  pinMode(INDUCTIVE_SENSOR_PIN, INPUT_PULLUP);

  bottleScale.begin(BOTTLE_LOADCELL_DOUT_PIN, BOTTLE_LOADCELL_SCK_PIN);
  bottleScale.set_scale(bottleCalibrationFactor);
  tareScale(bottleScale, BOTTLE_SCALE_PROFILE);

  riceScale.begin(RICE_LOADCELL_DOUT_PIN, RICE_LOADCELL_SCK_PIN);
  riceScale.set_scale(riceCalibrationFactor);
  tareScale(riceScale, RICE_SCALE_PROFILE);

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
    tareScale(bottleScale, BOTTLE_SCALE_PROFILE);
    Serial.printf("  Waiting up to %lu s for bottles...\n",
                  SESSION_TIMEOUT_MS / 1000);

    unsigned long deadline = millis() + SESSION_TIMEOUT_MS;
    unsigned long nextStatusPoll = 0;
    unsigned long nextWeightPrint = 0;
    int acceptedCount = 0;
    bool cancelled = false;
    bool awaitingRemoval = false;
    bool awaitingMetalRemoval = false;

    while (true) {
      if (!awaitingRemoval && millis() >= deadline) {
        break;
      }

      if (millis() >= nextStatusPoll) {
        BinCommand liveCmd = checkBinCommand();
        if (liveCmd.status != "active" && liveCmd.status != "waiting") {
          cancelled = true;
          break;
        }
        nextStatusPoll = millis() + BIN_ACTIVE_STATUS_POLL_INTERVAL_MS;
      }

      if (awaitingRemoval) {
        bool removalCleared = false;

        if (awaitingMetalRemoval) {
          removalCleared = !isMetalDetected();
        } else {
          float removalWeight = getAverageWeight(bottleScale, BOTTLE_SCALE_PROFILE, 3);
          removalCleared =
            removalWeight >= 0.0f && removalWeight <= BOTTLE_SCALE_PROFILE.deadzoneG;
        }

        if (removalCleared) {
          Serial.println("[BOTTLE] Object removed. Resuming 60-second timer.");
          awaitingRemoval = false;
          awaitingMetalRemoval = false;
          deadline = millis() + SESSION_TIMEOUT_MS;
          patchBinCommand(
            "active",
            -1.0f,
            acceptedCount,
            "",
            "ready",
            "Metal removed. Bin is active again. Insert a plastic bottle.",
            currentIsoTimestamp()
          );
        }
        delay(awaitingMetalRemoval ? BIN_METAL_REMOVAL_LOOP_DELAY_MS : BIN_REMOVAL_LOOP_DELAY_MS);
        continue;
      }

      publishLevelStatusIfDue();

      if (isMetalDetected()) {
        String rejectedAt = currentIsoTimestamp();
        String reason =
          "Metal detected. Please remove the object. Only plastic bottle is allowed.";
        Serial.println("[BOTTLE] Metal detected by inductive sensor. Waiting for removal.");
        patchBinCommand("active", -1.0f, acceptedCount, "", "warning", reason, rejectedAt);
        awaitingRemoval = true;
        awaitingMetalRemoval = true;
        delay(BIN_ACTIVE_LOOP_DELAY_MS);
        continue;
      }

      float raw = getAverageWeight(bottleScale, BOTTLE_SCALE_PROFILE, 4);

      if (millis() >= nextWeightPrint) {
        if (raw >= 0.0f) {
          Serial.printf("  Current weight: %.2f g\n", raw);
        } else {
          Serial.println("  Current weight: scale not ready");
        }
        nextWeightPrint = millis() + BIN_WEIGHT_PRINT_INTERVAL_MS;
      }

      if (raw >= MIN_BOTTLE_WEIGHT) {
        bool metalDetected = isMetalDetected();
        float weight = waitForSettle(bottleScale, BOTTLE_SCALE_PROFILE);
        metalDetected = metalDetected || isMetalDetected();
        Serial.printf("  Settled weight: %.2f g\n", weight);
        if (metalDetected) {
          String rejectedAt = currentIsoTimestamp();
          String reason =
            "Metal detected. Please remove the object. Only plastic bottle is allowed.";
          Serial.println("[BOTTLE] Metal detected. Waiting for removal.");
          patchBinCommand("active", -1.0f, acceptedCount, "", "warning", reason, rejectedAt);
          awaitingRemoval = true;
          awaitingMetalRemoval = true;
        } else if (weight >= MIN_BOTTLE_WEIGHT && weight <= MAX_BOTTLE_WEIGHT) {
          float weightKg = weight / 1000.0f;
          String acceptedAt = currentIsoTimestamp();
          Serial.printf("[BOTTLE] Accepted: %.2f g (%.4f kg) - pushing.\n",
                        weight, weightKg);

          pushBottle();
          acceptedCount++;

          patchBinCommand("active", weightKg, acceptedCount, acceptedAt, "accepted", "Bottle accepted.", acceptedAt);
          sendBinEvent(weight, binCmd.userId, binCmd.userName);

          deadline = millis() + SESSION_TIMEOUT_MS;
          tareScale(bottleScale, BOTTLE_SCALE_PROFILE);
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
          awaitingMetalRemoval = false;
          Serial.printf("  Rejected weight: %.2f g (valid range %.2f-%.2f g)\n",
                        weight, MIN_BOTTLE_WEIGHT, MAX_BOTTLE_WEIGHT);
        }
      }

      delay(BIN_ACTIVE_LOOP_DELAY_MS);
    }

    if (cancelled) {
      Serial.println("[BOTTLE] Session closed by user.\n");
    } else {
      patchBinCommand("expired");
      Serial.println("[BOTTLE] Session expired - no bottle received before timeout.\n");
    }
    return;
  }

  publishLevelStatusIfDue();

  RiceCommand riceCmd = checkRiceCommand();

  if (riceCmd.status == "dispensing") {
    Serial.printf("[RICE] Dispensing %.3f kg for user '%s'\n",
                  riceCmd.amountKg, riceCmd.userId.c_str());

    float dispensedKg = 0.0f;
    String dispenseMessage;
    bool dispenseOk = dispenseRiceByWeight(riceCmd.amountKg, dispensedKg, dispenseMessage);
    String completedAt = currentIsoTimestamp();
    patchRiceCommand(
      dispenseOk ? "done" : "error",
      dispensedKg,
      completedAt,
      dispenseMessage
    );

    if (dispenseOk) {
      Serial.printf("[RICE] Dispensing complete: %.3f kg.\n\n", dispensedKg);
    } else {
      Serial.printf("[RICE] Dispensing failed: %s\n\n", dispenseMessage.c_str());
    }
    delay(1000);
    return;
  }

  delay(BIN_IDLE_POLL_INTERVAL_MS);
}
