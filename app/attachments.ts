import { attachmentRecords } from '../outputJS/attachmentsFile'

require('dotenv').config();
const fs = require( 'fs' );
const { AxiosAdapter } = require('../axiosAdapter.js');
const jsdom = require("jsdom");

const fileDirectory = process.env.PATH_TO_HTML
let subDirectory
let notAttached = []

const getFilePath = (filename) => {
  return `${fileDirectory}/${subDirectory}/${filename}`
}

const credentials = {
  "url": process.env.URL,
  "id": process.env.ID,
  "secret": process.env.SECRET
};

const axios = new AxiosAdapter(credentials.url, credentials.id, credentials.secret)

const run = async () => {
  const attachments = attachmentRecords[subDirectory]
  const keys = Object.keys(attachments)
  let uploadParamCollection = []
  keys.forEach(async (key) => {
    const obj = attachments[key]
    obj.attachmentHrefs.forEach(v => {
      const params = {
        uploaded_to: obj.pageNewId,
        name: v.name,
        file: fs.createReadStream(getFilePath(v.href))
      }
      uploadParamCollection.push(params)
    })
  })

  const promises = uploadParamCollection.map(params => {
    return axios.createAttachment(params)
      .then(resp => {
        console.log(resp.data)
        return resp
      })
      .catch(err => {
        notAttached.push(params)
        console.log(err)
      })
  })

  await Promise.all(promises)
  console.log(`Uploaded ${uploadParamCollection.length} attachments`)
  console.log('Not attached:', notAttached)
  return
}

process.argv.forEach(function (val, index, array) {
  console.log(val)
  if (index === 4 && !!val) {
    subDirectory = val
  }
});

if (process.argv[3] === 'attach') {
  run()
}