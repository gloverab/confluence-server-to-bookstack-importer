require('dotenv').config()
const { AxiosAdapter } = require('./axiosAdapter.js');

const credentials = {
  "url": process.env.URL,
  "id": process.env.ID,
  "secret": process.env.SECRET
};

const axios = new AxiosAdapter(credentials.url, credentials.id, credentials.secret)

const nuke = async () => {
  let shelves
  let books

  await axios.getShelves()
    .then(resp => {
      shelves = resp.data.data
      resp.data.data.forEach(shelf => {
        axios.deleteShelf(shelf.id)
      })
    })

  await axios.getBooks()
    .then(resp => {
      books = resp.data.data
      resp.data.data.forEach(book => {
        axios.deleteBook(book.id)
      })
    })

  const shelfPromises = shelves.map(shelf => {
    return axios.deleteShelf(shelf.id)
      .then(() => {
        return
      })
      .catch(err => {
        console.log('error deleting shelves')
      })
  })

  const bookPromises = books.map(book => {
    return axios.deleteBook(book.id)
      .then(() => {
        return
      })
      .catch(err => {
        console.log('error deleting shelves')
      })
  })

  Promise.all([...shelfPromises, ...bookPromises])
    .then(() => {
      console.log('Nuked!')
    })
    .catch((err) => {
      console.log('Nuke failed. Try again.')
    })
}

nuke()