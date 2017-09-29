const fs = require('fs')
const { exec } = require('child_process')
const { removeSync } = require('fs-extra')
const path = require('path')
const request = require('superagent')
const chalk = require('chalk')
const config = require('./config')
const pkg = require('./package.json')
const { ddHome, ddConfig, fileExists, promisify, requestAccessToken, saveConfig } = require('./utils')
const DiffMatchPatch = require('diff-match-patch')
const firebaseUtils = require('./utils/firebase')
const firebase = require('firebase')

const bundleBase = `https://firebasestorage.googleapis.com/v0/b/${config.firebase.storageBucket}/o/lib%2Fbundles%2F`

// TODO: Is this needed?
// const iosBaseBundle = `${bundleBase}base.ios.${config.baseBundleVersion}.bundle?alt=media`
// const androidBaseBundle = `${bundleBase}base.android.${config.baseBundleVersion}.bundle?alt=media`
const iosBaseManifest = `${bundleBase}base.ios.${config.baseBundleVersion}.manifest?alt=media`
const androidBaseManifest = `${bundleBase}base.android.${config.baseBundleVersion}.manifest?alt=media`

module.exports = function publish(cmd, options) {  
  if (!fileExists('package.json')) return console.log('This does not appear to be a doubledutch feature project. No package.json found.')
  const featurePackageJSON = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  if (!featurePackageJSON.doubledutch) return console.log('This does not appear to be the root folder of a DoubleDutch feature project. package.json does not have a doubledutch section.')

  if (!fileExists(ddConfig)) return console.log('You have not logged in to doubledutch. Please run ' + chalk.blue('dd login'))

  const configJSON = JSON.parse(fs.readFileSync(ddConfig, 'utf8'))

  return publishBinary(configJSON, featurePackageJSON)
    .then(result => console.log(result))
    .catch(err => console.error(err))
}

