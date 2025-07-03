#include "Arduino_BHY2.h"
#include "BluetoothSerial.h"

BluetoothSerial SerialBT;


Sensor temperature(SENSOR_ID_TEMP);
  float temperatureValue = 0;


  SensorXYZ gyroscope(SENSOR_ID_GYRO);
  int16_t valueX;
  int16_t valueY;
  int16_t valueZ;

  SensorQuaternion quaternion(SENSOR_ID_RV);


  void setup(){

    Serial.begin(115200);

    BHY2.begin();
    gyroscope.begin();
    temperature.begin();

    quaternion.begin();

  }


  void loop(){

    BHY2.update();

    temperatureValue = temperature.value();


    Serial.print("Temperature :");
    Serial.println(temperatureValue);

    Serial.println(gyroscope.toString()); //Prints all the data "automatically"

    Serial.print("quaternion w :");
    Serial.println(quaternion.w());

    delay(200);

  }