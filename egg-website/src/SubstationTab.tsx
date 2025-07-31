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
import Grid from '@mui/material/Grid';
import type { SelectChangeEvent } from "@mui/material/Select";
import { continuousColorLegendClasses } from "@mui/x-charts";

const substation_col_id = "substations"

function SubstationTab()
{
    const [selectedStation, setSelectedStation] = useState<string|null>(null)
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
                setPingData(JSON.parse(data))
                console.log(data)
            })
            .catch(error => {
                // Handle any errors that occurred during the fetch operation
                console.error('Fetch error:', error);
            });
    }

    useEffect(() => {
        console.log("effect")
        const interval = setInterval(() => {
            // Attempt to connect through ngrok  and direct connection 
            if (!selectedStation || !substations[selectedStation])
                return;

            const subData = substations[selectedStation]

            if ( subData.ngrok_endpoint)
            {
                console.log("Pinged")
                pingForData(subData.ngrok_endpoint)
            }

            if ( subData.ip_address )
            {
                pingForData(subData.ip_address+":8080")
            }


            
        }, 5000);

        return () => {
            clearInterval(interval);
        }
    }, [selectedStation, substations])

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
            <InputLabel>IP Address</InputLabel>
            {substations[selectedStation].ip_address} 

            <InputLabel>Ngrok Endpoint</InputLabel> 
            {substations[selectedStation].ngrok_endpoint } 
        </Grid>}
    
    </>
}

export default SubstationTab