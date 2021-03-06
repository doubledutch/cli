/*
 * Copyright 2018 DoubleDutch, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const fs = require('fs')
const path = require('path')
const metro = require('metro')

module.exports = { build, createConnectMiddleware, runServer }

function getMetroConfig(baseManifestFilename, root, port) {
  const baseManifest = fs.existsSync(baseManifestFilename) ? JSON.parse(fs.readFileSync(baseManifestFilename)) : null
  const pathForModule = pathForModuleProvider(root)
  const moduleNotInBaseBundle = baseManifest
    ? m => !baseManifest.modules[pathForModule(m)] && m.path !== '__prelude__' && !m.path.endsWith('/node_modules/metro/src/lib/polyfills/require.js')
    : () => true
  return {
    resolver: {
      providesModuleNodeModules: ['react-native'],
      resolverMainFields: ['react-native', 'browser', 'main'],
      hasteImplModulePath: path.join(root, 'node_modules/react-native/jest/hasteImpl.js'),
      blacklistRE: /(.*\/__fixtures__\/.*|node_modules[\/\\]react[\/\\]dist[\/\\].*|website\/node_modules\/.*|heapCapture\/bundle\.js|.*\/__tests__\/.*)$/,
    },
    transformer: {
      babelTransformerPath: require.resolve('metro-react-native-babel-transformer')
    },
    serializer: {
      createModuleIdFactory: idFactory(baseManifest, root),
      getModulesRunBeforeMainModule: () => [
        path.join(root, 'node_modules/react-native/Libraries/Core/InitializeCore.js')
      ],
      getPolyfills: require(path.join(root, 'node_modules/react-native/rn-get-polyfills')),
      processModuleFilter: moduleNotInBaseBundle
    },
    server: {port},
    projectRoot: root,
    watchFolders: [root, path.join(root, 'node_modules'), path.join(__dirname, 'node_modules')],
  }
} 

async function build({baseManifestFilename, entry, out, platform, root, processModuleFilter, createModuleIdFactory}) {
  const config = getMetroConfig(baseManifestFilename, root)

  if (processModuleFilter) {
    config.serializer.processModuleFilter = processModuleFilter
  }

  if (createModuleIdFactory) {
    config.serializer.createModuleIdFactory = createModuleIdFactory
  }

  const opts = {
    dev: false,
    entry,
    optimize: true,
    out,
    platform,
    sourceMap: true,
  }

  return await metro.runBuild(config, opts)
}

async function createConnectMiddleware({baseManifestFilename, root, port}) {
  const config = getMetroConfig(baseManifestFilename, root, port)
  const opts = {}
  return await metro.createConnectMiddleware(config, opts)
}

async function runServer({baseManifestFilename, root, port}) {
  const config = getMetroConfig(baseManifestFilename, root, port)
  const opts = {}
  return await metro.runServer(config, opts)
}

function idFactory(manifestFileContents, root) {
  const getPathForModule = pathForModuleProvider(root)
  return function createModuleIdFactory() {
    const fileToIdMap = new Map()
    let nextId = manifestFileContents ? getNextIdAfterBaseManifest(manifestFileContents) : 0

    return path => {
      const sourcePath = getPathForModule({path})

      // If module is in the base manifest, return its ID
      if (manifestFileContents && manifestFileContents.modules[sourcePath]) {
        return manifestFileContents.modules[sourcePath].id
      }

      // Otherwise, get it from the map or create a new ID
      if (!fileToIdMap.has(path)) {
        fileToIdMap.set(path, nextId)
        nextId += 1
      }
      return fileToIdMap.get(path)
    }
  }

  function getNextIdAfterBaseManifest(manifestFileContents) {
    return Object.keys(manifestFileContents.modules).reduce((id, key) => {
      if (manifestFileContents.modules[key].id > id) {
        return manifestFileContents.modules[key].id
      }
      return id
    }, 0) + 1
  }
}

function postProcessor(manifestFileContents, manifestOutputFile, root) {
  const getPathForModule = pathForModuleProvider(root)
  return function (modules) {
    if (manifestFileContents) {
      modules = modules.filter((module) => !manifestFileContents.modules[getPathForModule(module)])
    }

    if (manifestOutputFile) {
      const manifest = {
        modules: modules.reduce((manifest, module) => {
          manifest[getPathForModule(module)] = { id: module.id }
          return manifest
        }, {})
      }
      fs.writeFileSync(manifestOutputFile, JSON.stringify(manifest, 2, 2), 'utf8')
    }

    return modules;
  }
}

function pathForModuleProvider(root) {
  return module => module.path
    .replace(root + '/node_modules/', '')
    .replace(root, '.')
}
