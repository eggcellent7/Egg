#include "Nicla_System.h"
#include "Arduino_BHY2.h"
#include <ArduinoBLE.h>
#include "Wire.h"
#include "nrf.h"

#define SERVICE_NAME "EggcellentImposter"
#define SERVICE_UUID "19B10000-E8F2-537E-4F6C-D104768A1214"
#define DATA_CHAR_ID "19B10001-E8F2-537E-4F6C-D104768A1214"
#define ID_CHAR_ID "19B10002-E8F2-537E-4F6C-D104768A1214"
#define START_TRANSFER_CHAR_ID "19B10003-E8F2-537E-4F6C-D104768A1214"
#define VERSION_CHAR_ID "19B10004-E8F2-537E-4F6C-D104768A1214"

#define NICLA_ID "N3"
#define CODE_VERSION "1.0.0"

const unsigned long SENSOR_UPDATE_PERIOD = 300 * 1000; // 5 minutes
const unsigned long BLE_TIMEOUT = (20*1000);

typedef struct EggStateStruct {
  short battery;
  short qx;
  short qy;
  short qz;
  short qw;
  short temp;
  short humidity;
  short photo1;
  short photo2;
} EggState;

EggState state;

BLEService eggService(SERVICE_UUID);
BLECharacteristic dataEggCharacteristic(DATA_CHAR_ID, BLERead | BLENotify, sizeof(EggStateStruct), true);
BLECharacteristic idEggCharacteristic(ID_CHAR_ID, BLERead, NICLA_ID);
BLECharacteristic versionEggCharacteristic(VERSION_CHAR_ID, BLERead, CODE_VERSION);
BLECharacteristic startTransferEggCharacteristic(START_TRANSFER_CHAR_ID, BLEWrite, 0);

// Sensor Stuff
Sensor temperature(SENSOR_ID_TEMP);
float temperatureValue = 0;

SensorQuaternion quaternion(SENSOR_ID_RV);
SensorBSEC bsec(SENSOR_ID_BSEC);
Sensor humidity(SENSOR_ID_HUM_WU);

int start_transfer = 0;

BLEDevice central;

// To avoid millis() wrapping messing things up
unsigned long time_since(unsigned long current, unsigned long last)
{
  return current>=last? (current - last):(ULONG_MAX - last + current);
}

void turnOnBLE()
{
  if (!BLE.begin()) {
    // Serial.println("starting Bluetooth Low Energy module failed!");
    while (1);
  }

  BLE.setLocalName(SERVICE_NAME);
  BLE.setAdvertisedService(eggService);
  eggService.addCharacteristic(dataEggCharacteristic);
  eggService.addCharacteristic(idEggCharacteristic);
  //eggService.addCharacteristic(versionEggCharacteristic);
  eggService.addCharacteristic(startTransferEggCharacteristic);

  startTransferEggCharacteristic.setEventHandler(BLEWritten, [](BLEDevice central, BLECharacteristic characteristic) {
    start_transfer = 1;
  });


  // add service

  BLE.addService(eggService);


  // start advertising

  BLE.advertise();
}

void turnOffBLE()
{
  BLE.stopAdvertise();
  BLE.disconnect();
  BLE.end();
}

float average_val = 0.5;
void updateSensors()
{
  state.temp = (short) (temperature.value() * 50);

  state.humidity = (short) (humidity.value() * 50);

  state.qx = (short) (quaternion.x() * 32767);
  state.qy = (short) (quaternion.y() * 32767);
  state.qz = (short) (quaternion.z() * 32767);
  state.qw = (short) (quaternion.w() * 32767);

  analogRead(A0);
  analogRead(A0);
  state.photo1 = analogRead(A0);

  analogRead(A1);
  analogRead(A1);
  state.photo2 = analogRead(A1);

  state.battery = nicla::getCurrentBatteryVoltage() * 100;
}

void pollSensors()
{
  BHY2.begin();

  pinMode(A0, INPUT);
  pinMode(A1, INPUT);

  temperature.begin(10);
  quaternion.begin(10);
  humidity.begin(10);

  unsigned long t = millis();
  while (temperature.value() == 0.0 || humidity.value() == 0 || quaternion.x() == 0)
  {
    BHY2.update();
    central.connected();

    if (time_since(millis(), t) > 5*1000)
      shutdown();
  }
  // Serial.print("Time took:");
  // Serial.println(millis() - t);



  updateSensors();

  temperature.end();
  quaternion.end();
  humidity.end();
}

void shutdown()
{
  BLE.end();
  digitalWrite(P0_16, LOW);  // turn off sensor hub
  NVIC_SystemReset();
}

void setup() {

  digitalWrite(P0_16, LOW);  // turn off sensor hub
  BLE.end();
  // Serial.println("Wokeup");

  delay(SENSOR_UPDATE_PERIOD);

  turnOnBLE();

  // Serial.println("BLE On");

  // Attempt to keep reconnecting until it works
  unsigned long BLE_START = millis();

  while(true)
  {
    delay(10);
    central = BLE.central();

    if (time_since(millis(), BLE_START) > BLE_TIMEOUT)
      shutdown();

    if (central)
      break;
  }

  BLE_START = millis();

  // while the central is still connected to peripheral:
  while (central.connected()) {
    if (time_since(millis(), BLE_START) > BLE_TIMEOUT)
      shutdown();
      

    if (!start_transfer)
      continue;

    pollSensors();
    dataEggCharacteristic.writeValue((void*) &state, sizeof(EggStateStruct));
    central.disconnect();
    shutdown();
    break;
  }
}

void loop() {
  shutdown();
}