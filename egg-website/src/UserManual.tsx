import {
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
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
        <DialogTitle>User Manual</DialogTitle>
        <DialogContent dividers>
        <Typography gutterBottom>
            <strong>Replacing the Battery</strong>
            <br />
            {battery_replace_str}
        </Typography>
        <Typography gutterBottom>
            <strong>Additional Info</strong>
            <br />
            {additionl_info_str}
            <a href="https://docs.google.com/document/d/19CBC4rIUEdT4I1EIvMb0IMWKUA1XhVZScopWvVigAXk/edit?tab=t.0">link</a>
        </Typography>
        </DialogContent>
        <DialogActions>
        <Button onClick={() => setManualOpen(false)}>Close</Button>
        </DialogActions>
    </Dialog>
}

export default UserManual