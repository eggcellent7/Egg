import { readFileSync, writeFileSync, existsSync, watch } from "fs"
import admin  from 'firebase-admin';
import { extname, parse } from "path"
import { logger } from "./logger.js"
import ActionServer from "./action_server.js"
import {exec } from "child_process"

const service_account = JSON.parse(readFileSync("./service_account.json"));

const device_name_path = "./device_name.txt"
const device_files_path = "./device_files/";

const eggWrites = {};
const eggs = {}

const egg_docs = {}
const egg_cols = {}

const app = admin.initializeApp({
	credential: admin.credential.cert(service_account)
});

const db = admin.firestore();

const devices_col = db.collection("substations")
const eggs_col = db.collection("eggs")

const data_threshold = 100;


console.log("index.js is running");

const device_name = readFileSync(device_name_path);

console.log("Device name "+device_name)

const device_doc_ref = devices_col.doc(""+device_name);

let active_url = ""
let device_ip

async function ngrok_setup()
{
    // Establish connectivity
    let failed = false
    const ngrok_config = { 
        addr: env.SERVER_PORT, 
        authtoken_from_env: true, 
        headers: { 'Access-Control-Allow-Origin': `*` } 
    }
    await ngforward(ngrok_config).then((listener) => {
        // Push url onto database
        active_url = listener.url() || undefined
        logger.info("Ngrok started at %s at port %s", active_url, env.SERVER_PORT)
    }).catch((e) => {
        failed = true
        logger.error(`Ngrok setup failed with error: ${e}`)
    });

    return !failed
}

async function get_ip_address() {
    const promise = new Promise((resolve, reject) => {
        exec("hostname -I", (error, stdout, stderr) => {
            if (error) {
                reject(error);
            }
            resolve(stdout)
        })
    })
    try {
        device_ip = await promise
        logger.info(`Device IP Address found at ${device_ip}`)
        return true
    } catch(err) {
        logger.info(`Device IP Address was not able to be found. Error: ${err}`)
        return false
    }
}


async function init_endpoint()
{

	// let ngrok_success = await ngrok_setup();
	let ip_address_success = await get_ip_address();
	device_doc_ref.set({
		"ngrok_endpoint": active_url,
		"ip_address": device_ip
	});

	logger.info("End points uploaded to firebase");

}

init_endpoint();

// Watching for changes to files in device_files folder
watch(device_files_path, async (eventType, filename) => {
	const file_path = device_files_path+filename;
	const parsed_path = parse(file_path);
	const egg_id = parsed_path.name;

	if (extname(filename) != ".egg")
		return;
	
	if (!existsSync(file_path))
		return;

	const fileData = readFileSync(file_path, { encoding: 'utf8', flag: 'r' })

	// If the file has data in it to send
	if (fileData.length == 0) 
		return;

	if (egg_docs[egg_id] == undefined)
	{
		// Egg doc doesnt exist	
		const doc = eggs_col.doc(egg_id);
		doc.set({
			"last_connection": admin.firestore.FieldValue.serverTimestamp()
		})

		egg_docs[egg_id] = doc;

		const col = doc.collection("datapoints");
		egg_cols[egg_id] = col;
	}

	if (!eggWrites[filename]) 
		eggWrites[filename] = 0;
	eggWrites[filename] += 1;

	if (!eggs[filename])	
		eggs[filename] = ''
	eggs[filename] += fileData


	if (eggWrites[filename] >= data_threshold) {
		try {
			const docRef = await egg_cols[egg_id].add({
				filename: filename,
				timestamp: new Date().toISOString(),
				data: eggs[filename] // array of strings
			});
			logger.info("Uploaded to Firestore with ID:", docRef.id);
	
			// Clear the buffer after upload
			eggs[filename] = '';
			eggWrites[filename] = 0;
		} catch (e) {
			console.error("Error uploading to Firestore:", e);
		}
}
	// Clear the file
	writeFileSync(file_path, "")

});
