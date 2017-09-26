const fs = require('fs')
const { removeSync } = require('fs-extra')
const path = require('path')
const request = require('superagent')
const chalk = require('chalk')
const config = require('./config')
const pkg = require('./package.json')
const { ddHome, ddConfig, fileExists, promisify, requireHome, saveConfig } = require('./utils')
const DiffMatchPatch = require('diff-match-patch')
const firebaseUtils = require('./utils/firebase')
const firebase = require('firebase/app')
require('firebase/storage')

module.exports = function publish(cmd, options) {
  const iosBaseBundle = `https://dd-bazaar.s3.amazonaws.com/lib/bundles/base.ios.${config.baseBundleVersion}.bundle?raw=true`
  const androidBaseBundle = `https://dd-bazaar.s3.amazonaws.com/lib/bundles/base.android.${config.baseBundleVersion}.bundle?raw=true`
  const iosBaseManifest = `https://dd-bazaar.s3.amazonaws.com/lib/bundles/base.ios.${config.baseBundleVersion}.manifest`
  const androidBaseManifest = `https://dd-bazaar.s3.amazonaws.com/lib/bundles/base.android.${config.baseBundleVersion}.manifest`
  
  if (!fileExists('doubledutch.json')) return console.log('This does not appear to be a doubledutch feature project. doubledutch.json not found')
  if (!fileExists(ddConfig)) return console.log('You have not logged in to doubledutch. Please run ' + chalk.blue('dd login'))

  const configJSON = JSON.parse(fs.readFileSync(ddConfig, 'utf8'))
  const featureJSON = JSON.parse(fs.readFileSync('doubledutch.json', 'utf8'))

  return publishBinary(configJSON, featureJSON, pkg)
    .then(result => console.log(result))
    .catch(err => console.error(err))
}

function publishBinary(accountConfig, ddJson, packageJSON) {
  const featureName = packageJSON.name
  // TODO - we should really just check the expiration of the token
  return requestAccessToken(accountConfig.username, accountConfig.refresh_token).then(accessToken => {
    const featureURL = config.root_url + '/api/features' + (featureName ? ('/' + featureName) : '')

    // TODO - set this on server based on token
    ddJson.developer = { name: '', email: accountConfig.username, phone: '' }

    console.log(`Downloading iOS and Android base bundles (version ${chalk.blue(config.baseBundleVersion)})`)
    return Promise.all([
      promisify(request.get(iosBaseBundle), 'end').then(res => res.text),
      promisify(request.get(androidBaseBundle), 'end').then(res => res.text),
      promisify(request.get(iosBaseManifest), 'end').then(res => res.text),
      promisify(request.get(androidBaseManifest), 'end').then(res => res.text)
    ]).then((results) => {
      const [iosBase, androidBase, iosManifest, androidManifest] = results
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

      fs.writeFileSync(`tmp/base.ios.${config.baseBundleVersion}.bundle`, iosBase, { encoding: 'utf8' })
      fs.writeFileSync(`tmp/base.android.${config.baseBundleVersion}.bundle`, androidBase, { encoding: 'utf8' })

      fs.writeFileSync(`tmp/base.ios.${config.baseBundleVersion}.manifest`, iosManifest, { encoding: 'utf8' })
      fs.writeFileSync(`tmp/base.android.${config.baseBundleVersion}.manifest`, androidManifest, { encoding: 'utf8' })

      const commands = []

      if (ddJson.components.mobile.enabled) {
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
          [``, chalk.yellow('Mobile build not enabled')]
        )
      }

      if (ddJson.components.adminWeb.enabled) {
        commands.push(
          [`pushd web/admin && npm run build`, chalk.blue('Generating Admin web bundle')],
          [`cp -r web/admin/build/ build/site/private/`, chalk.blue('Copying Admin web bundle')]
        )
      } else {
        commands.push(
          [``, chalk.yellow('Admin web build not enabled')]
        )
      }

      if (ddJson.components.attendeeWeb.enabled) {
        commands.push(
          [`pushd web/attendee && npm run build`, chalk.blue('Generating Attendee web bundle')],
          [`cp -r web/attendee/build/ build/site/public/`, chalk.blue('Copying Attendee web bundle')]
        )
      } else {
        commands.push(
          [``, chalk.yellow('Attendee web build not enabled')]
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
            superagent.post(`https://firebasestorage.googleapis.com/v0/b/${config.firebase.storageBucket}/o?name=${encodeURIComponent(location)}`)
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
        .catch((err) => {
          console.log(err)
          process.exit(-1)
        })
    })
  })
}

function requestAccessToken(username, refresh_token) {
  return promisify(request.post(`${config.identity.rootUrl}/access/tokens`)
    .auth(config.identity.cli.identifier, config.identity.cli.secret)
    .type('form')
    .send({ grant_type: 'refresh_token', refresh_token: refresh_token }))
    .then(res => {
      if (!res.ok) throw 'Invalid credentials. Please run ' + chalk.blue('dd login')
      return res.json()
    }).then(result => {
      saveConfig(username, result)
      return result.access_token
    })
}
