require('dotenv').config()
const { AxiosAdapter } = require('./axiosAdapter.js');

const credentials = {
  "url": process.env.URL,
  "id": process.env.ID,
  "secret": process.env.SECRET
};

const axios = new AxiosAdapter(credentials.url, credentials.id, credentials.secret)

const nuke = async () => {
  axios.getShelves()
    .then(resp => {
      resp.data.data.forEach(shelf => {
        axios.deleteShelf(shelf.id)
      })
    })

  axios.getBooks()
    .then(resp => {
      resp.data.data.forEach(book => {
        axios.deleteBook(book.id)
      })
    })
}

nuke()