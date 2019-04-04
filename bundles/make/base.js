// Anything reachable via `import` from here will be included in the base Javascript bundles.
// Create a new bundle:
// 1. Update /bundles/make/package.json with desired versions of dependencies
// 2. Update `baseBundleVersion` in /config.js, by convention matching the React Native version you are using.
// 3. From the /bundles/make folder, run make.sh.

import React from 'react'
import ReactNative from 'react-native'
import FetchBlob from 'rn-fetch-blob'
import Camera from 'react-native-camera'
import Video from 'react-native-video'
import YouTube from 'react-native-youtube'
import Mailer from 'react-native-mail'
import Permissions from 'react-native-permissions'
