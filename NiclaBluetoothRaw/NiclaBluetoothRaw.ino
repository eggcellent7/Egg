#include "Nicla_System.h"
#include "Arduino_BHY2.h"
#include <ArduinoBLE.h>
#include "Wire.h"

#include <string.h>

#define SERVICE_NAME "EggcellentImposter2"
#define SERVICE_UUID "19B10000-E8F2-537E-4F6C-D104768A1214"
#define DATA_CHAR_ID "19B10001-E8F2-537E-4F6C-D104768A1214"
#define ID_CHAR_ID "19B10002-E8F2-537E-4F6C-D104768A1214"
#define START_TRANSFER_CHAR_ID "19B10003-E8F2-537E-4F6C-D104768A1214"
#define VERSION_CHAR_ID "19B10004-E8F2-537E-4F6C-D104768A1214"
#define FLOAT_COMMAND_CHAR_ID "19B10005-E8F2-537E-4F6C-D104768A1214"

#define DEFAULT_NICLA_ID "UND"
#define MAX_NICLA_ID_LENGTH 15

#define CODE_VERSION "1.0.0"

#define BLE_TIMEOUT (20*1000)

#define DEBUG_MODE
#define OVERWRITE_PERIOD

char *nicla_id;

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

typedef struct SettingsStruct {
  float temperature_calibration;
  float humidity_calibration;
  float sensor_update_period;
  float cal_qx;
  float cal_qy;
  float cal_qz;
  float cal_qw;
} Settings;

typedef struct FloatCommandStruct {
  uint8_t command_id;
  float command_value;
} FloatCommand;

EggState state;
Settings settings;

BLEService eggService(SERVICE_UUID);
BLECharacteristic dataEggCharacteristic(DATA_CHAR_ID, BLERead | BLENotify, sizeof(EggStateStruct), true);
BLECharacteristic idEggCharacteristic(ID_CHAR_ID, BLERead | BLEWrite, (size_t) MAX_NICLA_ID_LENGTH);
BLECharacteristic versionEggCharacteristic(VERSION_CHAR_ID, BLERead, CODE_VERSION);
BLEByteCharacteristic startTransferEggCharacteristic(START_TRANSFER_CHAR_ID, BLERead | BLEWrite);
BLECharacteristic floatCommandCharacteristic(FLOAT_COMMAND_CHAR_ID, BLEWrite, sizeof(FloatCommandStruct), true);

// Sensor Classes
Sensor temperature(SENSOR_ID_TEMP);
SensorQuaternion quaternion(SENSOR_ID_RV);
SensorBSEC bsec(SENSOR_ID_BSEC);
Sensor humidity(SENSOR_ID_HUM_WU);

float raw_temp;
float raw_humidity;

float raw_qx;
float raw_qy;
float raw_qz;
float raw_qw;

int in_caught_state = 0;

BLEDevice central;

bool needs_shutdown = false;

// To avoid millis() wrapping messing things up
unsigned long time_since(unsigned long current, unsigned long last)
{
  return current>=last? (current - last):(ULONG_MAX - last + current);
}

void printSettings()
{
  #ifdef DEBUG_MODE
  Serial.print("temperature_calibration: ");
  Serial.println(settings.temperature_calibration);

  Serial.print("humidity_calibration: ");
  Serial.println(settings.humidity_calibration);

  Serial.print("sensor_update_period: ");
  Serial.println(settings.sensor_update_period); 

  
  #endif
}

void print_state()
{
  #ifdef DEBUG_MODE
  Serial.print("Battery: ");
  Serial.println(state.battery);

  Serial.print("qx: ");
  Serial.println(state.qx);

  Serial.print("qy: ");
  Serial.println(state.qy);

  Serial.print("qz: ");
  Serial.println(state.qz);

  Serial.print("qw: ");
  Serial.println(state.qw);

  Serial.print("Temperature: ");
  Serial.println(state.temp);

  Serial.print("Humidity: ");
  Serial.println(state.humidity);

  Serial.print("Photo1: ");
  Serial.println(state.photo1);

  Serial.print("Photo2: ");
  Serial.println(state.photo2);

  
  #endif
}

void set_default_settings()
{
  // Set default Settings
  settings.temperature_calibration = 0;
  settings.humidity_calibration = 0;
  settings.cal_qx = 0;
  settings.cal_qy = 0;
  settings.cal_qz = 0;
  settings.cal_qw = 1;
  settings.sensor_update_period = 5 * 1000;

  #ifdef DEBUG_MODE
  Serial.println("set to default settings");
  #endif
}


void set_default_nicla_id()
{
  // Need to shove into malloc so I can free when needed
  char * temp_nicla_id = DEFAULT_NICLA_ID;
  nicla_id = (char*) malloc( ( strlen( DEFAULT_NICLA_ID ) + 1 ) * sizeof(char) );
  strcpy(nicla_id, temp_nicla_id);
}

bool need_to_poll = false;

void transferCharacteristicWritten(BLEDevice central, BLECharacteristic characteristic) {
  Serial.println("Serial Written");
  // pollSensors();
  need_to_poll = true;
}

