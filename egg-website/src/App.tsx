import { useEffect, useState } from "react";
import { db } from "./firebaseConfig";
import { collection, getDocs, doc } from "firebase/firestore";
import { decodeBase64ToFloat64ThenFloats } from "./utils/base64Decoder";
import { LineChart } from "@mui/x-charts/LineChart";
import { Typography, Box, CssBaseline } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";

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
            decodedEntries.sort((a, b) => b[0] - a[0]); // sort by timestamp (newest first)
            grouped[eggId] = decodedEntries.slice(0, 100); // take most recent 100

          }
        }

        setGroupedData(grouped);
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };

    fetchData();
  }, []);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div style={{ padding: "2rem" }}>
        <Typography variant="h4" gutterBottom>EGG DATA WOOHOO</Typography>

        {Object.entries(groupedData).map(([filename, rows]) => (
          <Box key={filename} mb={10}>
            <Typography variant="h5" gutterBottom>Egg ID: {filename}</Typography>

            {/* Data Table */}
            <table border={1} cellPadding={5} style={{
              borderCollapse: "collapse",
              marginTop: "1rem",
              width: "100%",
              color: "white"
            }}>
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

            {/* Graphs for selected fields */}
            <Box mt={6}>
              {graphedFields.map((field) => {
                const fieldIndex = fieldNames.indexOf(field);
                const dataPoints = rows.map(row => row[fieldIndex + 1]);
                const timestamps = rows.map(row => new Date(row[0] * 1000).toLocaleString());

                return (
                  <Box key={field} mb={6}>
                    <Typography variant="h6" gutterBottom>{field}</Typography>
                    <LineChart
                      width={1000}
                      height={250}
                      xAxis={[{
                        data: rows.map((_, i) => i),
                        valueFormatter: (value) => timestamps[value] || "",
                        axisLine: { visible: false },
                        tickLabelStyle: { display: 'none' },
                        tickMinStep: 1,
                      }]}
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
            </Box>
          </Box>
        ))}
      </div>
    </ThemeProvider>
  );
}

export default App;