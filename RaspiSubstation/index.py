import asyncio
import struct
from bleak import BleakScanner
from bleak import BleakClient

SERVICE_NAME = "EggcellentImposter"
SERVICE_UUID = "19B10000-E8F2-537E-4F6C-D104768A1214"
CHAR_ID = "19B10001-E8F2-537E-4F6C-D104768A1214"

EGG_STATE_STRUCT_STR = "f f f f f f f f"

connected_addresses = set()

data_points = []

async def connect_to_device(device, advertising_data):
    connected_addresses.add(device.address)
    print("Connecting to address " + device.address)

    async with BleakClient(device) as client:
        print("Connected")

        byte_array = await client.read_gatt_char(CHAR_ID)
        unpacked_data = struct.unpack(EGG_STATE_STRUCT_STR, byte_array)

        data_points.push(unpacked_data)

        print(unpacked_data)


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
