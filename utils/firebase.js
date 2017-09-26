const { firebase } = require('../config')
const request = require('superagent')

module.exports = {
  config: firebase,
  getAdminToken(ddToken, eventId) {
    // TODO: Installing features to an event should be done in the CMS/Studio for an event in the correct region.
    // TODO: Once `install` is removed from `bz`, give the bazaar server a set of IS service creds and have it read tokens, since it can simply look for the developer role.
    return new Promise((resolve, reject) => {
      request.get(`${firebase.functions}/adminToken?event=${eventId}&region=us`)
      .set('authorization', `Bearer ${ddToken}`)
      .end((err, res) => {
        if (err) return reject(err)
        if (res.status === 401) return reject('Unauthorized')
        resolve(res.text)
      })
    })
  },
  getDeveloperToken(ddToken) {
    return new Promise((resolve, reject) => {
      request.get(`${firebase.functions}/developerToken`)
      .set('authorization', `Bearer ${ddToken}`)
      .end((err, res) => {
        if (err) return reject(err)
        if (res.status === 401) return reject('Unauthorized')
        resolve(res.text)        
      })
    })
  }
}