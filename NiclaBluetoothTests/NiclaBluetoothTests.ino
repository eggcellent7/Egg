#include "Nicla_System.h"
#include "Arduino_BHY2.h"
#include <ArduinoBLE.h>
#include "Wire.h"

#include <BlockDevice.h>
#include <Dir.h>
#include <File.h>
#include <FileSystem.h>
#include <LittleFileSystem.h>

#define SERVICE_NAME "EggcellentImposter"
#define SERVICE_UUID "19B10000-E8F2-537E-4F6C-D104768A1214"
#define DATA_CHAR_ID "19B10001-E8F2-537E-4F6C-D104768A1214"
#define ID_CHAR_ID "19B10002-E8F2-537E-4F6C-D104768A1214"
#define START_TRANSFER_CHAR_ID "19B10003-E8F2-537E-4F6C-D104768A1214"
#define VERSION_CHAR_ID "19B10004-E8F2-537E-4F6C-D104768A1214"
#define FLOAT_COMMAND_CHAR_ID "19B10005-E8F2-537E-4F6C-D104768A1214"

#define MAX_NICLA_ID_LENGTH 15

#define CODE_VERSION "1.0.0"

// File system stuff
constexpr auto userRoot { "fs" }; // The name of the root of the filesystem
mbed::BlockDevice* spif; // The SPIF Block Device
mbed::LittleFileSystem fs { userRoot }; // The LittleFS filesystem

constexpr auto nicla_id_filename { "nicla_id" };
constexpr auto settings_filename { "settings" };

char nicla_id[MAX_NICLA_ID_LENGTH];

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
  float ble_timeout;
  float polling_delay;
} Settings;

typedef struct FloatCommandStruct {
  int command_id;
  float command_value;
} FloatCommand;

EggState state;
Settings settings;

BLEService eggService(SERVICE_UUID);
BLECharacteristic dataEggCharacteristic(DATA_CHAR_ID, BLERead | BLENotify, sizeof(EggStateStruct), true);
BLECharacteristic idEggCharacteristic(ID_CHAR_ID, BLERead | BLEWrite, "");
BLECharacteristic versionEggCharacteristic(VERSION_CHAR_ID, BLERead, CODE_VERSION);
BLECharacteristic startTransferEggCharacteristic(START_TRANSFER_CHAR_ID, BLEWrite, 0);
BLECharacteristic floatCommandCharacteristic(FLOAT_COMMAND_CHAR_ID, BLEWrite, sizeof(FloatCommandStruct), true);

// Sensor Classes
Sensor temperature(SENSOR_ID_TEMP);
SensorQuaternion quaternion(SENSOR_ID_RV);
SensorBSEC bsec(SENSOR_ID_BSEC);
Sensor humidity(SENSOR_ID_HUM_WU);

float raw_temp
float raw_humidity;

float raw_qx;
float raw_qy;
float raw_qz;
float raw_qw;

int in_caught_state = 0;

BLEDevice central;

// To avoid millis() wrapping messing things up
unsigned long time_since(unsigned long current, unsigned long last)
{
  return current>=last? (current - last):(ULONG_MAX - last + current);
}

void write_settings()
{
  // Open with create
  mbed::File settings_file;
  settings_file.open(&fs, settings_filename, O_WRONLY | O_TRUNC | O_CREAT);

  settings_file.write(&settings, sizeof(SettingsStruct));

  settings_file.close();
}

void initFileSystem()
{
  // Get core-wide instance of SPIF Block Device
  spif = mbed::BlockDevice::get_default_instance();
  spif->init();

  // Mount the filesystem
  int err = fs.mount(spif);
  if (err) {
      err = fs.reformat(spif);
      Serial.print("Error mounting file system: ");
      Serial.println(err);
      while (true)
          ;
  }

  // Checking for setting files
  mbed::File settings_file;
  err = settings_file.open(&fs, settings_filename, O_RDONLY | O_TRUNC);
  if (err) {
      Serial.print("Error opening file for reading: Probably doesnt exist");
      Serial.println(err);

      // Set default Settings
      settings.temperature_calibration = 0;
      settings.humidity_calibration = 0;
      settings.sensor_update_period;
      settings.cal_qx = 0;
      settings.cal_qy = 0;
      settings.cal_qz = 0;
      settings.cal_qw = 1;
      settings.ble_timeout = 20 * 1000;
      settings.polling_delay = 60 * 1000;

      return;
  } else {
    // Read file

    // Probably works idk
    settings_file.read(&settings, sizeof(SettingsStruct));
  }

  settings_file.close();
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
  eggService.addCharacteristic(floatCommandCharacteristic);

  // startTransferEggCharacteristic.setEventHandler(BLEWritten, [](BLEDevice central, BLECharacteristic characteristic) {
  //   start_transfer = 1;
  // });


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

  dataEggCharacteristic.writeValue((void*) &state, sizeof(EggStateStruct));
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

  // Serial Begin
  Serial.begin(9600);
  while (!Serial);
  Serial.println("Wokeup");

  initFileSystem();

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
    if (floatCommandCharacteristic.written())
    {
      FloatCommand f_command; = *(FloatCommand*)(floatCommandCharacteristic.value());
      
      switch (f_command.command_id) 
      {
        // Calibrate Temperature
        case 0:
          float offset = f_command.command_value - raw_temp;
          settings.temperature_calibration = offset;
          break;
        // Calibrate Humidity
        case 1:
          float offset = f_command.command_value - raw_humidity;
          settings.humidity_calibration = offset;
          break;
        // Set orientation as up
        case 2:
      }
    }

    if (time_since(millis(), BLE_START) > BLE_TIMEOUT)
      shutdown();


    if (startTransferEggCharacteristic.written())
    {
      switch((int) startTransferEggCharacteristic.value())
      {
        // Poll sensors, send data, and shutdown
        case 1:
          pollSensors();
          central.disconnect();
          shutdown();
          break;

        // Go into a caught state to listen to setting changes and stuff
        case 2:
          in_caught_state = 1;
          pollSensors();
          break;

        // Get outa caught state and shutdown
        case 3:
          write_settings();
          delay(100);
          shutdown();
          break;
      }
    }
 }
}

void loop() {
  shutdown();
}
