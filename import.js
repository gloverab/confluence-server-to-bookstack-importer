require('dotenv').config()
const fs = require( 'fs' );
const { AxiosAdapter } = require('./axiosAdapter.js');
const jsdom = require("jsdom");

const fileDirectory = process.env.PATH_TO_HTML
let subDirectory
let timeoutBetweenPages = 500

const credentials = {
  "url": process.env.URL,
  "id": process.env.ID,
  "secret": process.env.SECRET
};

const axios = new AxiosAdapter(credentials.url, credentials.id, credentials.secret)

let shelves = []
let books = []
let chapters = []

let shelfFiles = []
let bookFiles = []
let pagesFilesNoChapter = []
let pageFilesWithChapter = []

let pageCreatedCount = 0
let bookCreatedCount = 0
let pagesNotCreated = 0
let booksNotCreated = 0

const onlyUnique = (value, index, array) => {
  return array.indexOf(value) === index;
}

const getFilePath = (filename) => {
  return `${fileDirectory}/${subDirectory}/${filename}`
}

const getIdFromHref = (tagA) => {
  const splitByUnderscores = tagA.getAttribute('href').split('.html')[0].split('_')
  return splitByUnderscores[splitByUnderscores.length - 1]
}

const getIdFromFilename = (filename) => {
  const splitByUnderscores = filename.split('.html')[0].split('_')
  return splitByUnderscores[splitByUnderscores.length - 1]
}

const sortFiles = () => {
  const files = fs.readdirSync(`${fileDirectory}/${subDirectory}`)
  const htmlFiles = files.filter(fn => fn.endsWith('.html'))
  
  const threeBreadcrumbsFilenames = []
  const branchesWithFourOrMore = []
  htmlFiles.forEach(filename => {
    const file = fs.readFileSync(getFilePath(filename), 'utf-8')
    const dom = new jsdom.JSDOM(file);
    const breadcrumbs = dom.window.document.getElementById('breadcrumbs')
    if (breadcrumbs) {
      const breadcrumbListItems = breadcrumbs.getElementsByTagName('li')
  
      if (breadcrumbListItems.length === 1) {
        // Consistent. Always a shelf.
        shelfFiles.push(filename)
      }
  
      if (breadcrumbListItems.length === 2) {
        // Consistent. Always a book.
        bookFiles.push(filename)
      }
  
      if (breadcrumbListItems.length === 3) {
        // PROBLEM: Could be chapter or page depending on what comes after.
        // Populate branchesWithFourOrMore FIRST, then handle this and check branches for existing structures to determine if something comes after or not.
        threeBreadcrumbsFilenames.push(filename)
      }
  
      if (breadcrumbListItems.length >= 4) {
        // Third breadcrumb is chapter, anything after is page
        const arr = [...breadcrumbListItems]
        const branch = arr.map(v => v.getElementsByTagName('a')[0].getAttribute('href'))
        branchesWithFourOrMore.push(branch)
  
        for (let i = 3; i < arr.length; i++) {
          pageFilesWithChapter.push({
            bookPreviousId: getIdFromFilename(branch[2]),
            chapterPreviousId: getIdFromFilename(branch[3]),
            chapterFilename: branch[3],
            pageFilename: filename
          })
        }
  
      }
    }
  })

  threeBreadcrumbsFilenames.forEach(filename => {
    const indexIncludingThisFile = branchesWithFourOrMore.findIndex(arr => arr.includes(filename))
    if (indexIncludingThisFile > -1) {
      // Is a chapter
    } else {
      // Is a page with no chapter files
      pagesFilesNoChapter.push({
        pageFilename: filename
      })
    }
  })

  const chapterFilenames = pageFilesWithChapter.map(v => v.chapterFilename).filter(onlyUnique)

  console.log(`\x1b[36m Shelves - ${shelfFiles.length} \x1b[0m`)
  console.log(`\x1b[36m Books - ${bookFiles.length} \x1b[0m`)
  console.log(`\x1b[36m Chapters - ${chapterFilenames.length} \x1b[0m`)
  console.log(`\x1b[36m Pages belonging to a chapter - ${pageFilesWithChapter.length} \x1b[0m`)
  console.log(`\x1b[36m Pages belonging to a book - ${pagesFilesNoChapter.length} \x1b[0m`)
}

