import { readFileSync, writeFileSync, existsSync, watch } from "fs"
import admin  from 'firebase-admin';
import { extname } from "path"
// Follow this pattern to import other Firebase services
// import { } from 'firebase/<service>';

// TODO: Replace the following with your app's Firebase project configuration
const service_account = JSON.parse(readFileSync("./service_account.json"));

const eggs = {};
const eggWrites = {};

const app = admin.initializeApp({
	credential: admin.credential.cert(service_account)
});

const db = admin.firestore();

const egg_col = db.collection("eggdata")

//await db.collection('users').add({
//  name: 'Alice',
//  age: 25,
//});


const data_threshold = 100;

const device_files_path = "./device_files/"

// Watching for changes to files in device_files folder
watch(device_files_path, async (eventType, filename) => {
	console.log("\nThe file", filename, "was modified!");
	console.log("The type of change was:", eventType);

	const file_path = device_files_path+filename;

	if (extname(filename) != ".egg")
		return;
	
	if (!existsSync(file_path))
		return;

	const fileData = readFileSync(file_path, { encoding: 'utf8', flag: 'r' })

	// If the file has data in it to send
	if (fileData.length > 0) {
		if (!eggWrites[filename]) 
			eggWrites[filename] = 0;
		eggWrites[filename] += 1;

		if (!eggs[filename])	
			eggs[filename] = ''
		eggs[filename] += fileData


		if (eggWrites[filename] >= data_threshold) {
			try {
				const docRef = await egg_col.add({
					filename: filename,
					timestamp: new Date().toISOString(),
					data: eggs[filename] // array of strings
				});
				console.log("Uploaded to Firestore with ID:", docRef.id);
		
				// Clear the buffer after upload
				eggs[filename] = '';
				eggWrites[filename] = 0;
			} catch (e) {
				console.error("Error uploading to Firestore:", e);
			}
}
		// Clear the file
		writeFileSync(file_path, "")
	}

});
