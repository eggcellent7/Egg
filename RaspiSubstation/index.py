import asyncio
import struct
import base64
from bleak import BleakScanner
from bleak import BleakClient
import time
import signal
import sys

SERVICE_NAME    = "EggcellentImposter"
SERVICE_UUID    = "19B10000-E8F2-537E-4F6C-D104768A1214"
DATA_CHAR_ID    = "19B10001-E8F2-537E-4F6C-D104768A1214"
ID_CHAR_ID      = "19B10002-E8F2-537E-4F6C-D104768A1214"
START_TRANSFER_CHAR_ID = "19B10003-E8F2-537E-4F6C-D104768A1214"
VERSION_CHAR_ID = "19B10004-E8F2-537E-4F6C-D104768A1214"

device_files_path = "./device_files/"

EGG_STATE_STRUCT_STR = "d h h h h h h h h h"

stopped = False

connected_addresses = set()

def update_data(byte_array, service_uuid, nicla_id):
    # Adding timestamp as first 
    t = float(time.time())
    time_stamp_bytes = struct.pack("d", t)
    tf = struct.unpack("d", time_stamp_bytes)[0]
    byte_array = time_stamp_bytes + byte_array[:]

    with open(device_files_path + nicla_id + ".egg", "a") as f:
        f.write(base64.b64encode(byte_array).decode("utf-8") + ":")
        f.close()

    unpacked_data = struct.unpack(EGG_STATE_STRUCT_STR, byte_array)
    print("Unpacked Data for "+nicla_id)
    print(unpacked_data)



async def connect_to_device(device, advertising_data):
    connected_addresses.add(device.address)
    print("Connecting to address " + device.address)
    
    try:
        async with BleakClient(device, timeout = 40) as client:
            print("Connected")

            nicla_id = (await client.read_gatt_char(ID_CHAR_ID)).decode("utf-8")

            print("Nicla ID: "+nicla_id)

            async def notify(sender, data):
                update_data(data, advertising_data.service_uuids[0], nicla_id)


                
            await client.start_notify(DATA_CHAR_ID, notify)

            await client.write_gatt_char(START_TRANSFER_CHAR_ID, 1, True)
            print("Started Transfer")

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

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    # TODO: add something that calls stop_event.set()

    async def callback(device, advertising_data):
        if (advertising_data.local_name != SERVICE_NAME):
            return
        
        if (device.address in connected_addresses):
            return

        await connect_to_device(device, advertising_data)



    while True:
        try:
            print("Start Scann")
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
            print(stopped)
            time.sleep(5)
            pass 

        if stopped:
            break
    ...

print("Running python")

asyncio.run(main())
