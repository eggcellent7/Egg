void setup() {
  // put your setup code here, to run once:
  Serial.begin(9600);
  Serial.println("hello world");
  pinMode(A0, INPUT);
}

void loop() {
  // put your main code here, to run repeatedly:
  int val = analogRead(A0); 
  float voltage = (val/1024.0)*5; 
  Serial.println(voltage);
}
