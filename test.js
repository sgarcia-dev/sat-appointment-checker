const path = require('path')
require("dotenv").config();
const utils = require('./utils');

(async () => await utils.sendMail({
  subject: 'TEST!',
  html: 'THIS IS A TEST',
  attachments: [{
    filename: 'sat.png',
    path: path.resolve(__dirname, 'sat.png'),
    cid: 'students'
  }]
}))()