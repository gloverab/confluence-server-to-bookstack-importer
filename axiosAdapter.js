const Axios = require('axios');

class AxiosAdapter {
  constructor(baseURL, id, secret) {
    const instance = Axios.create({
      baseURL,
      paramsSerializer: {
        serialize: (params) =>
          qs.stringify(params, { arrayFormat: 'comma' })
      }
    })

    this.baseURL = baseURL
    this.id = id
    this.secret = secret
    this.client = instance
  }

  getHeaders = (contentType = 'application/x-www-form-urlencoded') => {
    const headers = {
      'Content-Type': contentType,
      'Authorization': `Token ${this.id}:${this.secret}`
    }

    return headers

  }

  get = (url, params) =>
    this.client.get(url, {
      headers: this.getHeaders(),
      params,
    })

  put = (url, id, data) =>
    this.client.put(`${url}/${id}`, JSON.stringify(data), {
      headers: this.getHeaders('application/json')
    })

  delete = (url, id) =>
    this.client.delete(`${url}/${id}`, {
      headers: this.getHeaders()
    })

  postJson = (url, data) =>
    this.client.post(url, JSON.stringify(data), {
      headers: this.getHeaders('application/json')
    })

  createShelf = async (body) => {
    return this.postJson('/shelves', body)
  }

  createBook = async (body) => {
    return this.postJson('/books', body)
  }

  createChapter = async (body) => {
    return this.postJson('/chapters', body)
  }

  createPage = async (body) => {
    return this.postJson('/pages', body)
  }

  getBooks = async () => {
    return this.get('/books')
  }

  getShelves = async () => {
    return this.get('/shelves')
  }

  getPages = async () => {
    return this.get('/pages')
  }

  getChapters = async () => {
    return this.get('/chapters')
  }

  updateShelf = async(id, params) => {
    return this.put('/shelves', id, params)
  }

  deleteShelf = async (id) => {
    return this.delete('/shelves', id)
  }

  deleteBook = async (id) => {
    return this.delete('/books', id)
  }

  deletePage = async (id) => {
    return this.delete('/pages', id)
  }

  deleteChapter = async (id) => {
    return this.delete('/chapters', id)
  }
  
}

module.exports = { AxiosAdapter }