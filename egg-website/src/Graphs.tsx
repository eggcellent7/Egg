import { LineChart } from "@mui/x-charts/LineChart";
import CloseIcon from "@mui/icons-material/Close";

import {
  Typography,
  Box,
  Dialog,
  IconButton,
  Card,
  CardContent,
} from "@mui/material";
import Grid from '@mui/material/Grid';

const fieldNames = ["qx", "qy", "qz", "qw", "Temperature", "Humidity", "Light1", "Light2", "Voltage"];
const graphedFields = fieldNames.slice(4).filter(field => field !== "Light1" && field !== "Light2");

// Define units for each field
const fieldUnits: Record<string, string> = {
  "Temperature": "°C",
  "Humidity": "%",
  "Voltage": "V"
};

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

function Graphs({expandedField, setExpandedField, filteredRows}: {[key: string]: any})
{
    return <><Grid container spacing={3}>
        {graphedFields.map((field) => {
        const fieldIndex = fieldNames.indexOf(field);
        const unit = fieldUnits[field] || "";
        
        // Create data with actual timestamps for x-axis
        const chartData = createChartDataWithGaps(filteredRows, fieldIndex);

        return (
            <Grid size={{xs: 12, sm: 6, lg: 4}} key={field}>
            <Card 
              sx={{ 
                height: "100%",
                cursor: "pointer",
                transition: "all 0.2s ease-in-out",
                "&:hover": {
                  boxShadow: "0 4px 12px rgba(25, 118, 210, 0.15)",
                  transform: "translateY(-2px)",
                },
              }}
              onClick={() => setExpandedField(field)}
            >
              <CardContent>
                <Typography 
                  variant="subtitle1" 
                  gutterBottom
                  sx={{ 
                    fontWeight: 600,
                    color: "primary.dark",
                    mb: 1,
                  }}
                >
                  {field}
                </Typography>
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
                    series={[{ 
                      dataKey: 'value', 
                      label: field, 
                      showMark: false,
                      color: "#1976d2",
                    }]}
                    />
                </Box>
              </CardContent>
            </Card>
            </Grid>
        );
        })}
    </Grid>

    {/* Expanded Chart Modal */}
    <Dialog open={Boolean(expandedField)} onClose={() => setExpandedField(null)} maxWidth="md" fullWidth>
        <Box sx={{ position: "relative", p: 3 }}>
        <IconButton
            onClick={() => setExpandedField(null)}
            sx={{ 
              position: "absolute", 
              right: 8, 
              top: 8,
              color: "text.secondary",
              "&:hover": {
                backgroundColor: "secondary.main",
                color: "primary.main",
              },
            }}
        >
            <CloseIcon />
        </IconButton>
        {expandedField && (
            <>
            <Typography 
              variant="h6" 
              gutterBottom
              sx={{ 
                fontWeight: 600,
                color: "primary.dark",
                mb: 2,
              }}
            >
              {expandedField}
            </Typography>
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
                        color: "#1976d2",
                    }
                    ]}
                />
                );
            })()}
            </>
        )}
        </Box>
    </Dialog></>
}

export { Graphs, fieldNames }