const createChapters = async () => {
  const chapterFilenames = pageFilesWithChapter.map(v => v.chapterFilename).filter(onlyUnique)
  const chapterPreviousIds = pageFilesWithChapter.map(v => v.chapterPreviousId).filter(onlyUnique)

  const promises = chapterFilenames.map((filename, i) => {
    const file = fs.readFileSync(getFilePath(filename), 'utf-8')
    const dom = new jsdom.JSDOM(file);
    const breadcrumbs = dom.window.document.getElementById('breadcrumbs')
    const titleHeading = dom.window.document.getElementById('title-heading')
    const parentBook = books.find(book => book.previousId === pageFilesWithChapter[i].bookPreviousId)

    const titleTextElement = dom.window.document.getElementById('title-text')
    let title = "generic title"
    if (titleTextElement) {
      title = dom.window.document.getElementById('title-text').textContent
    }
    titleHeading.remove()
    breadcrumbs.remove()
    const htmlString = dom.serialize()

    const params = {
      name: title,
      book_id: parentBook.book
    }

    let newChapterId
    return axios.createChapter(params)
      .then(resp => {
        newChapterId = resp.data.id
        chapters.push({
          id: resp.data.id,
          previousId: chapterPreviousIds[i]
        })
        return axios.createPage({
          chapter_id: resp.data.id,
          name: "_General",
          html: htmlString
        })
      })
  })

  const createdChapters = Promise.all(promises)
  return createdChapters
}

const createPages = async (pagesArray) => {
  const filenames = pagesArray.map(p => p.pageFilename)
  const promises = filenames.map((filename, i) => {
    const file = fs.readFileSync(getFilePath(filename), 'utf-8')
    const dom = new jsdom.JSDOM(file);
    const breadcrumbs = dom.window.document.getElementById('breadcrumbs')
    const breadcrumbLinkItems = breadcrumbs.getElementsByTagName('a')
    const titleHeading = dom.window.document.getElementById('title-heading')
    var arr = [...breadcrumbLinkItems];
    let parentBook
    arr.forEach((item, i) => {
      if (i === 2) {
        const parentBookPreviousId = getIdFromHref(item)
        parentBook = books.find(b => b.previousId === parentBookPreviousId)
      }
    })
    
    const titleTextElement = dom.window.document.getElementById('title-text')
    let title = "title not found"
    if (titleTextElement) {
      title = dom.window.document.getElementById('title-text').textContent
    }
    titleHeading.remove()
    breadcrumbs.remove()
    const htmlString = dom.serialize()

    const params = {
      name: `${title}`,
      html: htmlString
    }
    if (pagesArray[i].chapterPreviousId) {
      params.chapter_id = chapters.find(c => c.previousId === pagesArray[i].chapterPreviousId).id
    } else {
      params.book_id = parentBook.book
    }
    return new Promise(resolve => setTimeout(resolve, i * timeoutBetweenPages))
      .then(() => {
        process.stdout.write(filename)
        return axios.createPage(params)
         .then(resp => {
            process.stdout.clearLine(0)
            process.stdout.cursorTo(0)
            process.stdout.write(`\x1b[32m ${filename} \x1b[0m\n`)
            pageCreatedCount++
         })
         .catch(err => {
            process.stdout.write(`\x1b[31m ${filename} \x1b[0m\n`)
            pagesNotCreated++
            console.log(err)
         })
      })
  })

  const createdPages = Promise.all(promises)
  return createdPages
}

const putBooksOnShelves = async () => {
  const shelfIds = books.map(book => book.shelf)
  const uniqueIds = shelfIds.filter(onlyUnique)
  const promises = uniqueIds.map((id) => {
    const shelfBooks = books.filter(b => b.shelf === id).map(b => b.book)
    return axios.updateShelf(id, { books: shelfBooks })
  })

  const updatedShelves = Promise.all(promises)
  return updatedShelves
}

