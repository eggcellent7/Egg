import { useState } from "react";
import {
  Typography,
  Box,
  CssBaseline,
  Button,
} from "@mui/material";
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import InfoIcon from "@mui/icons-material/Info";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import UserManual from "./UserManual";
import EggTab from "./EggTab";
import SubstationTab from "./SubstationTab";
import Dataview from "./Dataview"

const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1976d2", // Professional blue
      light: "#42a5f5",
      dark: "#1565c0",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#e3f2fd", // Very light blue
      light: "#f5f9ff",
      dark: "#bbdefb",
      contrastText: "#1976d2",
    },
    background: {
      default: "#f5f7fa", // Light neutral gray
      paper: "#ffffff",
    },
    text: {
      primary: "#1a1a1a",
      secondary: "#666666",
    },
    divider: "#e0e0e0",
  },
  typography: {
    fontFamily: "'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif",
    h4: {
      fontWeight: 600,
      color: "#0d47a1", // Navy accent
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    subtitle1: {
      fontWeight: 500,
    },
    button: {
      textTransform: "none",
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: "8px 16px",
        },
        contained: {
          boxShadow: "0 2px 4px rgba(25, 118, 210, 0.2)",
          "&:hover": {
            boxShadow: "0 4px 8px rgba(25, 118, 210, 0.3)",
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 500,
          fontSize: "0.95rem",
          minHeight: 48,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
        elevation1: {
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        },
      },
    },
  },
});



function App() {
  const [tab, setTab] = useState(0);
  const [manualOpen, setManualOpen] = useState<boolean>(false);

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Box sx={{ 
        minHeight: "100vh",
        backgroundColor: "background.default",
        px: { xs: "1rem", sm: "2rem", md: "3rem" }, 
        py: { xs: "1.5rem", sm: "2rem", md: "2.5rem" }, 
        width: "100%", 
        boxSizing: "border-box" 
      }}>
        {/* Header */}
        <Box 
          mb={4} 
          display="flex" 
          justifyContent="space-between" 
          alignItems="center" 
          flexWrap="wrap" 
          gap={2}
          sx={{
            backgroundColor: "background.paper",
            p: 3,
            borderRadius: 2,
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
          }}
        >
          <Typography 
            variant="h4" 
            sx={{ 
              fontSize: { xs: "1.5rem", sm: "2rem", md: "2.125rem" },
              fontWeight: 600,
              color: "primary.dark",
            }}
          >
            Egg Dashboard
          </Typography>
          <Button
            startIcon={<InfoIcon />}
            variant="outlined"
            onClick={() => setManualOpen(true)}
            size="medium"
            sx={{
              borderColor: "primary.main",
              color: "primary.main",
              "&:hover": {
                borderColor: "primary.dark",
                backgroundColor: "secondary.main",
              },
            }}
          >
            User Manual
          </Button>
        </Box>

        {/* User Manual Dialog */}
        <UserManual manualOpen={manualOpen} setManualOpen={setManualOpen}/>

        {/* Tabs */}
        <Box 
          sx={{ 
            backgroundColor: "background.paper",
            borderRadius: 2,
            px: 2,
            mb: 3,
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
          }}
        >
          <Tabs 
            value={tab} 
            onChange={(_: React.SyntheticEvent, newValue: number) => {
              setTab(newValue);
            }} 
            aria-label="tabs"
            sx={{
              "& .MuiTab-root": {
                color: "text.secondary",
                "&.Mui-selected": {
                  color: "primary.main",
                },
              },
              "& .MuiTabs-indicator": {
                backgroundColor: "primary.main",
              },
            }}
          >
            <Tab label="Eggs"/>
            <Tab label="Substations" />
            <Tab label="Dataview" />
          </Tabs>
        </Box>

        {/* Tab Content */}
        <Box sx={{ mt: 2 }}>
          {tab == 0 && <EggTab/>}
          {tab == 1 && <SubstationTab/>}
          {tab == 2 && <Dataview/>}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;