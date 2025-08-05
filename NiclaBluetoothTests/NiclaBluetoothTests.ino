#include "Nicla_System.h"
#include "Arduino_BHY2.h"
#include <ArduinoBLE.h>
#include "Wire.h"

#include <string.h>

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

#define DEFAULT_NICLA_ID "UNDEFINED_ID"
#define MAX_NICLA_ID_LENGTH 15

#define CODE_VERSION "1.0.0"

#define DEBUG_MODE

// File system stuff
constexpr auto userRoot { "fs" }; // The name of the root of the filesystem
mbed::BlockDevice* spif; // The SPIF Block Device
mbed::LittleFileSystem fs { userRoot }; // The LittleFS filesystem

constexpr auto nicla_id_filename { "/nicla_id.txt" };
constexpr auto settings_filename { "/settings.txt" };

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
  float ble_timeout;
} Settings;

typedef struct FloatCommandStruct {
  int command_id;
  float command_value;
} FloatCommand;

EggState state;
Settings settings;

BLEService eggService(SERVICE_UUID);
BLECharacteristic dataEggCharacteristic(DATA_CHAR_ID, BLERead | BLENotify, sizeof(EggStateStruct), true);
BLECharacteristic idEggCharacteristic(ID_CHAR_ID, BLERead | BLEWrite, (size_t) MAX_NICLA_ID_LENGTH);
BLECharacteristic versionEggCharacteristic(VERSION_CHAR_ID, BLERead, CODE_VERSION);
BLECharacteristic startTransferEggCharacteristic(START_TRANSFER_CHAR_ID, BLEWrite, sizeof(int), true);
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

  Serial.print("ble_timeout: ");
  Serial.println(settings.ble_timeout); 

  
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
  settings.ble_timeout = 20 * 1000;
  settings.sensor_update_period = 5 * 1000;

  #ifdef DEBUG_MODE
  Serial.println("set to default settings");
  #endif
}

void write_settings()
{
  // Handle Settings
  // Open with create
  mbed::File settings_file;
  settings_file.open(&fs, settings_filename, O_WRONLY | O_TRUNC | O_CREAT);

  settings_file.write(&settings, sizeof(SettingsStruct));

  settings_file.close();

  // Handle Nicla ID
  // Open with create
  mbed::File nicla_id_file;
  nicla_id_file.open(&fs, nicla_id_filename, O_WRONLY | O_TRUNC | O_CREAT);

  // Writing string length
  int nicla_id_length = strlen(nicla_id) + 1;
  nicla_id_file.write(&nicla_id_length, sizeof(int));

  // Writing the string
  nicla_id_file.write(nicla_id, nicla_id_length * sizeof(char));

  nicla_id_file.close();
}

