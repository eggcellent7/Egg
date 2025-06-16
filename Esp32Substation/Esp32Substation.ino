#include "NimBLEDevice.h"
#include <vector>

#define SERVICE_NAME "EggcellentImposter"
#define SERVICE_UUID "19B10000-E8F2-537E-4F6C-D104768A1214"
#define CHAR_ID "19B10001-E8F2-537E-4F6C-D104768A1214"

#define SCAN_PERIOD (10 * 1000)

unsigned long last_scan;

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


void printEggState(EggState* state)
{
  Serial.println("Egg State:");

  Serial.print("Temperature:");
  Serial.println(state->temp);
}

void setup() {
  Serial.begin(115200);
  
  Serial.println("The device started, now you can pair it with bluetooth!");

  // initialize the Bluetooth® Low Energy hardware

  NimBLEDevice::init("");

  delay(100);

  NimBLEScan *pScan = NimBLEDevice::getScan();
  //pScan->setActiveScan(true);

  Serial.println("Scan start");

  NimBLEScanResults results = pScan->getResults(10 * 1000);

  NimBLEUUID serviceUuid(SERVICE_UUID);

  Serial.println("Scan End: Reading results");
 
  for (int i = 0; i < results.getCount(); i++) {
    Serial.println("Got the device");
      const NimBLEAdvertisedDevice *device = results.getDevice(i);
      
      if (device->isAdvertisingService(serviceUuid)) {
        NimBLEClient *pClient = NimBLEDevice::createClient();

        Serial.println("Got the device!!!!");

        if (!pClient) { // Make sure the client was created
        Serial.println("Failed to create client");
          break;
        }
        
        if (!pClient->connect(device)) {
          Serial.println("Failed to connect to device");
          continue;
        }

        //success
        Serial.println("Connected to device");

        NimBLERemoteService *pService = pClient->getService(serviceUuid);
        
        if (pService == nullptr) {
          Serial.println("PService is a null pointer");
          continue;
        }

        NimBLERemoteCharacteristic *pCharacteristic = pService->getCharacteristic(CHAR_ID);
        
        if (pCharacteristic != nullptr) {
            NimBLEAttValue value = pCharacteristic->readValue();

            EggState state = *((EggState*) value.data());
            printEggState(&state);
            // print or do whatever you need with the value
        }
        
        
      }
  }



  Serial.println("Bluetooth Low Energy Central - LED control");
  
  Serial.println("Scan block end");
}

void loop() {
  unsigned long time = millis();

  // Quick fix to prevent issues with overflow
  if (last_scan > time)
    last_scan = time;
  
  if (time - last_scan > SCAN_PERIOD) {
    last_scan = time;

    
  }

  // check if a peripheral has been discovered

  
}