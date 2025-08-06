import { useState, useRef } from "react";
import { decodeBase64SensorChunk } from "./utils/base64Decoder";

import {
  FormControl,
  InputLabel,
  Button,
  Grid
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
        <Grid container spacing={2} alignItems="center" mb={4}>
            <Grid size={{xs:12, sm:12, md:6, lg:4}}>
                <FormControl fullWidth>
                    <InputLabel>Input Data file (.egg)</InputLabel>
                    <input type="file" id="myFileInput" ref={fileInputRef}
                        accept=".egg"></input>
                    <Button onClick={readFile}>Read</Button>
                
            </FormControl>
            </Grid>
        </Grid>
        <EggView rows={rows} eggname={fileName}/>
    </>
}

export default Dataview