const createBooks = async () => {
  const promises = bookFiles.map((filename, i) => {
    const file = fs.readFileSync(getFilePath(filename), 'utf-8')
    const dom = new jsdom.JSDOM(file);
    const breadcrumbs = dom.window.document.getElementById('breadcrumbs')
    const breadcrumbLinkItems = breadcrumbs.getElementsByTagName('a')
    const titleHeading = dom.window.document.getElementById('title-heading')
    var arr = [...breadcrumbLinkItems];
    let parentShelf
    arr.forEach((item, i) => {
      if (item.getAttribute('href').includes('Home_')) {
        parentShelf = shelves.find(shelf => shelf.previousId === getIdFromHref(item))
      }
    })
    breadcrumbs.remove()
    const htmlString = dom.serialize()
    const titleTextElement = dom.window.document.getElementById('title-text')
    let title = "generic title"
    if (titleTextElement) {
      title = dom.window.document.getElementById('title-text').textContent
    }
    titleHeading.remove()

    let bookId
    return new Promise(resolve => setTimeout(resolve, i * timeoutBetweenPages))
      .then(() => {
        return axios.createBook({
          name: `${title}`,

        })
          .then(resp => {
            bookId = resp.data.id
            books.push({
              book: bookId,
              previousId: getIdFromFilename(filename), 
              shelf: parentShelf.id
            })
            bookCreatedCount++
            return axios.createPage({
              book_id: bookId,
              name: "_General",
              html: htmlString
            })
          })
          .then(resp => {
            console.log(`\x1b[32m ${filename} \x1b[0m\n`)
            return resp.data
          })
          .catch(err => {
            process.stdout.write(`\x1b[31m ${filename} \x1b[0m\n`)
            booksNotCreated++
          })
    })
  })
  const createdBooks = await Promise.all(promises)
  return createdBooks
}

const createShelves = async () => {
  const shelfPromises = shelfFiles.map((shelfFileName, i) => {
    const file = fs.readFileSync(getFilePath(shelfFileName), 'utf-8')
    const dom = new jsdom.JSDOM(file);
    const breadCrumbs = dom.window.document.getElementById('breadcrumbs')
    const titleHeading = dom.window.document.getElementById('title-heading')
    const breadcrumbsFirst = breadCrumbs.getElementsByClassName('first')
    breadCrumbs.remove()
    titleHeading.remove()
    const htmlString = dom.serialize()
    const title = breadcrumbsFirst[0].getElementsByTagName('a')[0].textContent

    let bookId
    return axios.createBook({
      name: `${title}: Home`
    })
      .then(resp => {
        bookId = resp.data.id
        return axios.createPage({
          book_id: bookId,
          name: "_General",
          html: htmlString
        })
      })
      .then(resp => {
        return axios.createShelf({
          name: title,
          books: [bookId],
        })
      })
      .then(resp => {
        shelves.push({
          id: resp.data.id,
          previousId: getIdFromFilename(shelfFileName)
        })
        return resp.data
      })
      .catch(err => {
        console.log(err)
      })
  })
  const createdShelves = await Promise.all(shelfPromises)
  return createdShelves
}

