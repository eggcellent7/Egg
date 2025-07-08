#include <ArduinoBLE.h>
#include "Nicla_System.h"
#include "Arduino_BHY2.h"

#define SERVICE_NAME "EggcellentImposter"
#define SERVICE_UUID "19B10000-E8F2-537E-4F6C-D104768A1214"
#define DATA_CHAR_ID "19B10001-E8F2-537E-4F6C-D104768A1214"
#define ID_CHAR_ID "19B10002-E8F2-537E-4F6C-D104768A1214"

#define NICLA_ID "N6"
#define CODE_VERSION "1.0.0"

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

BLEService eggService(SERVICE_UUID);
BLECharacteristic dataEggCharacteristic(DATA_CHAR_ID, BLERead | BLEWrite | BLENotify, sizeof(EggStateStruct), true);
BLECharacteristic idEggCharacteristic(ID_CHAR_ID, BLERead, NICLA_ID);
BLECharacteristic versionEggCharacteristic(ID_CHAR_ID, BLERead, CODE_VERSION);

// Sensor Stuff
Sensor temperature(SENSOR_ID_TEMP);
float temperatureValue = 0;

const unsigned long SENSOR_UPDATE_PERIOD = 1 * 1000; // 1 seecond 

SensorQuaternion quaternion(SENSOR_ID_RV);

SensorBSEC bsec(SENSOR_ID_BSEC);


#define ledPin LED_BUILTIN

unsigned long last_update;


void setup() {

  Serial.begin(115200);

  while (!Serial);

  BHY2.begin();
  temperature.begin();
  quaternion.begin();
  bsec.begin();


  // set LED pin to output mode

  pinMode(ledPin, OUTPUT);
  pinMode(A0, INPUT);
  pinMode(A1, INPUT);


  // begin initialization

  if (!BLE.begin()) {

    Serial.println("starting Bluetooth Low Energy module failed!");


    while (1);

  }


  // set advertised local name and service UUID:

  BLE.setLocalName(SERVICE_NAME);
  BLE.setAdvertisedService(eggService);
  eggService.addCharacteristic(dataEggCharacteristic);
  eggService.addCharacteristic(idEggCharacteristic);
  eggService.addCharacteristic(versionEggCharacteristic);


  // add service

  BLE.addService(eggService);


  // start advertising

  BLE.advertise();


  Serial.println("Setup Completed");

  updateSensors();

  // digitalWrite(PHOTO1_ENABLE_PIN, HIGH);

}

float average_val = 0.5;
void updateSensors()
{
  BHY2.update();

  state.temp = temperature.value();

  state.humidity = bsec.comp_h();

  state.qx = quaternion.x();
  state.qy = quaternion.y();
  state.qz = quaternion.z();
  state.qw = quaternion.w();

  analogRead(A0);
  analogRead(A0);
  state.photo1 = average_val * analogRead(A0) + (1-average_val) * state.photo1;

  delay(10);

  analogRead(A1);
  analogRead(A1);
  state.photo2 = average_val * analogRead(A1) + (1-average_val) * state.photo2;

  Serial.print("min:0\nmax:1024\n");
  Serial.print("photo1:");
  Serial.println(state.photo1);
  Serial.print("photo2:");
  Serial.println(state.photo2);


  last_update = millis();

  dataEggCharacteristic.writeValue((void*) &state, sizeof(EggStateStruct));

  // Serial.println("Updated Sensors");
}

void loop() {
  // listen for Bluetooth® Low Energy peripherals to connect:

  BLEDevice central = BLE.central();


  // if a central is connected to peripheral:

  unsigned long time = millis();
  if (time - last_update > SENSOR_UPDATE_PERIOD)
    updateSensors();

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