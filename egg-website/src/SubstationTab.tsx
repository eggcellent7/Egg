import { useEffect, useState, useRef } from "react";

import { db } from "./firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { decodeBase64SensorChunk } from "./utils/base64Decoder";

import {
  Typography,
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Button,
  Slider,
  Chip,
  Stack,
  Switch,
} from "@mui/material";
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';

const substation_col_id = "substations"

const EXPECTED_SERVER_PORT = "8080"

function parseDeviceTime(t: string)
{
    return new Date(parseFloat(t)*1000).toLocaleString()
}

type PingData = {
    datetime: number,
    eggs: {[address: string]: {
        last_connection: number,
        last_datapoint: string
        nicla_id: string
    }}
};

function SubstationTab()
{
    const [selectedStation, setSelectedStation] = useState<string>("")
    const [substations, setSubstations] = useState<{[key: string]: any}>([])
    const [pingData, setPingData] = useState<PingData>()
    const [connectMethod, setConnectMethod] = useState("NGROK")
    const [selectedEgg, setSelectedEgg] = useState<string>();

    // Egg Config Properties
    const [eggId, setEggId] = useState("")
    const [tempCalibration, setTempCalibration] = useState("");
    const [humCalibration, setHumCalibration] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            try {
                const stationsSnapshot = await getDocs(collection(db,  substation_col_id));
                const stations: {[key: string]: any} = {}
        
                for (const substationDoc of stationsSnapshot.docs) {
                    const id = substationDoc.id;
                    const data = substationDoc.data()

                    stations[id] = data;
                }

                setSubstations(stations);
            } catch (err) {
                console.error("Error fetching data:", err);
            }
        }   
        fetchData();
    }, []);

    async function pingForData(address: string, err: any)
    {
        fetch(address+"/ping", {
            method: "GET",
            headers: {
                "ngrok-skip-browser-warning": "1"
            }
        }) // Replace with your desired URL
            .then(response => {
                // Check if the request was successful (status code 2xx)
                if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
                }
                // Parse the response as JSON (or other formats like text, blob)
                return response.json(); 
            })
            .then(data => {
                console.log("got data", data);
                setPingData(data)
                
            })
            .catch(error => {
                // Handle any errors that occurred during the fetch operation
                console.error('Fetch error: url: '+address+ ": ", error);
                err();
            });
    }

    useEffect(() => {
        function pingAttempt()
        {
            // Attempt to connect through ngrok  and direct connection 
            if (!selectedStation || !substations[selectedStation])
                return;

            const subData = substations[selectedStation]
            
            // Will alternate methods until something works
            if ( connectMethod == "NGROK") 
            {
                if (subData.ngrok_endpoint)
                {
                    console.log("Pinging ngrok");
                    pingForData(subData.ngrok_endpoint, () => setConnectMethod("IP_ADDRESS"));
                } else {
                    setConnectMethod("IP_ADDRESS");
                }
            } else if (connectMethod == "IP_ADDRESS") {
                if ( subData.ip_address )
                {
                    console.log("Pinging local");
                    pingForData("http://"+subData.ip_address+":"+EXPECTED_SERVER_PORT, () => setConnectMethod("NGROK"));
                } else {
                    setConnectMethod("NGROK");
                }
            }
            
        }

        const interval = setInterval(pingAttempt, 5000);
        setTimeout(pingAttempt, 1000); // First ping is quicker

        return () => {
            clearInterval(interval);
        }
    }, [selectedStation, substations, connectMethod])

    useEffect(() => {
        setPingData(undefined);
    }, [selectedStation])

    useEffect(() => {
        if (pingData && selectedEgg && pingData.eggs[selectedEgg]) {
            setEggId(pingData.eggs[selectedEgg].nicla_id);
        } else {
            setEggId("")
        }
    }, [pingData, selectedEgg])

    const rows: {[address: string]: any[]} = {};
    if (pingData)
    {
        Object.keys(pingData.eggs).map((address) => {
            const data_string: string = pingData.eggs[address].last_datapoint
            rows[address] = decodeBase64SensorChunk(data_string)
        })
    }

    function applyChanges()
    {
        const changes: any = {
            address: selectedEgg
        }

        if (tempCalibration != "")
            changes["calibrate_temperature"] = parseFloat(tempCalibration);

        if (humCalibration != "")
            changes["calibrate_humidity"] = parseFloat(humCalibration);

        const subData = substations[selectedStation]

        let endpoint = "http://"+subData.ip_address+":"+EXPECTED_SERVER_PORT
        if (connectMethod == "NGROK")
            endpoint = subData.ngrok_endpoint

        const bod = JSON.stringify(changes)

        fetch(endpoint+"/catch", {
            method: "POST",
            headers: {
                "ngrok-skip-browser-warning": "1"
            },
            body: bod
        })
    }
    

    return <>
        {/* Controls */}
        <Grid container spacing={2} alignItems="center" mb={4}>
            <Grid size={{xs:12, sm:12, md:6, lg:4}}>
            <FormControl fullWidth>
                <InputLabel>Select Substation</InputLabel>
                <Select
                value={selectedStation}
                label="Select Substation"
                onChange={(e: any) => {
                    setSelectedStation(e?.target?.value);
                }}
                MenuProps={{
                    disablePortal: true,
                    PaperProps: {
                    style: {
                        maxHeight: 300,
                    },
                },
            }}
                >
                {Object.keys(substations).map((id) => (
                    <MenuItem key={id} value={id}>
                    {id}
                    </MenuItem>
                ))}
                </Select>
            </FormControl>
            </Grid>
        </Grid>

        {selectedStation && substations[selectedStation] && <Grid container spacing={2} alignItems="center" mb={4}>
            <Box mb={2}>
                <Box mb={2}>
                    <InputLabel>IP Address</InputLabel>
                    <div>{substations[selectedStation].ip_address} </div>
                </Box>

                <Box mb={2}>
                    <InputLabel>Ngrok Endpoint</InputLabel> 
                    <div>{substations[selectedStation].ngrok_endpoint }</div>
                </Box>

                {pingData && <Box mb={2}>
                    <InputLabel>Device Time</InputLabel> 
                    <div>{parseDeviceTime(""+pingData.datetime)}</div>
                </Box>}

                <TableContainer component={Paper}>
                    <Table sx={{ minWidth: 650 }} aria-label="simple table">
                        <TableHead>
                        <TableRow>
                            <TableCell>Eggs ID</TableCell>
                            <TableCell align="right">Address</TableCell>
                            <TableCell align="right">Last timestamp</TableCell>
                            <TableCell align="right">Temperature (c)</TableCell>
                            <TableCell align="right">Humidity (%)</TableCell>
                            <TableCell align="right">Light 1</TableCell>
                            <TableCell align="right">Light 2</TableCell>
                            <TableCell align="right">Voltage (V)</TableCell>
                        </TableRow>
                        </TableHead>
                        <TableBody>
                        {
                        Object.keys(pingData?.eggs || {}).map((address) => (
                            <TableRow
                            key={address}
                            sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                            onClick={(_) => selectedEgg == address ? setSelectedEgg(undefined):setSelectedEgg(address)}
                            selected={address == selectedEgg}
                            style={{cursor: "pointer"}}
                            >
                            <TableCell component="th" scope="row">
                                {pingData?.eggs[address].nicla_id}
                            </TableCell>
                            <TableCell align="right">{address}</TableCell>
                            <TableCell align="right">{parseDeviceTime(rows[address][0])}</TableCell>
                            <TableCell align="right">{rows[address][5]}</TableCell>
                            <TableCell align="right">{rows[address][6]}</TableCell>
                            <TableCell align="right">{rows[address][7]}</TableCell>
                            <TableCell align="right">{rows[address][8]}</TableCell>
                            <TableCell align="right">{rows[address][9]}</TableCell>
                            </TableRow>
                        ))
                        }
                        </TableBody>
                    </Table>
                </TableContainer>

                <br/>

                <Box mb={2}>
                    {!selectedEgg && "Select an egg"}
                    {selectedEgg && <FormControl fullWidth>
                        Selected Egg "{pingData?.eggs[selectedEgg]?.nicla_id}"
                        <br/>
                        <TextField id="outlined-basic" label="Egg ID" variant="outlined" 
                            value={eggId} onChange={(e) => setEggId(e.target.value)}/>
                        
                        <br/>
                        <TextField id="outlined-basic" label="Temperature Calibration" variant="outlined" 
                            value={tempCalibration} onChange={(e) => {
                                if (e.target.value == "") {
                                    setTempCalibration("");
                                } else {
                                    if (isNaN(parseFloat(e.target.value)))
                                        return
                                    setTempCalibration(e.target.value);
                                }
                            }}/>

                        <br/>
                        <TextField id="outlined-basic" label="Humidity Calibration" variant="outlined" 
                            value={humCalibration} onChange={(e) => {
                                if (e.target.value == "") {
                                    setHumCalibration("");
                                } else {
                                    if (isNaN(parseFloat(e.target.value)))
                                        return
                                    setHumCalibration(e.target.value);
                                }
                            }}/>

                        <Button variant="outlined" onClick={applyChanges}>Apply Changes</Button>
                    </FormControl>}
                </Box>
            </Box>
        </Grid>}
    
    </>
}

export default SubstationTab