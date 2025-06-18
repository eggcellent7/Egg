import asyncio
import struct
import base64
from bleak import BleakScanner
from bleak import BleakClient
import time

SERVICE_NAME = "EggcellentImposter"
SERVICE_UUID = "19B10000-E8F2-537E-4F6C-D104768A1214"
CHAR_ID = "19B10001-E8F2-537E-4F6C-D104768A1214"

EGG_STATE_STRUCT_STR = "i f f f f f f f f"

connected_addresses = set()

def update_data(client, service_uuid):
    byte_array = await client.read_gatt_char(CHAR_ID)

    # Adding timestamp as first 
    t = time.time()
    time_stamp_bytes = struct.pack("f", t)
    byte_array = time_stamp_bytes + byte_array

    with open(service_uuid + ".egg", "a") as f:
        f.write(base64.b64encode(byte_array))

    unpacked_data = struct.unpack(EGG_STATE_STRUCT_STR, byte_array)
    print("Unpacked Data for "+service_uuid)
    print(unpacked_data)



async def connect_to_device(device, advertising_data):
    connected_addresses.add(device.address)
    print("Connecting to address " + device.address)

    async with BleakClient(device) as client:
        print("Connected")

        while (True):
            update_data(client, advertising_data.service_uuids[0])
            time.sleep(1000)


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

    # scanner stops when block exits
    ...

asyncio.run(main())
