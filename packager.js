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
const config = require('./config')

module.exports = build

async function build({baseManifestFilename, entry, manifestOut, out, platform, root}) {
  const baseManifest = fs.existsSync(baseManifestFilename) ? JSON.parse(fs.readFileSync(baseManifestFilename)) : null

  const opts = {
    config: {
      createModuleIdFactory: idFactory(baseManifest),
      postProcessModules: postProcessor(baseManifest, manifestOut),
    },
    dev: false,
    entry,
    optimize: true,
    out,
    platform,
    projectRoots: [root, path.join(root, 'node_modules')],
    sourceMap: true,
  }

  return await metro.runBuild(opts)

  function idFactory(manifestFileContents) {
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

  function postProcessor(manifestFileContents, manifestOutputFile) {
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

  function getPathForModule(module) {
    return module.path
      .replace(root + '/node_modules/', '')
      .replace(root, '.')
  }
}