void turnOnBLE()
{
  if (!BLE.begin()) {

    #ifdef DEBUG_MODE

    Serial.println("starting Bluetooth Low Energy module failed!");

    #endif

    shutdown();
  }

  BLE.setLocalName(SERVICE_NAME);
  BLE.setAdvertisedService(eggService);
  eggService.addCharacteristic(dataEggCharacteristic);
  eggService.addCharacteristic(idEggCharacteristic);
  //eggService.addCharacteristic(versionEggCharacteristic);
  eggService.addCharacteristic(startTransferEggCharacteristic);
  // eggService.addCharacteristic(floatCommandCharacteristic);


  startTransferEggCharacteristic.setEventHandler(BLEWritten, transferCharacteristicWritten);

  // add service

  BLE.addService(eggService);


  // start advertising

  BLE.advertise();
}

const int TEMPERATURE_SCALE = 50;
const int HUMIDITY_SCALE = 50;
const int QUATERNION_SCALE = 32767;
const int BATTERY_SCALE = 100;

float average_val = 0.5;
void updateSensors()
{
  // Gathering Raw data
  raw_temp = temperature.value();
  raw_humidity = humidity.value();

  raw_qx = quaternion.x();
  raw_qy = quaternion.y();
  raw_qz = quaternion.z();
  raw_qw = quaternion.w();

  analogRead(A0);
  analogRead(A0);
  int photo1 = analogRead(A0);

  analogRead(A1);
  analogRead(A1);
  int photo2 = analogRead(A1);

  float battery = nicla::getCurrentBatteryVoltage();

  // Applying Calibration
  state.temp     = (short) ((raw_temp + settings.temperature_calibration) * TEMPERATURE_SCALE);
  state.humidity = (short) ((raw_humidity + settings.humidity_calibration) * HUMIDITY_SCALE);
  state.qx       = (short) (raw_qx * QUATERNION_SCALE);
  state.qy       = (short) (raw_qy * QUATERNION_SCALE);
  state.qz       = (short) (raw_qz * QUATERNION_SCALE);
  state.qw       = (short) (raw_qw * QUATERNION_SCALE);
  state.photo1   = (short) photo1;
  state.photo2   = (short) photo2;
  state.battery  = (short) (battery * BATTERY_SCALE);
}

void pollSensors()
{
  #ifdef DEBUG_MODE
  Serial.println("Started polling");
  #endif

  BHY2.begin(NICLA_I2C);

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
    {
      #ifdef DEBUG_MODE
      Serial.println("Polling timeout");
      #endif

      shutdown();
    }
      
  }

  #ifdef DEBUG_MODE
  Serial.print("Time took:");
  Serial.println(millis() - t);
  #endif

  updateSensors();

  temperature.end();
  quaternion.end();
  humidity.end();

  int result = dataEggCharacteristic.writeValue(&state, sizeof(EggStateStruct));
  //int result = dataEggCharacteristic.writeValue(5);

  #ifdef DEBUG_MODE
  Serial.print("Write Result:");
  Serial.println(result);
  print_state();
  #endif
}

void shutdown()
{
  #ifdef DEBUG_MODE
  Serial.println("Shutting Down");
  #endif

  digitalWrite(P0_16, LOW);  // turn off sensor hub "probably"

  central.disconnect();
  BLE.disconnect();
  BLE.end();
  NVIC_SystemReset();
} 

void setup() {

  digitalWrite(P0_16, LOW);  // turn off sensor hub "probably"
  BLE.end();

  // Serial Begin
  #ifdef DEBUG_MODE
  Serial.begin(115200);
  while (!Serial);
  Serial.println("Wokeup");
  #endif

  // initFileSystem();

  

  turnOnBLE();

  unsigned long BLE_START = millis();

  while(true)
  {
    delay(10);
    central = BLE.central();

    if (time_since(millis(), BLE_START) > BLE_TIMEOUT)
    {
      #ifdef DEBUG_MODE
      Serial.println("Connection Timeout");
      #endif

      shutdown();
    }

    if (central)
      break;
  }

  BLE_START = millis();

  #ifdef DEBUG_MODE
  Serial.println("Connected");
  #endif

  // while the central is still connected to peripheral:
  while (central.connected()) {

    if (need_to_poll)
    {
      need_to_poll = false;
      // dataEggCharacteristic.writeValue(5);
      pollSensors();
    }

    if (time_since(millis(), BLE_START) > BLE_TIMEOUT)
    {
      #ifdef DEBUG_MODE
      Serial.println("BLE Timeout");
      #endif

      shutdown();
    }

    if (needs_shutdown) {
      unsigned long shutdown_start = millis();
      while (central.connected()) {
        if (time_since(millis(), shutdown_start) > 10000)
          shutdown();
        delay(1);
      }

    }
      
 }

 #ifdef DEBUG_MODE
 Serial.println("Disconnected");
 #endif
}

void loop() {
  #ifdef DEBUG_MODE
  Serial.println("Made it into loop, Probably disconnected");
  #endif

  delay(1000);

  shutdown();
}