const hiJon = (options) => {
  console.log(options.color)
  console.log("                         *#@@@@@@@@@@@@@@@@@@@*                           ")
  console.log("                  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@                        ")
  console.log("                @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@                     ")
  console.log("              @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%                  ")
  console.log("           *@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*               ")
  console.log("         &@@@@@@@@@@@@@@@@@@@@@@@@@,@@@@@@@@@@@@@@@@@@@@@@@.              ")
  console.log("       /@@@@@@@@@@@@@@@@@@@@@@@@@@ @@@@@@@@@@@@@@@@@@@@@@@@@@(            ")
  console.log("      @@@@@@@@@@@@@@@@@@@@@@@@@@.@@@@@&@@@@@@@@@@@@@@@@@@@@@@@@           ")
  console.log("     @%@@@@@@@@@@@@@@@@@@@@@@@ @@@@@.@@@@@@@@@@@@ @@@@@@@@@@@@@@          ")
  console.log("      (@@@@@@@@@@@@@/@@@@@@,*@@@@  @@@@@@@@@@@@/ @@%@@@@@@@@@@@@@         ")
  console.log("      @@@@@@@@@@@,.@@@@  /@@&   @@@@@@@@@@@@@.  @@  @@@@@@@@@@@@@%        ")
  console.log("     %@@@@@@@@@@@@   @@    @@@@@@@@@@@@@@(           @@@@@@@@@@@@@@       ")
  console.log("     &@@@@@@@@@@@@@@@@@@@@@@@@@@@@*   .#@@@@@@#      @@@@@@@@@@@@@        ")
  console.log("     @@@@@@@@@@@@@,           #@   @@            @@@@@@@@@@@@@@@@         ")
  console.log("    @@@@@@@@@@   %,           #,    @            @     @@@@@@@@@@@        ")
  console.log("    %@@@@@@@@@    @           @     @           @     /@@@@@@@@@&*        ")
  console.log("  &@@@@@@@@@@@(     #@*   *#&         #@*   *&@       /@@@@@@@#           ")
  console.log("       @@@@% @@                                       @@  @@@@@@          ")
  console.log("        @@@@ /@                                      ,@. @@@@%            ")
  console.log("      (@@@@@# @@                                     @@ #@@@@@@           ")
  console.log("      @@@@@@@ /@*        .@@@@@@@@@@@@@@@@.         *@@ #@@@@@@@          ")
  console.log("        &@@@@@@@@@.   &@@@@@@@@@@@@@@@@@@@@@@.    .@@@@@@@@,.             ")
  console.log("            ((,@@@@@( (@@                  @@,  @@@@@@ ((                 ")
  console.log("                 @@@@. @@                  @@  @@@@@                      ")
  console.log("                  &@@@@@@#  @@@@&&&&@@@@  @@@@@@@@&                       ")
  console.log("                   &@@@@@@#  ,@@@@@@@@   @@@@@@@@                         ")
  console.log("                     %@@@@@@@@@@@@@@@@@@@@@@@@@                           ")
  console.log("                       ,@@@@@@@@@@@@@@@@@@@@@                             ")
  console.log("                          #@@@@@@@@@@@@@@@                                ")
  console.log("                                                                          ")
  console.log("\x1b[0m")
}

const init = async () => {
  console.log('\x1b[33m Sorting files... \x1b[0m')
  sortFiles()
  console.log('\x1b[32m Files sorted \x1b[0m')
  console.log('\x1b[33m Creating shelves... \x1b[0m')
  await createShelves()
  console.log('\x1b[32m Shelves created! \x1b[0m')
  console.log('\x1b[33m Creating books... \x1b[0m')
  await createBooks()
  console.log('\x1b[32m Books created! \x1b[0m')
  console.log('\x1b[33m Putting Books on Shelves... \x1b[0m')
  await putBooksOnShelves()
  console.log('\x1b[32m Books are on the shelves! \x1b[0m')
  console.log('\x1b[33m Creating chapters... \x1b[0m')
  await createChapters()
  console.log('\x1b[32m Chapters Created! \x1b[0m')
  console.log('\x1b[33m Creating Standalone Pages... \x1b[0m')
  await createPages(pagesFilesNoChapter)
  console.log('\x1b[32m Standalone Pages Created! \x1b[0m')
  console.log('\x1b[33m Creating Pages in Chapters... \x1b[0m')
  await createPages(pageFilesWithChapter)
  console.log('\x1b[32m Pages in Chapters Created! \x1b[0m')
  console.log('------------------------------------------------')
  console.log(`\x1b[32m Books Created: ${bookCreatedCount} \x1b[0m`)
  console.log(`\x1b[32m Pages Created: ${pageCreatedCount} \x1b[0m`)
  console.log(`\x1b[31m Book Errors: ${booksNotCreated} \x1b[0m`)
  console.log(`\x1b[31m Page Errors: ${pagesNotCreated} \x1b[0m`)
  hiJon({ 
    color: booksNotCreated.length > 0 || pagesNotCreated > 0 ? '\x1b[91m' : '\x1b[32m'
   })
}

process.argv.forEach(function (val, index, array) {
  if (index === 3 && !!val) {
    subDirectory = val
  }

  if (index === 4 && !!val) {
    timeoutBetweenPages = val
  }
});

if (process.argv[2] === 'run') {
  if (subDirectory) {
    init()
  } else {
    console.log('Please include an argument for subdirectory')
  }
}