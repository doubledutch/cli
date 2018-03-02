#!/usr/bin/env node

// Notify user of any updates to the CLI
const updateNotifier = require('update-notifier')
const pkg = require('./package.json')
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
  .description('publishes the DoubleDutch extension in the current folder')
  .action(require('./publish'))

program.parse(process.argv.length > 2 ? process.argv : [...process.argv, '--help'])
