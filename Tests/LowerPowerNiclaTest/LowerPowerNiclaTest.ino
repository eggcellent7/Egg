#include <Arduino.h>
#include <Arduino_BHY2.h>
#include "mbed.h"

using namespace mbed;

LowPowerTimer timer;

void turnOffLEDs() {
  digitalWrite(LEDR, LOW); // Off
  digitalWrite(LEDG, LOW); // Off
  digitalWrite(LEDB, LOW); // Off
}

void turnOnLEDs() {
  digitalWrite(LEDR, HIGH); // Off
  digitalWrite(LEDG, HIGH); // Off
  digitalWrite(LEDB, HIGH); // Off
}

void setup() {
  pinMode(LEDR, OUTPUT);
  pinMode(LEDG, OUTPUT);
  pinMode(LEDB, OUTPUT);

  // Turn off onboard RGB LED
  turnOffLEDs();

  // Initialize sensors
  BHY2.begin();

  delay(1000);
}

void loop() {

  // Turn off sensors

  // Turn off LEDs again (in case BHY turns them on)
  turnOffLEDs();

  // Configure wake-up timer
  Timer t;
  t.start();

  while (t.read_ms() < 5000) {
    // Enter deep sleep repeatedly
    hal_deepsleep();
    delay(1);
  }

  // Reinitialize sensors
  // BHY2.begin();

  turnOnLEDs();

  delay(1000);
}
