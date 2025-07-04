import { useEffect, useState } from "react";
import { db } from "./firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { decodeBase64ToFloat64ThenFloats } from "./utils/base64Decoder";
import { LineChart } from "@mui/x-charts/LineChart";
import {
  Typography,
  Box,
  CssBaseline,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { Canvas } from "@react-three/fiber";
import EggModel from "./EggModel";

const fieldNames = ["qx", "qy", "qz", "qw", "temp", "humidity", "photo1", "photo2"];
const graphedFields = fieldNames.slice(4);

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    background: { default: "#121212" },
    text: { primary: "#ffffff" },
  },
  typography: {
    allVariants: { color: "#ffffff" },
  },
});

function App() {
  const [groupedData, setGroupedData] = useState<Record<string, any[][]>>({});
  const [selectedEggId, setSelectedEggId] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const eggsSnapshot = await getDocs(collection(db, "eggs"));
        const grouped: Record<string, any[][]> = {};

        for (const eggDoc of eggsSnapshot.docs) {
          const eggId = eggDoc.id;
          const datapointsRef = collection(db, "eggs", eggId, "datapoints");
          const datapointsSnapshot = await getDocs(datapointsRef);

          const decodedEntries: any[][] = [];

          datapointsSnapshot.forEach((docSnap) => {
            const docData = docSnap.data();
            const raw = docData.data;

            if (typeof raw === "string") {
              const decodedChunks = raw
                .split(":")
                .filter(Boolean)
                .map(decodeBase64ToFloat64ThenFloats);

              decodedEntries.push(...decodedChunks);
            }
          });

          if (decodedEntries.length > 0) {
            decodedEntries.sort((a, b) => b[0] - a[0]); // newest first
            grouped[eggId] = decodedEntries.slice(0, 100);
          }
        }

        setGroupedData(grouped);

        // Set default egg to first in list
        const eggIds = Object.keys(grouped);
        if (eggIds.length > 0 && !selectedEggId) {
          setSelectedEggId(eggIds[0]);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };

    fetchData();
  }, [selectedEggId]);

  const handleEggChange = (event: SelectChangeEvent<string>) => {
    setSelectedEggId(event.target.value);
  };

  const rows = groupedData[selectedEggId] || [];
  const latestQuaternion: [number, number, number, number] =
    rows.length > 0
      ? [rows[0][1], rows[0][2], rows[0][3], rows[0][4]]
      : [0, 0, 0, 1];

  const timestamps = rows.map(row =>
    new Date(row[0] * 1000).toLocaleString()
  );

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div style={{ padding: "2rem" }}>
        <FormControl sx={{ minWidth: 200, mb: 4 }}>
          <InputLabel id="egg-select-label" sx={{ color: "white" }}>Select Egg</InputLabel>
          <Select
            labelId="egg-select-label"
            id="egg-select"
            value={selectedEggId}
            label="Select Egg"
            onChange={handleEggChange}
            sx={{
              color: "white",
              borderColor: "white",
              ".MuiOutlinedInput-notchedOutline": {
                borderColor: "white",
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: "#aaa",
              },
              ".MuiSvgIcon-root": {
                color: "white",
              },
            }}
          >
            {Object.keys(groupedData).map((eggId) => (
              <MenuItem key={eggId} value={eggId}>
                {eggId}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedEggId && (
          <Box mb={10}>

            {/* 3D Egg */}
            <Box
              mb={6}
              sx={{
                width: "100%",
                height: "300px",
                background: "#222",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              <Canvas camera={{ position: [0, 0, 25], fov: 45 }}>
                <ambientLight />
                <directionalLight position={[3, 3, 3]} />
                <EggModel quaternion={latestQuaternion} />
              </Canvas>
            </Box>

            {/* Graphs */}
            {graphedFields.map((field) => {
              const fieldIndex = fieldNames.indexOf(field);
              const dataPoints = rows.map(row => row[fieldIndex + 1]);

              return (
                <Box key={field} mb={6}>
                  <Typography variant="h6" gutterBottom>{field}</Typography>
                  <LineChart
                    width={1000}
                    height={150}
                    xAxis={[
                      {
                        data: rows.map((_, i) => i),
                        valueFormatter: (val) => {
                          const idx = typeof val === "number" ? val : parseInt(val);
                          return timestamps[idx] || "";
                        },
                        tickLabelStyle: { display: "none" },
                        axisLine: { strokeWidth: 0 },
                        tickMinStep: 1,
                      }
                    ]}
                    series={[{
                      data: dataPoints,
                      label: field,
                    }]}
                    sx={{
                      ".MuiChartsAxis-label, .MuiChartsAxis-tickLabel, .MuiChartsLegend-series": {
                        fill: "#ffffff",
                      }
                    }}
                  />
                </Box>
              );
            })}

            {/* Data Table */}
            <table
              border={1}
              cellPadding={5}
              style={{
                borderCollapse: "collapse",
                marginTop: "1rem",
                width: "100%",
                color: "white"
              }}
            >
              <thead>
                <tr>
                  <th>Timestamp</th>
                  {fieldNames.map((name, i) => (
                    <th key={i}>{name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td>{new Date(row[0] * 1000).toLocaleString()}</td>
                    {row.slice(1).map((val, j) => (
                      <td key={j}>{typeof val === "number" ? val.toFixed(6) : val}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;
