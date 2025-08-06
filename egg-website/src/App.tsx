import { useEffect, useState, useRef } from "react";
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
          <Tab label="Dataview" />
        </Tabs>
      </Box>

      <br/>

      {tab == 0 && <EggTab/>}
      {tab == 1 && <SubstationTab/>}
      {tab == 2 && <Dataview/>}
      </Box>
    </ThemeProvider>
  );
}

export default App;