function publishBinary(accountConfig, packageJSON) {
  const featureName = packageJSON.name
  if (!featureName.match(/^[a-zA-Z0-9\-_]+$/)) {
    return Promise.reject(`Feature name in package.json (${featureName}) is not valid. Letters, numbers, -, and _ are valid.`)
  }

  console.log(`Publishing feature ${chalk.green(featureName)}@${chalk.green(packageJSON.version)} to DoubleDutch...`)

  // TODO - we should really just check the expiration of the token
  return requestAccessToken(accountConfig.username, accountConfig.refresh_token).then(accessToken => {    
    const dmp = new DiffMatchPatch()
    dmp.Diff_Timeout = 60

    removeSync('build/')
    removeSync('tmp/')

    if (!fs.existsSync('build')) {
      fs.mkdirSync('build');
    }
    if (!fs.existsSync('build/bundle')) {
      fs.mkdirSync('build/bundle');
    }
    if (!fs.existsSync('build/site')) {
      fs.mkdirSync('build/site');
    }
    if (!fs.existsSync('build/site/private')) {
      fs.mkdirSync('build/site/private');
    }
    if (!fs.existsSync('build/site/public')) {
      fs.mkdirSync('build/site/public');
    }
    if (!fs.existsSync('build/api')) {
      fs.mkdirSync('build/api');
    }
    if (!fs.existsSync('tmp')) {
      fs.mkdirSync('tmp');
    }

    console.log(`Downloading iOS and Android base bundles (version ${chalk.blue(config.baseBundleVersion)})`) 
    function streamToFile(url, file) {
      return new Promise((resolve, reject) => {
        request.get(url).pipe(fs.createWriteStream(file)).on('finish', () => resolve(file))
      })
    }   
    // TODO: Are the 2 other bundle files needed?
    return Promise.all([
      streamToFile(iosBaseManifest, `tmp/base.ios.${config.baseBundleVersion}.manifest`),
      streamToFile(androidBaseManifest, `tmp/base.android.${config.baseBundleVersion}.manifest`)
    ]).then(results => {
      const commands = []

      if (fs.existsSync('mobile')) {
        commands.push(
          //[`pushd mobile && npm run build-web`, 'Generating Web feature bundle'],
          //[`pushd mobile && cp -r web/static/ ../build/bundle/`, 'Copying Web feature bundle'],
          [`
            pushd mobile &&
            node node_modules/dd-rn-packager/react-native/local-cli/cli.js bundle 
            --dev false
            --manifest-file ../tmp/base.ios.${config.baseBundleVersion}.manifest
            --manifest-output ../build/bundle/index.ios.${config.baseBundleVersion}.manifest
            --platform ios
            --entry-file index.ios.js
            --bundle-output ../build/bundle/index.ios.${config.baseBundleVersion}.manifest.bundle
            --sourcemap-output ../build/bundle/index.ios.${config.baseBundleVersion}.sourcemap
            --post-process-modules $PWD/node_modules/dd-rn-packager/process.js
            --create-module-id-factory $PWD/node_modules/dd-rn-packager/idfactory.js
            `, chalk.blue('Building iOS')],
          [`
            pushd mobile &&
            node node_modules/dd-rn-packager/react-native/local-cli/cli.js bundle 
            --dev false
            --manifest-file ../tmp/base.android.${config.baseBundleVersion}.manifest
            --manifest-output ../build/bundle/index.android.${config.baseBundleVersion}.manifest
            --platform android
            --entry-file index.android.js
            --bundle-output ../build/bundle/index.android.${config.baseBundleVersion}.manifest.bundle
            --sourcemap-output ../build/bundle/index.android.${config.baseBundleVersion}.sourcemap
            --post-process-modules $PWD/node_modules/dd-rn-packager/process.js
            --create-module-id-factory $PWD/node_modules/dd-rn-packager/idfactory.js
            `, chalk.blue('Building Android')]
        )
      } else {
        commands.push(
          [``, chalk.yellow('mobile folder not found. Skipping build.')]
        )
      }

      if (fileExists('web/admin')) {
        commands.push(
          [`pushd web/admin && npm run build`, chalk.blue('Generating Admin web bundle')],
          [`cp -r web/admin/build/ build/site/private/`, chalk.blue('Copying Admin web bundle')]
        )
      } else {
        commands.push(
          [`echo skipping web/admin`, chalk.yellow('web/admin folder not found. Skipping build.')]
        )
      }

      if (fileExists('web/attendee')) {
        commands.push(
          [`pushd web/attendee && npm run build`, chalk.blue('Generating Attendee web bundle')],
          [`cp -r web/attendee/build/ build/site/public/`, chalk.blue('Copying Attendee web bundle')]
        )
      } else {
        commands.push(
          [``, chalk.yellow('web/attendee folder not found. Skipping build.')]
        )
      }

      commands.push(
        [`zip -r tmp/build.${config.baseBundleVersion}.zip build/`, chalk.blue('Generating zip')]
      )

      firebase.initializeApp(firebaseUtils.config)
      const promise = new Promise((resolve, reject) => {
        const runCommand = (idx) => {
          if (idx < commands.length) {
            console.log(`${commands[idx][1]}...`)
            if (commands[idx][0]) {
              exec(commands[idx][0].replace(/\n/g, ''), (err, stdout, stderr) => {
                if (err) {
                  console.error(err)
                }
                if (stderr) {
                  console.error(stderr)
                }
                runCommand(idx + 1)
              })
            } else {
              runCommand(idx + 1)
            }
          } else {
            resolve()
          }
        }

        runCommand(0)
      })

      const version = packageJSON.version
      const json = {
        cliVersion: pkg.version,
        version,
        reactNativeVersion: config.baseBundleVersion,
        mobileURL: `https://firebasestorage.googleapis.com/v0/b/bazaar-179323.appspot.com/o/features%2F${encodeURIComponent(featureName)}%2F${encodeURIComponent(version)}%2Fmobile%2Findex.__platform__.0.46.4.manifest.bundle?module=${encodeURIComponent(featureName)}&alt=media#plugin`
      }

      return promise
        .then(() => firebaseUtils.getDeveloperToken(accessToken))
        .then(firebaseToken => firebase.auth().signInWithCustomToken(firebaseToken))
        .then(user => user.getIdToken())
        .then(firebaseIdToken => {
          console.log('Done. Uploading binaries...')
          const location = `users/${firebase.auth().currentUser.uid}/staged/binaries/${featureName}/${json.version}/build.zip`
          return new Promise((resolve, reject) => {
            request.post(`https://firebasestorage.googleapis.com/v0/b/${config.firebase.storageBucket}/o?name=${encodeURIComponent(location)}`)
            .attach('metadata', Buffer.from(JSON.stringify({name: location, contentType: 'application/octet-stream'}), 'utf8'))
            .attach(location, `tmp/build.${config.baseBundleVersion}.zip`)
            .set('x-goog-upload-protocol', 'multipart')
            .set('x-firebase-storage-version', 'webjs/4.3.1')
            .set('authorization', `Firebase ${firebaseIdToken}`)
            .end((err, res) => {
              if (err) reject(err)
              if (!res.ok) reject(`Failed to upload binary: ${res.statusText}`)
              resolve(json)
            })
          })
        })
    }).catch((err) => {
      console.log(typeof err === 'string' ? chalk.red(err) : err)
      process.exit(-1)
    })
  })
}

