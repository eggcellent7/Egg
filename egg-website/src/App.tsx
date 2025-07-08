import { useEffect, useState, useRef } from "react";
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
  Grid,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Button,
  Slider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import InfoIcon from "@mui/icons-material/Info";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import type { SelectChangeEvent } from "@mui/material/Select";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { Canvas } from "@react-three/fiber";
import EggModel from "./EggModel";

const fieldNames = ["qx", "qy", "qz", "qw", "temp", "humidity", "photo1", "photo2"];
const graphedFields = fieldNames.slice(4);

const lightTheme = createTheme({
  palette: {
    mode: "light",
    background: { default: "#f5f5f5" },
    text: { primary: "#000000" },
  },
  typography: {
    fontFamily: "Arial, sans-serif",
  },
});

function App() {
  const [groupedData, setGroupedData] = useState<Record<string, any[][]>>({});
  const [selectedEggId, setSelectedEggId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState<boolean>(false);

  // Animation dialog state
  const [animationOpen, setAnimationOpen] = useState(false);
  const [animationStartDate, setAnimationStartDate] = useState<string>("");
  const [animationEndDate, setAnimationEndDate] = useState<string>("");
  const [animationIndex, setAnimationIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch data effect
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
            decodedEntries.sort((a, b) => b[0] - a[0]);
            const limit = startDate || endDate ? undefined : 100;
            grouped[eggId] = limit ? decodedEntries.slice(0, limit) : decodedEntries;
          }
        }

        setGroupedData(grouped);

        const eggIds = Object.keys(grouped);
        if (eggIds.length > 0 && !selectedEggId) {
          setSelectedEggId(eggIds[0]);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };

    fetchData();
  }, [selectedEggId, startDate, endDate]);

  const handleEggChange = (event: SelectChangeEvent<string>) => {
    setSelectedEggId(event.target.value);
  };

  // Main dashboard filtered and reversed for ascending time left-to-right on graphs
  const rows = groupedData[selectedEggId] || [];
  const filteredRows = rows
    .filter((row) => {
      const timestampMs = row[0] * 1000;
      if (startDate && timestampMs < new Date(startDate).getTime()) return false;
      if (endDate && timestampMs > new Date(endDate).getTime()) return false;
      return true;
    })
    .slice()
    .reverse();

  // Latest quaternion for main egg model (last item in chronological order)
  const latestQuaternion: [number, number, number, number] =
    filteredRows.length > 0
      ? [filteredRows[filteredRows.length - 1][1], filteredRows[filteredRows.length - 1][2], filteredRows[filteredRows.length - 1][3], filteredRows[filteredRows.length - 1][4]]
      : [0, 0, 0, 1];

  // Animation dialog functions

  const openAnimationDialog = () => {
    const allRows = groupedData[selectedEggId] || [];
    if (allRows.length === 0) return;

    // sort oldest first
    const sortedRows = [...allRows].sort((a, b) => a[0] - b[0]);
    const startISO = new Date(sortedRows[0][0] * 1000).toISOString().slice(0, 16);
    const endISO = new Date(sortedRows[sortedRows.length - 1][0] * 1000).toISOString().slice(0, 16);

    setAnimationStartDate(startISO);
    setAnimationEndDate(endISO);
    setAnimationIndex(0);
    setIsPlaying(false);
    setAnimationOpen(true);
  };

  // Filtered rows for animation dialog (chronological order)
  const animationRows = (groupedData[selectedEggId] || []).filter(row => {
    const tsMs = row[0] * 1000;
    if (animationStartDate && tsMs < new Date(animationStartDate).getTime()) return false;
    if (animationEndDate && tsMs > new Date(animationEndDate).getTime()) return false;
    return true;
  }).sort((a,b) => a[0] - b[0]);

  // Animation playback effect
  useEffect(() => {
    if (isPlaying && animationRows.length > 0) {
      animationIntervalRef.current = setInterval(() => {
        setAnimationIndex((prev) => (prev + 1) % animationRows.length);
      }, 500);
    } else {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    }
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, [isPlaying, animationRows]);

  // Current quaternion & timestamp in animation
  const animationQuaternion: [number, number, number, number] =
    animationRows.length > 0 && animationIndex < animationRows.length
      ? [animationRows[animationIndex][1], animationRows[animationIndex][2], animationRows[animationIndex][3], animationRows[animationIndex][4]]
      : [0, 0, 0, 1];

  const animationTimestamp = animationRows.length > 0 && animationIndex < animationRows.length
    ? new Date(animationRows[animationIndex][0] * 1000).toLocaleString()
    : "";

  // Timestamps for main graph xAxis formatter
  const timestamps = filteredRows.map(row =>
    new Date(row[0] * 1000).toLocaleString()
  );

  const downloadCSV = () => {
    const header = ["timestamp", ...fieldNames];
    const csvRows = [header.join(",")];

    filteredRows.forEach((row) => {
      const timestamp = new Date(row[0] * 1000).toISOString();
      const values = row.slice(1).map((val) =>
        typeof val === "number" ? val.toFixed(6) : val
      );
      csvRows.push([timestamp, ...values].join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `egg-data-${selectedEggId || "unknown"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Box sx={{ px: "3rem", py: "2rem", width: "100%", boxSizing: "border-box" }}>
        {/* Header */}
        <Box mb={4} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h4">Egg Dashboard</Typography>
          <Button
            startIcon={<InfoIcon />}
            variant="outlined"
            onClick={() => setManualOpen(true)}
          >
            User Manual
          </Button>
        </Box>

        {/* Controls */}
        <Grid container spacing={2} alignItems="center" mb={4}>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth>
              <InputLabel>Select Egg</InputLabel>
              <Select
                value={selectedEggId}
                label="Select Egg"
                onChange={handleEggChange}
              >
                {Object.keys(groupedData).map((eggId) => (
                  <MenuItem key={eggId} value={eggId}>
                    {eggId}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <TextField
              label="Start Date"
              type="datetime-local"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <TextField
              label="End Date"
              type="datetime-local"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Button
              variant="contained"
              fullWidth
              onClick={downloadCSV}
              disabled={filteredRows.length === 0}
              sx={{ height: "100%" }}
            >
              Download CSV
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Button
              variant="contained"
              fullWidth
              onClick={openAnimationDialog}
              disabled={!selectedEggId || rows.length === 0}
            >
              View Animation
            </Button>
          </Grid>
        </Grid>

        {/* Top section with static egg model */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            gap: 4,
            mb: 5,
            flexWrap: "wrap",
          }}
        >
          <Box
            sx={{
              width: 500,
              height: 300,
              background: "#e0e0e0",
              borderRadius: 2,
              flexShrink: 0,
            }}
          >
            <Canvas camera={{ position: [0, 0, 25], fov: 45 }}>
              <ambientLight />
              <directionalLight position={[3, 3, 3]} />
              <EggModel quaternion={latestQuaternion} />
            </Canvas>
          </Box>
        </Box>

        {/* Graphs */}
        <Grid container spacing={3}>
          {graphedFields.map((field) => {
            const fieldIndex = fieldNames.indexOf(field);
            const dataPoints = filteredRows.map(row => row[fieldIndex + 1]);

            return (
              <Grid item xs={12} sm={6} md={4} key={field}>
                <Typography variant="subtitle1" gutterBottom>{field}</Typography>
                <LineChart
                  width={300}
                  height={130}
                  xAxis={[
                    {
                      data: filteredRows.map((_, i) => i),
                      valueFormatter: (val) => {
                        const idx = typeof val === "number" ? val : parseInt(val);
                        return timestamps[idx] || "";
                      },
                      tickLabelStyle: { display: "none" },
                      axisLine: { strokeWidth: 0 },
                      tickMinStep: 1,
                    }
                  ]}
                  series={[{ data: dataPoints, label: field, showMark: false }]}
                  onClick={() => setExpandedField(field)}
                />
              </Grid>
            );
          })}
        </Grid>

        {/* Expanded Chart Modal */}
        <Dialog open={Boolean(expandedField)} onClose={() => setExpandedField(null)} maxWidth="md" fullWidth>
          <Box sx={{ position: "relative", p: 2 }}>
            <IconButton
              onClick={() => setExpandedField(null)}
              sx={{ position: "absolute", right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
            {expandedField && (
              <>
                <Typography variant="h6" gutterBottom>{expandedField}</Typography>
                <LineChart
                  width={700}
                  height={350}
                  xAxis={[
                    {
                      data: filteredRows.map((_, i) => i),
                      valueFormatter: (val) => {
                        const idx = typeof val === "number" ? val : parseInt(val);
                        return timestamps[idx] || "";
                      },
                      tickLabelStyle: {
                        angle: -45,
                        textAnchor: "end",
                        fontSize: 10,
                      },
                      minStep: 1,
                    }
                  ]}
                  series={[
                    {
                      data: filteredRows.map(row => row[fieldNames.indexOf(expandedField) + 1]),
                      label: expandedField,
                      showMark: false,
                    }
                  ]}
                />
              </>
            )}
          </Box>
        </Dialog>

        {/* User Manual Dialog */}
        <Dialog open={manualOpen} onClose={() => setManualOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>User Manual</DialogTitle>
          <DialogContent dividers>
            <Typography gutterBottom>
              <strong>Replacing the Battery</strong>
              <br />
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor.
            </Typography>
            <Typography gutterBottom>
              <strong>Making More Eggs</strong>
              <br />
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce euismod consequat ante.
            </Typography>
            <Typography gutterBottom>
              <strong>Additional Setup</strong>
              <br />
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean commodo ligula eget dolor.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setManualOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Animation Dialog */}
        <Dialog open={animationOpen} onClose={() => setAnimationOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            Animation Playback
            <IconButton
              aria-label="close"
              onClick={() => setAnimationOpen(false)}
              sx={{
                position: "absolute",
                right: 8,
                top: 8,
              }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} alignItems="center" mb={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Animation Start Date"
                  type="datetime-local"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={animationStartDate}
                  onChange={(e) => {
                    setAnimationStartDate(e.target.value);
                    setAnimationIndex(0);
                  }}
                  inputProps={{ max: animationEndDate || undefined }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Animation End Date"
                  type="datetime-local"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={animationEndDate}
                  onChange={(e) => {
                    setAnimationEndDate(e.target.value);
                    setAnimationIndex(0);
                  }}
                  inputProps={{ min: animationStartDate || undefined }}
                />
              </Grid>
            </Grid>

            <Box
              sx={{
                width: "100%",
                height: 300,
                background: "#e0e0e0",
                borderRadius: 2,
                mb: 2,
              }}
            >
              <Canvas camera={{ position: [0, 0, 25], fov: 45 }}>
                <ambientLight />
                <directionalLight position={[3, 3, 3]} />
                <EggModel quaternion={animationQuaternion} />
              </Canvas>
            </Box>

            <Box mb={2}>
              <Typography variant="body2" align="center" gutterBottom>
                {animationTimestamp || "No data in this range"}
              </Typography>
              <Slider
                value={animationIndex}
                min={0}
                max={animationRows.length > 0 ? animationRows.length - 1 : 0}
                onChange={(_, value) => setAnimationIndex(value as number)}
                disabled={animationRows.length === 0}
                aria-label="animation position"
              />
            </Box>

            <Box display="flex" justifyContent="center" gap={2}>
              <Button
                variant="contained"
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={animationRows.length === 0}
                startIcon={isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
              >
                {isPlaying ? "Pause" : "Play"}
              </Button>
              <Button variant="outlined" onClick={() => setAnimationIndex(0)} disabled={animationRows.length === 0}>
                Reset
              </Button>
            </Box>
          </DialogContent>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default App;
