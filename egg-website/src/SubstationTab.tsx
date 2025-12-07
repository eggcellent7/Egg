import { useEffect, useState } from "react";

import { db } from "./firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { decodeBase64SensorChunk } from "./utils/base64Decoder";

import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  Typography,
} from "@mui/material";
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
// import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
// import { CheckBox } from "@mui/icons-material";

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
    }},
    saved: string[]
};

function pFloat(v: string): number
{
    return parseFloat(v.replace(",", ""))
}

function SubstationTab()
{
    const [selectedStation, setSelectedStation] = useState<string>("")
    const [substations, setSubstations] = useState<{[key: string]: any}>([])
    const [pingData, setPingData] = useState<PingData>()
    const [connectMethod, setConnectMethod] = useState("NGROK")
    const [selectedEgg, setSelectedEgg] = useState<string>();
    const [selectedFile, setSelectedFile] = useState<string>("");

    // Egg Config Properties
    const [eggId, setEggId] = useState("")
    const [tempCalibration, setTempCalibration] = useState("");
    const [humCalibration, setHumCalibration] = useState("");
    const [pollingSpeed, setPollingSpeed] = useState("");
    const [calibrateOrientation, setCalibrateOrientation] = useState(false)

    function getEndpoint()
    {
        const subData = substations[selectedStation]
        if (connectMethod == "NGROK")
            return subData.ngrok_endpoint;
        else
            return "http://"+subData.ip_address+":"+EXPECTED_SERVER_PORT
    }

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
            if (eggId == "")
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

        if (eggId != selectedEgg)
            changes["id"] = eggId;

        if (tempCalibration != "")
            changes["calibrate_temperature"] = pFloat(tempCalibration);

        if (humCalibration != "")
            changes["calibrate_humidity"] = pFloat(humCalibration);

        if (pollingSpeed != "")
            changes["polling_speed"] = pFloat(pollingSpeed);

        const bod = JSON.stringify(changes);

        const endpoint = getEndpoint();
        fetch(endpoint+"/catch", {
            method: "POST",
            headers: {
                "ngrok-skip-browser-warning": "1"
            },
            body: bod
        });
    }

    function DownloadSavedData()
    {
        if (!selectedFile || selectedFile == "")
            return;

        const link = document.createElement("a");
        const endpoint = getEndpoint();
        link.href = endpoint+"/saved/"+selectedFile;
        link.download = selectedFile; // optional: suggest filename
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    

    return <>
        {/* Controls */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 600, color: "primary.dark" }}>
              Select Substation
            </Typography>
            <Grid container spacing={2} alignItems="center">
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
          </CardContent>
        </Card>

        {selectedStation && substations[selectedStation] && (
          <>
            {/* Substation Info Card */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 600, color: "primary.dark" }}>
                  Substation Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{xs: 12, sm: 6, md: 4}}>
                    <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 0.5 }}>
                      IP Address
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {substations[selectedStation].ip_address || "N/A"}
                    </Typography>
                  </Grid>
                  <Grid size={{xs: 12, sm: 6, md: 4}}>
                    <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 0.5 }}>
                      Ngrok Endpoint
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {substations[selectedStation].ngrok_endpoint || "N/A"}
                    </Typography>
                  </Grid>
                  {pingData && (
                    <Grid size={{xs: 12, sm: 6, md: 4}}>
                      <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 0.5 }}>
                        Device Time
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {parseDeviceTime(""+pingData.datetime)}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>

            {/* Eggs Table Card */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 600, color: "primary.dark" }}>
                  Connected Eggs
                </Typography>
                <TableContainer>
                  <Table sx={{ minWidth: 650 }} aria-label="eggs table">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: "secondary.main" }}>
                        <TableCell sx={{ fontWeight: 600 }}>Egg ID</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>Address</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>Last Timestamp</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>Temperature (°C)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>Humidity (%)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>Voltage (V)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {
                        Object.keys(pingData?.eggs || {}).map((address) => (
                          <TableRow
                            key={address}
                            onClick={(_) => selectedEgg == address ? setSelectedEgg(undefined):setSelectedEgg(address)}
                            selected={address == selectedEgg}
                            sx={{ 
                              cursor: "pointer",
                              '&:last-child td, &:last-child th': { border: 0 },
                              '&:hover': {
                                backgroundColor: "secondary.main",
                              },
                              backgroundColor: address == selectedEgg ? "secondary.light" : "transparent",
                            }}
                          >
                            <TableCell component="th" scope="row" sx={{ fontWeight: address == selectedEgg ? 600 : 400 }}>
                              {pingData?.eggs[address].nicla_id}
                            </TableCell>
                            <TableCell align="right">{address}</TableCell>
                            <TableCell align="right">{parseDeviceTime(rows[address][0])}</TableCell>
                            <TableCell align="right">{rows[address][5]}</TableCell>
                            <TableCell align="right">{rows[address][6]}</TableCell>
                            <TableCell align="right">{rows[address][9]}</TableCell>
                          </TableRow>
                        ))
                      }
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            {/* Egg Configuration Card */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                {!selectedEgg ? (
                  <Typography variant="body1" sx={{ color: "text.secondary", textAlign: "center", py: 2 }}>
                    Select an egg from the table above to configure
                  </Typography>
                ) : (
                  <>
                    <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 600, color: "primary.dark" }}>
                      Configure Egg: {pingData?.eggs[selectedEgg]?.nicla_id}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={{xs: 12, sm: 6}}>
                        <TextField 
                          id="egg-id" 
                          label="Egg ID" 
                          variant="outlined" 
                          fullWidth
                          value={eggId} 
                          onChange={(e) => setEggId(e.target.value)}
                        />
                      </Grid>
                      <Grid size={{xs: 12, sm: 6}}>
                        <TextField 
                          id="temp-calibration" 
                          label="Temperature Calibration (°C)" 
                          variant="outlined" 
                          fullWidth
                          value={tempCalibration} 
                          onChange={(e) => {
                            if (e.target.value == "") {
                              setTempCalibration("");
                            } else {
                              if (isNaN(parseFloat(e.target.value)))
                                return
                              setTempCalibration(e.target.value);
                            }
                          }}
                        />
                      </Grid>
                      <Grid size={{xs: 12, sm: 6}}>
                        <TextField 
                          id="hum-calibration" 
                          label="Humidity Calibration (%)" 
                          variant="outlined" 
                          fullWidth
                          value={humCalibration} 
                          onChange={(e) => {
                            if (e.target.value == "") {
                              setHumCalibration("");
                            } else {
                              if (isNaN(parseFloat(e.target.value)))
                                return
                              setHumCalibration(e.target.value);
                            }
                          }}
                        />
                      </Grid>
                      <Grid size={{xs: 12, sm: 6}}>
                        <TextField 
                          id="polling-speed" 
                          label="Polling Speed (s)" 
                          variant="outlined" 
                          fullWidth
                          value={pollingSpeed} 
                          onChange={(e) => {
                            if (e.target.value == "") {
                              setPollingSpeed("");
                            } else {
                              if (isNaN(parseFloat(e.target.value)))
                                return
                              setPollingSpeed(e.target.value);
                            }
                          }}
                        />
                      </Grid>
                      <Grid size={{xs: 12}}>
                        <FormControlLabel 
                          control={
                            <Switch 
                              checked={calibrateOrientation} 
                              onChange={(e: any) => setCalibrateOrientation(e.target.checked)} 
                              inputProps={{ 'aria-label': 'calibrate orientation' }}
                            />
                          } 
                          label="Calibrate Orientation" 
                        />
                      </Grid>
                      <Grid size={{xs: 12}}>
                        <Button 
                          variant="contained" 
                          onClick={applyChanges}
                          sx={{ mt: 1 }}
                        >
                          Apply Changes
                        </Button>
                      </Grid>
                    </Grid>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Download Saved Data Card */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 600, color: "primary.dark" }}>
                  Download Saved Data
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid size={{xs:12, sm:12, md:6, lg:4}}>
                    <FormControl fullWidth>
                      <InputLabel>Select Data File</InputLabel>
                      <Select
                        value={selectedFile}
                        label="Select Data File"
                        onChange={(e: any) => {
                          setSelectedFile(e?.target?.value);
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
                        {pingData && (pingData.saved || []).map((id) => (
                          <MenuItem key={id} value={id}>
                            {id}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{xs:12, sm:12, md:6, lg:4}}>
                    <Button 
                      onClick={DownloadSavedData} 
                      variant="contained"
                      disabled={!selectedFile || selectedFile === ""}
                      fullWidth
                    >
                      Download
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </>
        )}
    
    </>
}

export default SubstationTab