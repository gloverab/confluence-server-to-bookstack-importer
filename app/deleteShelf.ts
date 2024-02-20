require('dotenv').config()
const { AxiosAdapter } = require('../axiosAdapter.js');

const credentials = {
  "url": process.env.URL,
  "id": process.env.ID,
  "secret": process.env.SECRET
};

const axios = new AxiosAdapter(credentials.url, credentials.id, credentials.secret)

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

const deleteShelf = async (shelfId: number) => {
  const shelf = await axios.getShelf(shelfId)
    .then(resp => {
      return resp.data
    })
  const bookPromises = shelf.books.map(book => {
    return axios.deleteBook(book.id)
      .then(() => {
        return
      })
      .catch(err => {
        console.log('error deleting books')
      })
  })
  const shelfPromise = () => {
    return axios.deleteShelf(shelf.id)
      .then(() => {
        return
      })
      .catch((err) => {
        console.log('Error deleting shelf:', err)
      })
  }

  Promise.all([...bookPromises, shelfPromise()])
    .then(() => {
      console.log('Deleted shelf')
    })
    .catch(err => {
      console.log(err)
    })
}

const showShelvesToUser = async () => {
  console.log('Getting shelf IDs')
  await axios.getShelves()
    .then(resp => {
      const shelves = resp.data.data
      shelves.forEach(shelf => {
        console.log(`${shelf.name} ID:\x1b[32m ${shelf.id}\x1b[0m`)
      })
    })
    .catch(err => {
      console.log(err)
    })

  readline.question('What shelf ID would you like to delete? This will remove all books, chapters, and pages associated with this shelf.\n >', id => {
    console.log(`Deleting ${id}!`);
    deleteShelf(id)
    readline.close();
  });
}

const run = () => {
  showShelvesToUser()
}

if (process.argv[3] === 'deleteById') {
  run()
}