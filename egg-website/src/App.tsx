import { useEffect, useState, useRef } from "react";
import { db } from "./firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { decodeBase64SensorChunk } from "./utils/base64Decoder";
import { LineChart } from "@mui/x-charts/LineChart";
import {
  Typography,
  Box,
  CssBaseline,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Button,
  Slider,
  Chip,
} from "@mui/material";
import Grid from '@mui/material/Grid';
import CloseIcon from "@mui/icons-material/Close";
import InfoIcon from "@mui/icons-material/Info";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import type { SelectChangeEvent } from "@mui/material/Select";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { Canvas } from "@react-three/fiber";
import EggModel from "./EggModel";

const fieldNames = ["qx", "qy", "qz", "qw", "Temperature", "Humidity", "Light1", "Light2", "Voltage"];
const graphedFields = fieldNames.slice(4);

// Define units for each field
const fieldUnits: Record<string, string> = {
  "Temperature": "°C",
  "Humidity": "%",
  "Light1": "lux",
  "Light2": "lux",
  "Voltage": "V"
};

// Date range presets
const datePresets = [
  { label: "Last Hour", hours: 1 },
  { label: "Last 6 Hours", hours: 6 },
  { label: "Last Day", hours: 24 },
  { label: "Last 2 Days", hours: 48 },
  { label: "Last 3 Days", hours: 72 },
  { label: "Last Week", hours: 168 },
  { label: "Last 2 Weeks", hours: 336 },
  { label: "Last Month", hours: 720 },
];

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

const createChartDataWithGaps = (filteredRows: any[][], fieldIndex: number, gapThresholdMinutes: number = 20): Array<{timestamp: Date, value: number | null}> => {
  if (filteredRows.length === 0) return [];
  
  const chartData = [];
  const gapThresholdMs = gapThresholdMinutes * 60 * 1000;
  
  for (let i = 0; i < filteredRows.length; i++) {
    const row = filteredRows[i];
    const currentTimestamp = new Date(row[0] * 1000);
    
    // Add the current data point
    chartData.push({
      timestamp: currentTimestamp,
      value: row[fieldIndex + 1]
    });
    
    // Check if there's a gap to the next point
    if (i < filteredRows.length - 1) {
      const nextRow = filteredRows[i + 1];
      const nextTimestamp = new Date(nextRow[0] * 1000);
      const timeDiff = nextTimestamp.getTime() - currentTimestamp.getTime();
      
      // If gap is larger than threshold, insert null values to break the line
      if (timeDiff > gapThresholdMs) {
        // Insert a null point slightly after current point
        chartData.push({
          timestamp: new Date(currentTimestamp.getTime() + 1000), // 1 second after
          value: null
        });
        
        // Insert a null point slightly before next point
        chartData.push({
          timestamp: new Date(nextTimestamp.getTime() - 1000), // 1 second before
          value: null
        });
      }
    }
  }
  
  return chartData;
};

