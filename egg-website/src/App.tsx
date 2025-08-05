import { useEffect, useState, useRef } from "react";
import { db } from "./firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { decodeBase64SensorChunk } from "./utils/base64Decoder";
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
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Grid from '@mui/material/Grid';
import CloseIcon from "@mui/icons-material/Close";
import InfoIcon from "@mui/icons-material/Info";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import UserManual from "./UserManual";
import EggTab from "./EggTab";
import SubstationTab from "./SubstationTab";

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
  const [tab, setTab] = useState(0);
  const [manualOpen, setManualOpen] = useState<boolean>(false);

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

        {/* User Manual Dialog */}
        <UserManual manualOpen={manualOpen} setManualOpen={setManualOpen}/>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_: React.SyntheticEvent, newValue: number) => {
          setTab(newValue);
        }} aria-label="tabs">
          <Tab label="Eggs"/>
          <Tab label="Substations" />
        </Tabs>
      </Box>

      <br/>

      {tab == 0 && <EggTab/>}
      {tab == 1 && <SubstationTab/>}
      </Box>
    </ThemeProvider>
  );
}

export default App;