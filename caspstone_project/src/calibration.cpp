#include "HX711.h"
#include <Preferences.h>

namespace {

constexpr int BOTTLE_DOUT_PIN = 4;
constexpr int BOTTLE_SCK_PIN = 5;
constexpr int RICE_DOUT_PIN = 32;
constexpr int RICE_SCK_PIN = 33;

float bottleCalibrationFactor = -112.1116f;
float riceCalibrationFactor = -540.0f;

HX711 bottleScale;
HX711 riceScale;
HX711* activeScale = &riceScale;
float* activeFactor = &riceCalibrationFactor;
const char* activeLabel = "Rice";
Preferences preferences;

String commandBuffer;

constexpr const char* PREF_NAMESPACE = "hx711-cal";
constexpr const char* PREF_BOTTLE_FACTOR = "bottle";
constexpr const char* PREF_RICE_FACTOR = "rice";
constexpr const char* PREF_ACTIVE_RICE = "riceSel";

void printHelp()
{
  Serial.println();
  Serial.println("HX711 calibration commands");
  Serial.println("  b               Select bottle scale (DOUT 4, SCK 5)");
  Serial.println("  r               Select rice scale (DOUT 32, SCK 33)");
  Serial.println("  t               Tare selected scale");
  Serial.println("  raw             Print average raw reading");
  Serial.println("  read            Print measured grams with current factor");
  Serial.println("  factor <value>  Set calibration factor manually");
  Serial.println("  calc <grams>    Compute factor using a known weight");
  Serial.println("  + / -           Adjust factor by 10");
  Serial.println("  > / <           Adjust factor by 1");
  Serial.println("  status          Show both saved factors");
  Serial.println("  help            Show this help");
  Serial.println();
}

void saveCalibrationState()
{
  preferences.putFloat(PREF_BOTTLE_FACTOR, bottleCalibrationFactor);
  preferences.putFloat(PREF_RICE_FACTOR, riceCalibrationFactor);
  preferences.putBool(PREF_ACTIVE_RICE, activeScale == &riceScale);
}

void loadCalibrationState()
{
  bottleCalibrationFactor =
    preferences.getFloat(PREF_BOTTLE_FACTOR, bottleCalibrationFactor);
  riceCalibrationFactor =
    preferences.getFloat(PREF_RICE_FACTOR, riceCalibrationFactor);
}

bool waitUntilReady(HX711& scale, const char* label)
{
  unsigned long startedAt = millis();
  while (!scale.is_ready() && (millis() - startedAt < 4000UL)) {
    delay(20);
  }

  if (!scale.is_ready()) {
    Serial.printf("%s scale is not ready. Check wiring and power.\n", label);
    return false;
  }

  return true;
}

float averageRawReading(HX711& scale, int samples = 15)
{
  long total = 0;
  int count = 0;

  for (int i = 0; i < samples; i++) {
    if (!scale.is_ready()) {
      delay(25);
      continue;
    }
    total += scale.get_value(1);
    count++;
    delay(20);
  }

  if (count == 0) {
    return 0.0f;
  }

  return static_cast<float>(total) / static_cast<float>(count);
}

float averageWeightGrams(HX711& scale, int samples = 10)
{
  if (!scale.is_ready()) {
    return 0.0f;
  }
  return scale.get_units(samples);
}

void selectScale(HX711& scale, float& factor, const char* label)
{
  activeScale = &scale;
  activeFactor = &factor;
  activeLabel = label;
  activeScale->set_scale(*activeFactor);
  saveCalibrationState();
  Serial.printf("Selected %s scale. Current factor: %.4f\n", activeLabel, *activeFactor);
}

void tareActiveScale()
{
  if (!waitUntilReady(*activeScale, activeLabel)) {
    return;
  }

  Serial.printf("Taring %s scale. Remove all weight...\n", activeLabel);
  activeScale->tare(20);
  activeScale->set_scale(*activeFactor);
  Serial.println("Tare complete.");
}

void printRaw()
{
  if (!waitUntilReady(*activeScale, activeLabel)) {
    return;
  }

  const float raw = averageRawReading(*activeScale);
  Serial.printf("%s raw average: %.2f\n", activeLabel, raw);
}

void printReading()
{
  if (!waitUntilReady(*activeScale, activeLabel)) {
    return;
  }

  activeScale->set_scale(*activeFactor);
  const float grams = averageWeightGrams(*activeScale);
  Serial.printf("%s reading: %.2f g using factor %.4f\n", activeLabel, grams, *activeFactor);
}

void setFactor(float factor)
{
  *activeFactor = factor;
  activeScale->set_scale(*activeFactor);
  saveCalibrationState();
  Serial.printf("%s factor set to %.4f\n", activeLabel, *activeFactor);
  printReading();
}

void adjustFactor(float delta)
{
  setFactor(*activeFactor + delta);
}

void calculateFactor(float knownWeightGrams)
{
  if (knownWeightGrams <= 0.0f) {
    Serial.println("Known weight must be greater than zero.");
    return;
  }

  if (!waitUntilReady(*activeScale, activeLabel)) {
    return;
  }

  activeScale->set_scale(1.0f);
  const float raw = averageRawReading(*activeScale);
  if (raw == 0.0f) {
    Serial.println("Raw reading is zero. Tare first and make sure a known weight is on the scale.");
    activeScale->set_scale(*activeFactor);
    return;
  }

  *activeFactor = raw / knownWeightGrams;
  activeScale->set_scale(*activeFactor);
  Serial.printf("%s factor calculated: %.4f using %.2f g\n", activeLabel, *activeFactor, knownWeightGrams);
  printReading();
}

void printStatus()
{
  Serial.printf("Bottle factor: %.4f\n", bottleCalibrationFactor);
  Serial.printf("Rice factor: %.4f\n", riceCalibrationFactor);
  Serial.printf("Selected scale: %s\n", activeLabel);
}

void handleCommand(const String& rawCommand)
{
  String command = rawCommand;
  command.trim();
  if (command.length() == 0) {
    return;
  }

  if (command.equalsIgnoreCase("b")) {
    selectScale(bottleScale, bottleCalibrationFactor, "Bottle");
    return;
  }

  if (command.equalsIgnoreCase("r")) {
    selectScale(riceScale, riceCalibrationFactor, "Rice");
    return;
  }

  if (command.equalsIgnoreCase("t")) {
    tareActiveScale();
    return;
  }

  if (command.equalsIgnoreCase("raw")) {
    printRaw();
    return;
  }

  if (command.equalsIgnoreCase("read")) {
    printReading();
    return;
  }

  if (command.equalsIgnoreCase("status")) {
    printStatus();
    return;
  }

  if (command.equalsIgnoreCase("help")) {
    printHelp();
    return;
  }

  if (command == "+") {
    adjustFactor(10.0f);
    return;
  }

  if (command == "-") {
    adjustFactor(-10.0f);
    return;
  }

  if (command == ">") {
    adjustFactor(1.0f);
    return;
  }

  if (command == "<") {
    adjustFactor(-1.0f);
    return;
  }

  if (command.startsWith("factor ")) {
    setFactor(command.substring(7).toFloat());
    return;
  }

  if (command.startsWith("calc ")) {
    calculateFactor(command.substring(5).toFloat());
    return;
  }

  Serial.printf("Unknown command: %s\n", command.c_str());
  printHelp();
}

}  // namespace

