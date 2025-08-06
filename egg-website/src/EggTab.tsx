import { useEffect, useState, useRef } from "react";
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

import { db } from "./firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { decodeBase64SensorChunk } from "./utils/base64Decoder";

import type { SelectChangeEvent } from "@mui/material/Select";

import EggView from "./EggView"

const egg_col_id = "eggs2"


function EggTab()
{
  const [eggs, setEggs] = useState<string[]>([])
  const [groupedData, setGroupedData] = useState<{[key: string]: any[][]}>({});
  const [selectedEggId, setSelectedEggId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false)

    // Fetch all egg documents
    useEffect(() => {
      const fetchData = async () => {
        try {
          const eggsSnapshot = await getDocs(collection(db,  egg_col_id));

          const egg_ids = []
          for (const eggDoc of eggsSnapshot.docs) {
            egg_ids.push(eggDoc.id)
          }

          setEggs(egg_ids);

          if (eggs.length > 0 && !selectedEggId) {
            setSelectedEggId(egg_ids[0]);
          }
          } catch (err) {
              console.error("Error fetching data:", err);
          }
        };  

      fetchData();
    }, []);

    useEffect(() => {
      async function getData()
      {
        if (!selectedEggId)
          return;

        const datapointsRef = collection(db, egg_col_id, selectedEggId, "datapoints");
        setIsLoading(true)
        const datapointsSnapshot = await getDocs(datapointsRef);

        const decodedEntries: any[][] = [];

        datapointsSnapshot.forEach((docSnap) => {
          const docData = docSnap.data();
          const raw = docData.data;

          if (typeof raw === "string") {
            const decodedChunks = raw
              .split(":")
              .filter(Boolean)
              .map(decodeBase64SensorChunk);

            // console.log("Decoded Row Example:", decodedChunks[0]);

            decodedEntries.push(...decodedChunks);
          }
        });
        
        if (decodedEntries.length > 0) {
          decodedEntries.sort((a, b) => b[0] - a[0]);

          setGroupedData((data) => {
            data[selectedEggId] = decodedEntries
            return data
          });
        }

        setIsLoading(false);
      }
      getData();
    }, [selectedEggId]);
  
    const handleEggChange = (event: SelectChangeEvent<string>) => {
      setSelectedEggId(event.target.value);
    };

    return <>
      <Grid size={{xs:12, sm:12, md:6, lg:4}}>
        <FormControl fullWidth>
          <InputLabel>Select Egg</InputLabel>
          <Select
            value={selectedEggId}
            label="Select Egg"
            onChange={handleEggChange}
          >
            {eggs.map((eggId) => (
              <MenuItem key={eggId} value={eggId}>
                {eggId}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {isLoading && "Loading..."}
      </Grid>
      <EggView rows={groupedData[selectedEggId] || []} eggname={selectedEggId}/>
    </>
}

export default EggTab