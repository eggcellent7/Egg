#include "NimBLEDevice.h"
#include <vector>

#define SERVICE_NAME "EggcellentImposter"
#define SERVICE_UUID "19B10000-E8F2-537E-4F6C-D104768A1214"
#define CHAR_ID "EGGD"

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



void setup() {
  Serial.begin(115200);
  
  Serial.println("The device started, now you can pair it with bluetooth!");

  // initialize the Bluetooth® Low Energy hardware

  NimBLEDevice::init("");

  NimBLEScan *pScan = NimBLEDevice::getScan();
  NimBLEScanResults results = pScan->getResults(10 * 1000);

  NimBLEUUID serviceUuid(SERVICE_UUID);
 
  for (int i = 0; i < results.getCount(); i++) {
      const NimBLEAdvertisedDevice *device = results.getDevice(i);
      
      if (device->isAdvertisingService(serviceUuid)) {
        NimBLEClient *pClient = NimBLEDevice::createClient();

        if (!pClient) { // Make sure the client was created
          break;
        }
        
        if (pClient->connect(&device)) {
            //success
            Serial.println("Connected to device");
        } else {
            // failed to connect
            Serial.println("Failed to connect to device");
        }
      }
  }



  Serial.println("Bluetooth Low Energy Central - LED control");

  Serial.println("Scan start");
  
  Serial.println("Scan block end");
}

void connectToPeripheral(BLEDevice peripheral) {

  // connect to the peripheral

  Serial.println("Connecting ...");


  if (peripheral.connect()) {

    Serial.println("Connected");

  } else {

    Serial.println("Failed to connect!");

    return;

  }


  // discover peripheral attributes

  Serial.println("Discovering attributes ...");

  if (peripheral.discoverAttributes()) {

    Serial.println("Attributes discovered");

  } else {

    Serial.println("Attribute discovery failed!");

    peripheral.disconnect();

    return;

  }


  // retrieve the Egg characteristic

  BLECharacteristic characteristic = peripheral.characteristic(CHAR_ID);


  if (!characteristic) {

    Serial.println("Peripheral does not have Egg characteristic!");

    peripheral.disconnect();

    return;

  } else if (!characteristic.canRead()) {

    Serial.println("Peripheral does not have a readable egg characteristic!");

    peripheral.disconnect();

    return;

  }

  return;


  while (peripheral.connected()) {

    // while the peripheral is connected


    // read the button pin

    int buttonState = false;


    if (true) {

      // button changed


      if (buttonState) {

        Serial.println("button pressed");


        // button is pressed, write 0x01 to turn the LED on

        ledCharacteristic.writeValue((byte)0x01);

      } else {

        Serial.println("button released");


        // button is released, write 0x00 to turn the LED off

        ledCharacteristic.writeValue((byte)0x00);

      }

    }

  }


  Serial.println("Peripheral disconnected");

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

  BLEDevice peripheral = BLE.available();


  if (peripheral) {

    // discovered a peripheral, print out address, local name, and advertised service

    Serial.print("Found ");

    Serial.print(peripheral.address());

    Serial.print(" '");

    Serial.print(peripheral.localName());

    Serial.print("' ");

    Serial.print(peripheral.advertisedServiceUuid());

    Serial.println();


    connectToPeripheral(peripheral);
  }

  delay(500);

  Serial.println("Looped");

  
}