void setup()
{
  Serial.begin(115200);
  delay(1200);

  preferences.begin(PREF_NAMESPACE, false);
  loadCalibrationState();

  bottleScale.begin(BOTTLE_DOUT_PIN, BOTTLE_SCK_PIN);
  riceScale.begin(RICE_DOUT_PIN, RICE_SCK_PIN);

  if (preferences.getBool(PREF_ACTIVE_RICE, true)) {
    selectScale(riceScale, riceCalibrationFactor, "Rice");
  } else {
    selectScale(bottleScale, bottleCalibrationFactor, "Bottle");
  }
  Serial.println("HX711 calibration firmware ready.");
  printStatus();
  printHelp();
}

void loop()
{
  while (Serial.available() > 0) {
    const char incoming = static_cast<char>(Serial.read());
    if (incoming == '\n' || incoming == '\r') {
      if (commandBuffer.length() > 0) {
        handleCommand(commandBuffer);
        commandBuffer = "";
      }
    } else {
      commandBuffer += incoming;
    }
  }

  static unsigned long nextReadAt = 0;
  if (millis() >= nextReadAt) {
    nextReadAt = millis() + 2000UL;
    if (activeScale->is_ready()) {
      activeScale->set_scale(*activeFactor);
      const float grams = averageWeightGrams(*activeScale, 5);
      Serial.printf("[%s] %.2f g (factor %.4f)\n", activeLabel, grams, *activeFactor);
    } else {
      Serial.printf("[%s] scale not ready\n", activeLabel);
    }
  }
}
