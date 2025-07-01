echo "Installing Nodejs"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

\. "$HOME/.nvm/nvm.sh"

nvm install 22

node -v

npm i

echo "Installing python"

apt-get update
apt install python3-pip
pip3 install bleak
pip3 install firebase-admin
