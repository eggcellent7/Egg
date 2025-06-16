#include <ArduinoBLE.h>
#include "Nicla_System.h"
#include "Arduino_BHY2.h"

#define SERVICE_NAME "EggcellentImposter"
#define SERVICE_UUID "19B10000-E8F2-537E-4F6C-D104768A1214"
#define CHAR_ID "19B10001-E8F2-537E-4F6C-D104768A1214"

typedef struct EggStateStruct {
  float qx;
  float qy;
  float qz;
  float qw;
  float temp;
  float humidity;
  float photo1;
  float photo2;
} EggState;

EggState state;

#define BLE_CHAR_PROPS BLERead | BLEWrite | BLENotify

BLEService eggService(SERVICE_UUID);
BLECharacteristic eggCharacteristic(CHAR_ID, BLE_CHAR_PROPS, sizeof(EggStateStruct), true);

// Sensor Stuff
Sensor temperature(SENSOR_ID_TEMP);
float temperatureValue = 0;

const unsigned long SENSOR_UPDATE_PERIOD = 1 * 1000; // 1 seecond 

SensorQuaternion quaternion(SENSOR_ID_RV);


#define ledPin LED_BUILTIN

unsigned long last_update;


void setup() {

  Serial.begin(9600);

  while (!Serial);

  // BHY2.begin();
  // temperature.begin();
  // quaternion.begin();


  // set LED pin to output mode

  pinMode(ledPin, OUTPUT);


  // begin initialization

  if (!BLE.begin()) {

    Serial.println("starting Bluetooth Low Energy module failed!");


    while (1);

  }


  // set advertised local name and service UUID:

  BLE.setLocalName(SERVICE_NAME);
  BLE.setAdvertisedService(eggService);
  eggService.addCharacteristic(eggCharacteristic);


  // add service

  BLE.addService(eggService);
  //updateSensors();


  // start advertising

  BLE.advertise();


  Serial.println("Setup Completed");

}

void updateSensors()
{
  BHY2.update();

  state.temp = temperature.value();

  state.qx = quaternion.x();
  state.qx = quaternion.y();
  state.qx = quaternion.z();
  state.qx = quaternion.w();

  last_update = millis();

  eggCharacteristic.writeValue((void*) &state, sizeof(EggStateStruct));
}

void loop() {

  // digitalWrite(ledPin, HIGH);
  // delay(500);
  // digitalWrite(ledPin, LOW);
  // delay(500);
  // return;

  // listen for Bluetooth® Low Energy peripherals to connect:

  BLEDevice central = BLE.central();


  // if a central is connected to peripheral:

  if (central) {

    Serial.print(F("Connected to central: "));

    // print the central's MAC address:

    Serial.println(central.address());


    // while the central is still connected to peripheral:

    while (central.connected()) {

      // if the remote device wrote to the characteristic,

      // use the value to control the LED:

      unsigned long time = millis();
      if (time - last_update > SENSOR_UPDATE_PERIOD)
        updateSensors();
    }


    // when the central disconnects, print it out:

    Serial.print(F("Disconnected from central: "));

    Serial.println(central.address());

  } else {
    
  }

}