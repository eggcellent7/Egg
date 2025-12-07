import {
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
} from "@mui/material";

let battery_replace_str = ""
+ "You need to replace the battery when the board stops sending data to the website."
+ "To change the battery, remove the egg from the nest, unscrew the egg,"
+ "remove the electronics, carefully unplug the 3.7V lithium ion battery," 
+ "and plug in another charged 3.7V lithium ion battery. " 
+ "After doing so, place the electronics in the same orientation that you took them out in."

const additionl_info_str = "" 
+ "If there are any other issues with egg, and the battery doesn't need replacing, please refer to our troubleshooting document: "

function UserManual({manualOpen, setManualOpen}: any)
{
    return <Dialog open={manualOpen} onClose={() => setManualOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ 
          backgroundColor: "primary.main",
          color: "white",
          fontWeight: 600,
        }}>
          User Manual
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: "primary.dark", mb: 1 }}>
              Replacing the Battery
            </Typography>
            <Typography variant="body1" sx={{ color: "text.primary", lineHeight: 1.7 }}>
              {battery_replace_str}
            </Typography>
          </Box>
          <Box>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: "primary.dark", mb: 1 }}>
              Additional Info
            </Typography>
            <Typography variant="body1" sx={{ color: "text.primary", lineHeight: 1.7, mb: 1 }}>
              {additionl_info_str}
            </Typography>
            <Button 
              variant="outlined" 
              href="https://docs.google.com/document/d/19CBC4rIUEdT4I1EIvMb0IMWKUA1XhVZScopWvVigAXk/edit?tab=t.0"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                borderColor: "primary.main",
                color: "primary.main",
                "&:hover": {
                  borderColor: "primary.dark",
                  backgroundColor: "secondary.main",
                },
              }}
            >
              View Troubleshooting Document
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setManualOpen(false)}
            variant="contained"
          >
            Close
          </Button>
        </DialogActions>
    </Dialog>
}

export default UserManual