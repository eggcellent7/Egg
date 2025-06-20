import asyncio
import struct
import base64
from bleak import BleakScanner
from bleak import BleakClient
import time

SERVICE_NAME = "EggcellentImposter"
SERVICE_UUID = "19B10000-E8F2-537E-4F6C-D104768A1214"
CHAR_ID = "19B10001-E8F2-537E-4F6C-D104768A1214"

device_files_path = "./device_files/"

EGG_STATE_STRUCT_STR = "i f f f f f f f f"

connected_addresses = set()

def update_data(byte_array, service_uuid):
    # Adding timestamp as first 
    t = time.time()
    time_stamp_bytes = struct.pack("f", t)
    byte_array = time_stamp_bytes + byte_array

    with open(device_files_path + service_uuid + ".egg", "a") as f:
        f.write(base64.b64encode(byte_array).decode("utf-8") + ":")
        f.close()

    unpacked_data = struct.unpack(EGG_STATE_STRUCT_STR, byte_array)
    print("Unpacked Data for "+service_uuid)
    print(unpacked_data)



async def connect_to_device(device, advertising_data):
    connected_addresses.add(device.address)
    print("Connecting to address " + device.address)

    async with BleakClient(device) as client:
        print("Connected")

        async def notify(sender, data):
            update_data(data, advertising_data.service_uuids[0])
            
        await client.start_notify(CHAR_ID, notify)

        print("end notify")
        
        while (True):
            time.sleep(1)

async def main():
    stop_event = asyncio.Event()

    # TODO: add something that calls stop_event.set()

    async def callback(device, advertising_data):
        if (advertising_data.local_name != SERVICE_NAME):
            return;
        
        if (device.address in connected_addresses):
            return

        print("Found another egg")

        await connect_to_device(device, advertising_data)



    async with BleakScanner(callback) as scanner:
        ...
        # Important! Wait for an event to trigger stop, otherwise scanner
        # will stop immediately.
        await stop_event.wait()
        print("Scan stopp")

    # scanner stops when block exits
    ...

print("Running python")

asyncio.run(main())
