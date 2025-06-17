const {createBluetooth} = require('node-ble')
const {bluetooth, destroy} = createBluetooth()


const SERVICE_UUID "19B10000-E8F2-537E-4F6C-D104768A1214"
const CHAR_ID = "19B10001-E8F2-537E-4F6C-D104768A1214"

async function main()
{
	const adapter = await bluetooth.defaultAdapter()

	if (! await adapter.isDiscovering())
	  await adapter.startDiscovery()

	while (true)
	{
		const devices = adapter.devices()
		for (int i = 0; i < devices; i++)
			console.log("Found device "+devices[i])
	}

	const device = await adapter.waitDevice('00:00:00:00:00:00')
	await device.connect()
	const gattServer = await device.gatt()

	const service1 = await gattServer.getPrimaryService(SERVICE_UUID)
	const characteristic1 = await service1.getCharacteristic(CHAR_ID)
	const buffer = await characteristic1.readValue()
	console.log(buffer)

	await characteristic2.stopNotifications()
	await device.disconnect()
	destroy()
}

main()
