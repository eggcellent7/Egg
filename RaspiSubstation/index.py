import asyncio
import struct
import base64
from bleak import BleakScanner
from bleak import BleakClient
import time
import signal
import sys
import os
import http.server
import ssl
import json
from dotenv import load_dotenv
import threading

load_dotenv()


SERVICE_NAME    = "EggcellentImposter"
SERVICE_UUID    = "19B10000-E8F2-537E-4F6C-D104768A1214"
DATA_CHAR_ID    = "19B10001-E8F2-537E-4F6C-D104768A1214"
ID_CHAR_ID      = "19B10002-E8F2-537E-4F6C-D104768A1214"
START_TRANSFER_CHAR_ID = "19B10003-E8F2-537E-4F6C-D104768A1214"
VERSION_CHAR_ID = "19B10004-E8F2-537E-4F6C-D104768A1214"
FLOAT_COMMAND_CHAR_ID = "19B10005-E8F2-537E-4F6C-D104768A1214"

device_files_path = "./device_files/"

EGG_STATE_STRUCT_STR = "d h h h h h h h h h"

stopped = False

connected_addresses = set()
catches = dict()

# Data to send when the website pings
live_packets = dict()

def update_data(byte_array, service_uuid, nicla_id, address):
    # Adding timestamp as first 
    t = float(time.time())
    time_stamp_bytes = struct.pack("d", t)
    tf = struct.unpack("d", time_stamp_bytes)[0]
    byte_array = time_stamp_bytes + byte_array[:]
    byte_str = base64.b64encode(byte_array).decode("utf-8")

    with open(device_files_path + nicla_id + ".egg", "a") as f:
        f.write(byte_str + ":")
        f.close()

    # Address should always be unique
    live_packets[address] = {
        "last_connection": time.time(),
        "last_datapoint": byte_str,
        "nicla_id": nicla_id
    }

    unpacked_data = struct.unpack(EGG_STATE_STRUCT_STR, byte_array)
    print("Unpacked Data for "+nicla_id)
    print(unpacked_data)



async def connect_to_device(device, advertising_data):
    connected_addresses.add(device.address)
    print("Connecting to address " + device.address)
    
    try:
        async with BleakClient(device, timeout = 40) as client:
            # WARNING Needs error handling, will drop connection if errored and silently
            print("Connected")

            nicla_id = (await client.read_gatt_char(ID_CHAR_ID)).decode("utf-8")

            print("Nicla ID: "+nicla_id)

            async def notify(sender, data):
                update_data(data, advertising_data.service_uuids[0], nicla_id, device.address)

            await client.start_notify(DATA_CHAR_ID, notify)

            print("Finished Notify")

            # If a setting/calibration was requested then attempt to catch the device 
            if device.address in catches:
                barray = struct.pack("i", 2)
                print("Start Transfer");
                print(catches)
                await client.write_gatt_char(START_TRANSFER_CHAR_ID, barray, True)

                time.sleep(0.1)

                # Doing all the setting changes
                for key in catches[device.address]:
                    command_id = None
                    if key == "calibrate_humidity":
                        command_id = 1
                    elif key == "calibrate_temperature":
                        command_id = 0
                    elif key == "polling_speed":
                        command_id = 2
                    elif key == "calibrate_orientation":
                        command_id = 3
                    elif key == "address" or  key == "id":
                       continue 
                    else:
                        print("Invalid command key")
                        print(key) 
                        continue

                    print("Writing key"+key)
                        

                    barray = struct.pack("B f", command_id, catches[device.address][key])
                    await client.write_gatt_char(FLOAT_COMMAND_CHAR_ID, barray, True)

                    time.sleep(0.1)

                if "id" in catches[device.address]:
                    new_id = catches[device.address]["id"]+"\0"
                    print(f"New ID \"{new_id}\"");
                    await client.write_gatt_char(ID_CHAR_ID, new_id.encode("utf-8"), True)
                    time.sleep(1)

                # Release the Egg from the catch state
                barray = struct.pack("i", 3)
                print("Writing the end")
                await client.write_gatt_char(START_TRANSFER_CHAR_ID, barray, True)
                print("Started Catch")

                del catches[device.address]
            else:
                barray = struct.pack("i", 1)
                print("Started Transfer")
                await client.write_gatt_char(START_TRANSFER_CHAR_ID, barray, False)
                print("Started Polling")
                

            while (client.is_connected):
                await asyncio.sleep(1)

            print("end notify")

            connected_addresses.remove(device.address)

        print(f"Disconnected from {device.address}")
    except Exception as e:
        print(f"Failed to connect to device: {e}")
        connected_addresses.remove(device.address)
        


async def main():
    global stopped
    stop_event = asyncio.Event()

    def handle_signal(signum, frame):
        global stopped
        print(f"Received signal {signum}, shutting down…")
        stopped = True
        print("Set stopped to")
        print(stopped)
        stop_event.set()
        httpd.shutdown()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    # TODO: add something that calls stop_event.set()

    async def callback(device, advertising_data):
        if (advertising_data.local_name != SERVICE_NAME):
            return
        
        if (device.address in connected_addresses):
            return

        await connect_to_device(device, advertising_data)



    restart_count = 0
    while True:
        try:
            print("Start Scann")
            # raise ValueError('A very specific bad thing happened.')
            async with BleakScanner(callback) as scanner:
                ...
                # Important! Wait for an event to trigger stop, otherwise scanner
                # will stop immediately.
                await stop_event.wait()
                print("Stop Bleak Scan")
                stopped = True

            # scanner stops when block exits
        except Exception as e:
            # A general except block to catch any other unhandled exceptions
            print(f"An unexpected error occurred: {e}")
            print(restart_count)
            restart_count += 1
            if restart_count == 5:
                print("restart")
                stopped = True
                # os.system("systemctl restart egg_service.service")
            time.sleep(5)

        if stopped:
            break
    ...

print("Running python")

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers["Content-Length"])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode("utf-8"))
        print(post_data.decode("utf-8"))

        if self.path == "/catch":
            catches[data["address"]] = data

        self.send_response(200)
        self.end_headers()

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        # End the headers

        
        if self.path == "/ping":
            self.send_response(200)
            self.end_headers()

            # Prepare the response data
            response_data = {
                "datetime": time.time(),
                "method": "GET",
                "path": self.path,
                "eggs": live_packets,
                "saved": [f for f in os.listdir("./saved")] # Listing out saved directory so it can be downloaded
                }

            
            # Encode the response data to JSON and then to bytes
            response_bytes = json.dumps(response_data).encode('utf-8')

            # Write the response body
            self.wfile.write(response_bytes)
            print("Ping")
        elif self.path.startswith("/saved"):
            split_path = self.path.split("/")
            egg_id = split_path[2]
            filepath = "./saved/"+egg_id
            if os.path.exists(filepath):
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Disposition", f"attachment; filename={egg_id}")
                self.send_header("Content-Length", str(os.path.getsize(filepath)))
                self.end_headers()
                with open(filepath, "rb") as f:
                    while chunk := f.read(8192):
                        self.wfile.write(chunk)
            else:
                self.send_response(404)
                self.end_headers()
        


server_address = ("0.0.0.0", int(os.getenv("SERVER_PORT")))
httpd = http.server.HTTPServer(server_address, MyHandler)

def run_server():
    httpd.serve_forever()

server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()

print("Running main")

asyncio.run(main())

print("Graceful shutdown")

httpd.shutdown()
server_thread.join()
