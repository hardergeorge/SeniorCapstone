## Instructions for setting up x-forwarding from a Google Compute Engine VM to one of the `flip` engr servers:

**On flip:**
```bash
wget https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-sdk-146.0.0-linux-x86_64.tar.gz
tar -xf google-cloud-sdk-146.0.0-linux-x86_64.tar.gz
./google-cloud-sdk/install.sh
```


**On Google Compute Engine VM:**
```bash
sudo apt-get install packagekit-gtk3-module
sudo apt-get install xauth

# Edit the ssh config:
sudo vim /etc/ssh/ssh_config
# uncomment lines below and replace 'no' with 'yes'
# ForwardX11 no
# ForwardX11Trusted yes
#
# add 'X11UseLocalhost no' on new line below the above 2 lines

# Reboot
sudo reboot
```

**On flip:**
```bash
# Now reconnect using gcloud command from Google Cloud Console,
# but add the flag: --ssh-flag=-Y
gcloud compute ssh [machine-name] --ssh-flag=-Y
```

## Instructions for installing image processor dependencies on a GCE VM
```bash
# to install the Jinja2 python library
sudo pip3 install Jinja2

# To get opencv setup on the VM
git clone https://github.com/opencv/opencv
git clone https://github.com/opencv/opencv_contrib
cd opencv
git checkout 3.0.0
cd ../opencv_contrib
git checkout 3.0.0
cd ..

sudo apt-get install python3.4-dev python3-pip
sudo apt-get install build-essential
sudo apt-get install cmake git libgtk2.0-dev pkg-config libavcodec-dev libavformat-dev libswscale-dev
sudo apt-get install python-dev python-numpy libtbb2 libtbb-dev libjpeg-dev libpng-dev libtiff-dev libjasper-dev libdc1394-22-dev
sudo pip3 install numpy

cd opencv
mkdir release
cd release
cmake -D CMAKE_BUILD_TYPE=RELEASE -D CMAKE_INSTALL_PREFIX=/usr/local -D OPENCV_EXTRA_MODULES_PATH=[path-to]/opencv_contrib/modules ..
make
sudo make install

sudo ldconfig

# To install gflags
$ git clone https://github.com/gflags/gflags
$ cd gflags
$ mkdir build && cd build
$ cmake ..
$ make
$ sudo make install
```
