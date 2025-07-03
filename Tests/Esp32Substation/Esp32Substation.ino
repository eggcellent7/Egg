#include "NimBLEDevice.h"
#include <vector>

#define SERVICE_NAME "EggcellentImposter"
#define SERVICE_UUID "19B10000-E8F2-537E-4F6C-D104768A1214"
#define CHAR_ID "19B10001-E8F2-537E-4F6C-D104768A1214"

#define SCAN_PERIOD (10 * 1000)

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

typedef struct EggDeviceStruct {
    EggState state;
    NimBLERemoteService *pService;
    NimBLEClient *pClient;
    NimBLEAdvertisedDevice *device;
    NimBLERemoteCharacteristic *pCharacteristic;
    unsigned long last_poll;

} EggDevice;


void printEggState(EggState* state)
{
  Serial.println("Egg State:");

  Serial.printf("Temperature: %f\n", state->temp);
  Serial.printf("Humidity: %f\n", state->humidity);

  Serial.printf("Rotation: x %f, y: %f, z: %f, w %f\n", 
    state->qx, state->qy, state->qz, state->qw);
}

static constexpr uint32_t scanTimeMs = 5 * 1000;

std::vector<EggDevice*> egg_devices;


class ClientCallbacks : public NimBLEClientCallbacks {
    void onConnect(NimBLEClient* pClient) override {
        Serial.printf("Connected to: %s\n", pClient->getPeerAddress().toString().c_str());
    }

    void onDisconnect(NimBLEClient* pClient, int reason) override {
        Serial.printf("%s Disconnected, reason = %d - Starting scan\n", pClient->getPeerAddress().toString().c_str(), reason);
        NimBLEDevice::getScan()->start(scanTimeMs);
    }
} clientCallbacks;

class ScanCallbacks : public NimBLEScanCallbacks {
    void onResult(const NimBLEAdvertisedDevice* advertisedDevice) override {
        //Serial.printf("Advertised Device found: %s\n", advertisedDevice->toString().c_str());
        if (advertisedDevice->haveName() && advertisedDevice->getName() == SERVICE_NAME) {
            Serial.printf("Found Our Device\n");

            NimBLEDevice::getScan()->stop();

            /** Async connections can be made directly in the scan callbacks */
            auto pClient = NimBLEDevice::createClient(advertisedDevice->getAddress());
            if (!pClient) {
                Serial.printf("Failed to create client\n");
                return;
            }

            EggDevice *egg_device = (EggDevice*) malloc(sizeof(EggDevice));
            egg_device->device = (NimBLEAdvertisedDevice*)advertisedDevice;
            egg_device->pClient = pClient;
            egg_devices.push_back(egg_device);

            Serial.println("Connection attempt");
        }
    }

    void onScanEnd(const NimBLEScanResults& results, int reason) override {
        Serial.printf("Scan Ended\n");
        //NimBLEDevice::getScan()->start(scanTimeMs);
    }
} scanCallbacks;

void setup() {
  Serial.begin(9600);
  
  Serial.println("The device started, now you can pair it with bluetooth!");

  // initialize the Bluetooth® Low Energy hardware
  NimBLEDevice::init("");  

  NimBLEScan* pScan = NimBLEDevice::getScan();
  pScan->setScanCallbacks(&scanCallbacks);
  pScan->setInterval(45);
  pScan->setWindow(45);
  pScan->setActiveScan(true);
  pScan->start(scanTimeMs);

  // NimBLERemoteCharacteristic *pCharacteristic = pService->getCharacteristic(CHAR_ID);
        
  //       if (pCharacteristic != nullptr) {
  //           NimBLEAttValue value = pCharacteristic->readValue();
  //           Serial.println("read service");

  //           EggState *state = (EggState*) value.data();
  //           printEggState(state);
  //           // print or do whatever you need with the value
  //       } else {
  //         Serial.println("pCharacteristic is a null pointer");
  //         return;
  //       }
}


void loop() {
    // delay(1000);
    // auto pClients = NimBLEDevice::getConnectedClients();
    // if (!pClients.size()) {
    //     return;
    // }

    delay(500);

    for (EggDevice* egg_device : egg_devices) {
        //Serial.println("Started");
        // if (egg_device->pService != nullptr) {
        //     return;
        // }

        Serial.println("Started2");

        if (!egg_device->pClient->connect()) { // delete attributes, async connect, no MTU exchange
            NimBLEDevice::deleteClient(egg_device->pClient);
            Serial.printf("Failed to connect\n");
            return;
        }

        Serial.println("Connection success");

        NimBLEUUID serviceUuid(SERVICE_UUID);

        NimBLERemoteService *pService = egg_device->pClient->getService(serviceUuid);

        egg_device->pService = pService;
        
        if (pService == nullptr) {
            Serial.println("PService is a null pointer");
            egg_device->pClient->disconnect();
            return;
        }

        Serial.println("P service is not null");

        NimBLERemoteCharacteristic *pCharacteristic = pService->getCharacteristic(CHAR_ID);
        
        if (pCharacteristic != nullptr) {
            NimBLEAttValue value = pCharacteristic->readValue();

            EggState *state = (EggState*) value.data();
            printEggState(state);
            // print or do whatever you need with the value
        } else {
            Serial.println("pCharacteristic is null");
        }
    }

    // NimBLEDevice::getScan()->start(scanTimeMs);
    Serial.println("Not hanging");
}