function App() {
  const [groupedData, setGroupedData] = useState<Record<string, any[][]>>({});
  const [selectedEggId, setSelectedEggId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState<boolean>(false);

  // Main dashboard preset state
  const [selectedMainPreset, setSelectedMainPreset] = useState<string | null>(null);

  // Animation dialog state
  const [animationOpen, setAnimationOpen] = useState(false);
  const [animationStartDate, setAnimationStartDate] = useState<string>("");
  const [animationEndDate, setAnimationEndDate] = useState<string>("");
  const [animationIndex, setAnimationIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to format timestamp to Central Time
  const formatToCentralTime = (timestampMs: number) => {
    return new Date(timestampMs).toLocaleString("en-US", { timeZone: "America/Chicago" });
  };

  // Helper to format timestamp for graph display (shorter format)
  const formatForGraph = (timestampMs: number) => {
    const date = new Date(timestampMs);
    return date.toLocaleString("en-US", { 
      timeZone: "America/Chicago",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Helper function to format date for datetime-local inputs
  const formatForDatetimeLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Helper to apply date preset for main dashboard
  const applyMainDatePreset = (hours: number) => {
    const allRows = groupedData[selectedEggId] || [];
    if (allRows.length === 0) return;

    // Get current time and calculate start time
    const now = new Date();
    const startTime = new Date(now.getTime() - (hours * 60 * 60 * 1000));
    
    // Find the actual data range within our dataset
    const sortedRows = [...allRows].sort((a, b) => a[0] - b[0]);
    const datasetStart = new Date(sortedRows[0][0] * 1000);
    const datasetEnd = new Date(sortedRows[sortedRows.length - 1][0] * 1000);
    
    // Use the later of startTime or datasetStart
    const effectiveStart = startTime > datasetStart ? startTime : datasetStart;
    // Use the earlier of now or datasetEnd
    const effectiveEnd = now < datasetEnd ? now : datasetEnd;

    setStartDate(formatForDatetimeLocal(effectiveStart));
    setEndDate(formatForDatetimeLocal(effectiveEnd));
  };

  // Helper to apply date preset for animation dialog
  const applyDatePreset = (hours: number) => {
    const allRows = groupedData[selectedEggId] || [];
    if (allRows.length === 0) return;

    // Get current time and calculate start time
    const now = new Date();
    const startTime = new Date(now.getTime() - (hours * 60 * 60 * 1000));
    
    // Find the actual data range within our dataset
    const sortedRows = [...allRows].sort((a, b) => a[0] - b[0]);
    const datasetStart = new Date(sortedRows[0][0] * 1000);
    const datasetEnd = new Date(sortedRows[sortedRows.length - 1][0] * 1000);
    
    // Use the later of startTime or datasetStart
    const effectiveStart = startTime > datasetStart ? startTime : datasetStart;
    // Use the earlier of now or datasetEnd
    const effectiveEnd = now < datasetEnd ? now : datasetEnd;

    setAnimationStartDate(formatForDatetimeLocal(effectiveStart));
    setAnimationEndDate(formatForDatetimeLocal(effectiveEnd));
    setAnimationIndex(0);
  };

  // Fetch data effect
  useEffect(() => {
    const fetchData = async () => {
      try {
        const eggsSnapshot = await getDocs(collection(db, "eggs2"));
        const grouped: Record<string, any[][]> = {};

        for (const eggDoc of eggsSnapshot.docs) {
          const eggId = eggDoc.id;
          const datapointsRef = collection(db, "eggs2", eggId, "datapoints");
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

              console.log("Decoded Row Example:", decodedChunks[0]);

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
    const startISO = formatForDatetimeLocal(new Date(sortedRows[0][0] * 1000));
    const endISO = formatForDatetimeLocal(new Date(sortedRows[sortedRows.length - 1][0] * 1000));

    setAnimationStartDate(startISO);
    setAnimationEndDate(endISO);
    setAnimationIndex(0);
    setIsPlaying(false);
    setSelectedPreset(null);
    setAnimationOpen(true);
  };

  const closeAnimationDialog = () => {
    setIsPlaying(false);
    setAnimationIndex(0);
    setSelectedPreset(null);
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
    setAnimationOpen(false);
  };

  // Handle main dashboard preset selection
  const handleMainPresetClick = (preset: typeof datePresets[0]) => {
    setSelectedMainPreset(preset.label);
    applyMainDatePreset(preset.hours);
  };

  // Handle animation preset selection
  const handlePresetClick = (preset: typeof datePresets[0]) => {
    setSelectedPreset(preset.label);
    applyDatePreset(preset.hours);
  };

  // Handle manual date changes for main dashboard (clear preset selection)
  const handleMainDateChange = (field: 'start' | 'end', value: string) => {
    setSelectedMainPreset(null);
    if (field === 'start') {
      setStartDate(value);
    } else {
      setEndDate(value);
    }
  };

  // Handle manual date changes for animation dialog (clear preset selection)
  const handleAnimationDateChange = (field: 'start' | 'end', value: string) => {
    setSelectedPreset(null);
    if (field === 'start') {
      setAnimationStartDate(value);
    } else {
      setAnimationEndDate(value);
    }
    setAnimationIndex(0);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedMainPreset(null);
    setStartDate("");
    setEndDate("");
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
        animationIntervalRef.current = null;
      }
    }
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
    };
  }, [isPlaying, animationRows]);

  // Current quaternion & timestamp in animation
  const animationQuaternion: [number, number, number, number] =
    animationRows.length > 0 && animationIndex < animationRows.length
      ? [animationRows[animationIndex][1], animationRows[animationIndex][2], animationRows[animationIndex][3], animationRows[animationIndex][4]]
      : [0, 0, 0, 1];

  const animationTimestamp = animationRows.length > 0 && animationIndex < animationRows.length
    ? formatToCentralTime(animationRows[animationIndex][0] * 1000)
    : "";

  const downloadCSV = () => {
    const header = ["timestamp", ...fieldNames];
    const csvRows = [header.join(",")];

    filteredRows.forEach((row) => {
      const dt = new Date(row[0] * 1000);
      const timestamp = dt.toISOString(); // leave as UTC ISO here
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
      <Box sx={{ 
        px: { xs: "1rem", sm: "2rem", md: "3rem" }, 
        py: { xs: "1rem", sm: "2rem" }, 
        width: "100%", 
        boxSizing: "border-box" 
      }}>
        {/* Header */}
        <Box mb={4} display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Typography variant="h4" sx={{ fontSize: { xs: "1.5rem", sm: "2rem", md: "2.125rem" } }}>
            Egg Dashboard
          </Typography>
          <Button
            startIcon={<InfoIcon />}
            variant="outlined"
            onClick={() => setManualOpen(true)}
            size="small"
          >
            User Manual
          </Button>
        </Box>

        {/* Controls */}
        <Grid container spacing={2} alignItems="center" mb={4}>
          <Grid size={{xs:12, sm:12, md:6, lg:4}}>
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
          <Grid size={{xs: 12, sm: 6, md:3, lg:2}}>
            <TextField
              label="Start Date"
              type="datetime-local"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={(e) => handleMainDateChange('start', e.target.value)}
            />
          </Grid>
          <Grid size={{xs: 12, sm: 6, md:3, lg:2}}>
            <TextField
              label="End Date"
              type="datetime-local"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={(e) => handleMainDateChange('end', e.target.value)}
            />
          </Grid>
          <Grid size={{xs: 12, sm: 6, md:6, lg:2}}>
            <Button
              variant="contained"
              fullWidth
              onClick={downloadCSV}
              disabled={filteredRows.length === 0}
              sx={{ height: { xs: "48px", sm: "56px" } }}
            >
              Download CSV
            </Button>
          </Grid>
          <Grid size={{xs: 12, sm: 6, md:6, lg:2}}>
            <Button
              variant="contained"
              fullWidth
              onClick={openAnimationDialog}
              disabled={!selectedEggId || rows.length === 0}
              sx={{ height: { xs: "48px", sm: "56px" } }}
            >
              View Animation
            </Button>
          </Grid>
        </Grid>

        {/* Date Range Presets */}
        <Box mb={4}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
            <Typography variant="subtitle1">
              Quick Date Ranges:
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={clearAllFilters}
              disabled={!startDate && !endDate && !selectedMainPreset}
            >
              Clear Filters
            </Button>
          </Box>
          <Box display="flex" flexWrap="wrap" gap={1}>
            {datePresets.map((preset) => (
              <Chip
                key={preset.label}
                label={preset.label}
                onClick={() => handleMainPresetClick(preset)}
                variant={selectedMainPreset === preset.label ? "filled" : "outlined"}
                color={selectedMainPreset === preset.label ? "primary" : "default"}
                size="small"
                sx={{ cursor: "pointer" }}
              />
            ))}
          </Box>
        </Box>

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
              width: { xs: "100%", sm: "90%", md: 500 },
              height: { xs: 250, sm: 300 },
              maxWidth: 500,
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
            const unit = fieldUnits[field] || "";
            
            // Create data with actual timestamps for x-axis
            const chartData = createChartDataWithGaps(filteredRows, fieldIndex);

            return (
              <Grid size={{xs: 12, sm: 6, lg: 4}} key={field}>
                <Typography variant="subtitle1" gutterBottom>{field}</Typography>
                <Box sx={{ width: "100%", overflowX: "auto" }}>
                  <LineChart
                    width={Math.min(300, window.innerWidth - 40)}
                    height={130}
                    xAxis={[
                      {
                        dataKey: 'timestamp',
                        scaleType: 'time',
                        valueFormatter: (val: any) => formatForGraph(val.getTime()),
                        tickLabelStyle: { display: "none" },
                        label: "Time",
                      }
                    ]}
                    yAxis={[
                      {
                        label: unit,
                        labelStyle: { textAnchor: "middle" },
                      }
                    ]}
                    dataset={chartData}
                    series={[{ dataKey: 'value', label: field, showMark: false }]}
                    onClick={() => setExpandedField(field)}
                  />
                </Box>
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
                {(() => {
                  const fieldIndex = fieldNames.indexOf(expandedField);
                  const chartData = createChartDataWithGaps(filteredRows, fieldIndex);

                  return (
                    <LineChart
                      width={700}
                      height={400}
                      margin={{ top: 20, right: 30, bottom: 80, left: 60 }}
                      xAxis={[
                        {
                          dataKey: 'timestamp',
                          scaleType: 'time',
                          valueFormatter: (val: any) => formatForGraph(val.getTime()),
                          tickLabelStyle: {
                            angle: -45,
                            textAnchor: "end",
                            fontSize: 10,
                          },
                          label: "Time",
                          labelStyle: { textAnchor: "middle" },
                        }
                      ]}
                      yAxis={[
                        {
                          label: fieldUnits[expandedField] || "",
                          labelStyle: { textAnchor: "middle" },
                        }
                      ]}
                      dataset={chartData}
                      series={[
                        {
                          dataKey: 'value',
                          label: expandedField,
                          showMark: false,
                        }
                      ]}
                    />
                  );
                })()}
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
              You need to replace the battery when the board stops sending data to the website, or if the battery life data shows that the battery's voltage is lower than 3.3V. To change the battery, remove the egg from the nest, unscrew the egg, remove the electronics, carefully remove the coin cell battery, and replace it with another 3.7V coin cell battery. After doing so, place the electronics in the same orientation that you took them out in.
            </Typography>
            <Typography gutterBottom>
              <strong>Additional Info</strong>
              <br />
              If there are any other issues with egg, and the battery doesn't need replacing, please refer to our troubleshooting document: <a href="https://docs.google.com/document/d/19CBC4rIUEdT4I1EIvMb0IMWKUA1XhVZScopWvVigAXk/edit?tab=t.0">link</a>
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setManualOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Animation Dialog */}
        <Dialog open={animationOpen} onClose={closeAnimationDialog} maxWidth="lg" fullWidth>
          <DialogTitle>
            Animation Playback
            <IconButton
              aria-label="close"
              onClick={closeAnimationDialog}
              sx={{
                position: "absolute",
                right: 8,
                top: 8,
              }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ px: { xs: 1, sm: 3 } }}>
            {/* Date Range Presets */}
            <Box mb={3}>
              <Typography variant="subtitle2" gutterBottom>
                Quick Date Ranges:
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {datePresets.map((preset) => (
                  <Chip
                    key={preset.label}
                    label={preset.label}
                    onClick={() => handlePresetClick(preset)}
                    variant={selectedPreset === preset.label ? "filled" : "outlined"}
                    color={selectedPreset === preset.label ? "primary" : "default"}
                    size="small"
                    sx={{ cursor: "pointer" }}
                  />
                ))}
              </Box>
            </Box>

            {/* Manual Date Selection */}
            <Grid container spacing={2} alignItems="center" mb={2}>
              <Grid size={{xs: 12, sm: 6}}>
                <TextField
                  label="Animation Start Date"
                  type="datetime-local"
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={animationStartDate}
                  onChange={(e) => handleAnimationDateChange('start', e.target.value)}
                  inputProps={{ max: animationEndDate || undefined }}
                />
              </Grid>
              <Grid size={{xs: 12, sm: 6}}>
                <TextField
                  label="Animation End Date"
                  type="datetime-local"
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={animationEndDate}
                  onChange={(e) => handleAnimationDateChange('end', e.target.value)}
                  inputProps={{ min: animationStartDate || undefined }}
                />
              </Grid>
            </Grid>

            <Box
              sx={{
                width: "100%",
                height: { xs: 250, sm: 300 },
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
              <Typography 
                variant="body2" 
                align="center" 
                gutterBottom
                sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" } }}
              >
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

            <Box display="flex" justifyContent="center" gap={2} flexWrap="wrap">
              <Button
                variant="contained"
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={animationRows.length === 0}
                startIcon={isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                size="small"
              >
                {isPlaying ? "Pause" : "Play"}
              </Button>
              <Button 
                variant="outlined" 
                onClick={() => setAnimationIndex(0)} 
                disabled={animationRows.length === 0}
                size="small"
              >
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