void set_default_nicla_id()
{
  // Need to shove into malloc so I can free when needed
  char * temp_nicla_id = DEFAULT_NICLA_ID;
  nicla_id = (char*) malloc( ( strlen( DEFAULT_NICLA_ID ) + 1 ) * sizeof(char) );
  strcpy(nicla_id, temp_nicla_id);
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
      #ifdef DEBUG_MODE
      Serial.print("Error mounting file system: ");
      Serial.println(err);
      #endif
      while (true)
          ;
  }

  // Checking for setting file
  mbed::File settings_file;
  err = settings_file.open(&fs, settings_filename, O_RDONLY);
  if (err) {
      #ifdef DEBUG_MODE
      Serial.print("Error opening settings_file for reading: Probably doesnt exist");
      Serial.println(err);
      #endif

      set_default_settings();
  } else {
    // Read file

    // Probably works idk
    settings_file.read(&settings, sizeof(SettingsStruct));

    // Checking for errors
    if (settings.ble_timeout == 0 || settings.sensor_update_period == 0)
    {
      printSettings();
      set_default_settings();
    }
      
  }

  settings_file.close();

  printSettings();

  // Reading nicla id
  // Checking for nicla_id file
  mbed::File nicla_id_file;
  err = nicla_id_file.open(&fs, nicla_id_filename, O_RDONLY);
  if (err) {
      #ifdef DEBUG_MODE
      Serial.print("Error opening nicla_id_file for reading: Probably doesnt exist");
      Serial.println(err);
      #endif

      set_default_nicla_id();
  } else {
    // Read file

    // Getting String Length
    int str_length;
    nicla_id_file.read(&str_length, sizeof(int)); // String length shouldnt be too long

    #ifdef DEBUG_MODE
    Serial.print("Nicla ID Length: ");
    Serial.println(str_length);
    #endif

    if (str_length == 0)
    {
      set_default_nicla_id(); 
    } else {
      nicla_id = (char*) malloc(str_length * sizeof(char));

      nicla_id_file.read(nicla_id, str_length);
    }
  }

  idEggCharacteristic.setValue(nicla_id);

  #ifdef DEBUG_MODE
  Serial.print("Nicla ID: ");
  Serial.println(nicla_id);
  #endif
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
  eggService.addCharacteristic(floatCommandCharacteristic);

  startTransferEggCharacteristic.setEventHandler(BLEWritten, [](BLEDevice central, BLECharacteristic characteristic) {

    // TODO: Make this only use one byte instead of 4
    int value = *((int*)startTransferEggCharacteristic.value());

    #ifdef DEBUG_MODE
    Serial.print("Command Event: ");
    Serial.println(value);
    #endif

    switch(value)
    {
      // Poll sensors, send data, and shutdown
      case 1:
        pollSensors();

        #ifdef DEBUG_MODE
        Serial.println("Finished Polling, will now shutdown");
        #endif

        central.disconnect();
        BLE.end();
        delay(100);
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

        #ifdef DEBUG_MODE
        Serial.println("Got outa catch state");
        #endif

        delay(100); // not sure if this is nessesary
        shutdown();
        break;
    }
  });

  floatCommandCharacteristic.setEventHandler(BLEWritten, [](BLEDevice central, BLECharacteristic characteristic) {
    FloatCommand f_command = *(FloatCommand*)(floatCommandCharacteristic.value());

    #ifdef DEBUG_MODE
    Serial.print("Command ID: ");
    Serial.println(f_command.command_id);
    #endif
      
    float offset;
    switch (f_command.command_id) 
    {
      // Calibrate Temperature
      case 0:
        offset = f_command.command_value - raw_temp;
        settings.temperature_calibration = offset;
        break;
      // Calibrate Humidity
      case 1:
        offset = f_command.command_value - raw_humidity;
        settings.humidity_calibration = offset;
        break;
      // Set orientation as up
      case 2:
        break;
    }
  });


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

  dataEggCharacteristic.writeValue((void*) &state, sizeof(EggStateStruct));
}

void shutdown()
{
  #ifdef DEBUG_MODE
  Serial.println("Shutting Down");
  #endif

  digitalWrite(P0_16, LOW);  // turn off sensor hub
  NVIC_SystemReset();
} 

void setup() {

  digitalWrite(P0_16, LOW);  // turn off sensor hub
  BLE.end();

  // Serial Begin
  #ifdef DEBUG_MODE
  Serial.begin(115200);
  while (!Serial);
  Serial.println("Wokeup");
  #endif

  initFileSystem();

  delay((int) settings.sensor_update_period);

  turnOnBLE();

  // Serial.println("BLE On");

  // Attempt to keep reconnecting until it works
  unsigned long BLE_START = millis();

  while(true)
  {
    delay(10);
    central = BLE.central();

    if (time_since(millis(), BLE_START) > settings.ble_timeout)
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

    if (time_since(millis(), BLE_START) > settings.ble_timeout)
    {
      #ifdef DEBUG_MODE
      Serial.println("BLE Timeout");
      #endif

      shutdown();
    }
 }

 #ifdef DEBUG_MODE
 Serial.println("Disconnected");
 #endif
}

void loop() {
  #ifdef DEBUG_MODE
  Serial.println("Somehow made it to loop, HOWWW?");
  #endif

  shutdown();
}
