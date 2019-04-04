#!/usr/bin/env node
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

// Notify user of any updates to the CLI
const updateNotifier = require('update-notifier')
const pkg = require('./package.json')
const buildMobile = require('./buildMobile')

module.exports = { buildMobile }

updateNotifier({pkg, isGlobal: true}).notify()

// Parse CLI
const program = require('commander').name('doubledutch').version(pkg.version)

const list = val => val.split(',')
const keyValuePairs = val => list(val).reduce((obj, kvp) => {
  [k,v] = kvp.split(':')
  obj[k]=v
  return obj
}, {})

program
  .command('init')
  .description('initializes a new DoubleDutch extension in the current empty folder')
  .action(require('./init'))

program
  .command('install <eventID>')
  .description('installs the DoubleDutch extension to an event')
  .action(require('./install'))

program
  .command('installs')
  .option('-t, --tokens <region:token>', 'Use region-specific tokens for event lookups', keyValuePairs)
  .description('lists events where the current extension has been installed')
  .action(require('./installs'))

program
  .command('login')
  .description('sets your doubledutch developer account credentials')
  .action(require('./login'))

program
  .command('publish')
  .option('-s, --skipBuild', 'Skip rebuilding. Only ZIP and publish')
  .option('-f, --force', 'Allow republishing an existing version')
  .option('-a, --apiOnly', 'Deploys only the cloud functions')
  .option('-I, --iosOnly', 'Deploys only the iOS mobile package')
  .description('publishes the DoubleDutch extension in the current folder')
  .action(require('./publish'))

program
  .command('serve')
  .description('Runs the React Native bundle server')
  .action(require('./serve'))

program
  .command('rename <name>')
  .description('Dangerous. Renames the current extension. Run ONLY on a git repository with no pending commits.')
  .action(require('./rename'))

program
  .command('upgrade-rn')
  .description('Dangerous. Updates the React Native version of the mobile folder of the current project to 0.59.3. Run ONLY on a git repository with no pending commits.')
  .action(require('./upgradeReactNative'))

program.parse(process.argv.length > 2 ? process.argv : [...process.argv, '--help'])
