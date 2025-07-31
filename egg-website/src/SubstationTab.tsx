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

function parseDeviceTime(t: string)
{
    return new Date(parseFloat(t)*1000).toLocaleString()
}

function SubstationTab()
{
    const [selectedStation, setSelectedStation] = useState<string>("")
    const [substations, setSubstations] = useState<{[key: string]: any}>([])
    const [pingData, setPingData] = useState<any>()

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

    async function pingForData(address: string)
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
                setPingData(data)
                
            })
            .catch(error => {
                // Handle any errors that occurred during the fetch operation
                console.error('Fetch error: url: '+address+ ": ", error);
            });
    }

    useEffect(() => {
        const interval = setInterval(() => {
            // Attempt to connect through ngrok  and direct connection 
            if (!selectedStation || !substations[selectedStation])
                return;

            const subData = substations[selectedStation]

            if ( subData.ngrok_endpoint)
            {
                console.log("Pinging ngrok")
                pingForData(subData.ngrok_endpoint)
            }

            if ( subData.ip_address )
            {
                console.log("Pinging local")
                pingForData("http://localhost:8080")
            }


            
        }, 5000);

        return () => {
            clearInterval(interval);
        }
        setPingData(null);
    }, [selectedStation, substations])

    const rows: any[] = []
    if (pingData)
    {
        Object.keys(pingData.last_datapoints).map((id) => {
            const data_string: string = pingData.last_datapoints[id]
            const row_data = decodeBase64SensorChunk(data_string)
            row_data.push(id)
            rows.push(row_data)
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
                    <div>{parseDeviceTime(pingData.datetime)}</div>
                </Box>}

                <TableContainer component={Paper}>
                    <Table sx={{ minWidth: 650 }} aria-label="simple table">
                        <TableHead>
                        <TableRow>
                            <TableCell>Eggs</TableCell>
                            <TableCell align="right">Last timestamp</TableCell>
                            <TableCell align="right">Temperature&nbsp;(g)</TableCell>
                            <TableCell align="right">Humidity&nbsp;(g)</TableCell>
                            <TableCell align="right">Light 1&nbsp;(g)</TableCell>
                            <TableCell align="right">Light 2&nbsp;(g)</TableCell>
                            <TableCell align="right">Voltage&nbsp;(g)</TableCell>
                        </TableRow>
                        </TableHead>
                        <TableBody>
                        {
                        rows.map((row) => (
                            <TableRow
                            key={row[10]}
                            sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                            >
                            <TableCell component="th" scope="row">
                                {row[10]}
                            </TableCell>
                            <TableCell align="right">{parseDeviceTime(row[0])}</TableCell>
                            <TableCell align="right">{row[5]}</TableCell>
                            <TableCell align="right">{row[6]}</TableCell>
                            <TableCell align="right">{row[7]}</TableCell>
                            <TableCell align="right">{row[8]}</TableCell>
                            <TableCell align="right">{row[9]}</TableCell>
                            </TableRow>
                        ))
                        }
                        </TableBody>
                    </Table>
                    </TableContainer>
            </Box>
        </Grid>}
    
    </>
}

export default SubstationTab