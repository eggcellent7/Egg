import { useState, useRef } from "react";
import { decodeBase64SensorChunk } from "./utils/base64Decoder";

import {
  FormControl,
  InputLabel,
  Button,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
} from "@mui/material";

import EggView from "./EggView";

function Dataview()
{   
    const fileInputRef = useRef(null)

    const [rows, setRows] = useState([])
    const [fileName, setFileName] = useState("")

    function readFile()
    {
        if (!fileInputRef.current)
            return;

        const input: any = fileInputRef.current
        const file = input.files[0]; // Get the first selected file

        if (file) {
            setFileName(file.name);

            const reader = new FileReader();

            reader.onload = (e: any) => {
                const fileContent = e?.target.result;
                console.log('File Content:', fileContent);
                // Process the file content (e.g., display it, send to server)
            };

            // Choose the appropriate method to read the file:
            reader.readAsText(file); // Example: read as text
            
            reader.onload = () => {
                const result: any = reader?.result || ""
                const data = result.split(":")
                    .filter(Boolean)
                    .map(decodeBase64SensorChunk)
                    .sort((a: any, b: any) => b[0] - a[0]);;

                setRows(data);
            };
        }
    }

    return <>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ mb: 2, fontWeight: 600, color: "primary.dark" }}>
              Upload Data File
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{xs:12, sm:12, md:6, lg:4}}>
                <FormControl fullWidth>
                  <InputLabel>Input Data file (.egg)</InputLabel>
                  <Box sx={{ mb: 2 }}>
                    <input 
                      type="file" 
                      id="myFileInput" 
                      ref={fileInputRef}
                      accept=".egg"
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #e0e0e0",
                        borderRadius: "4px",
                        fontSize: "0.875rem",
                      }}
                    />
                  </Box>
                  <Button 
                    onClick={readFile}
                    variant="contained"
                    fullWidth
                  >
                    Read File
                  </Button>
                </FormControl>
              </Grid>
              {fileName && (
                <Grid size={{xs:12, sm:12, md:6, lg:4}}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Loaded: <strong>{fileName}</strong>
                  </Typography>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
        <EggView rows={rows} eggname={fileName}/>
    </>
}

export default Dataview