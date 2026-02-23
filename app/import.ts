import { ICreatePageParams } from "./params";
import { logTrey } from "./trey";
import { attachmentRecords } from '../outputJS/attachmentsFile'

require('dotenv').config();
const slugify = require('slugify');
const fs = require( 'fs' );
const path = require('path');
const os = require('os');
const FormData = require('form-data');
const { AxiosAdapter } = require('../axiosAdapter.js');
const jsdom = require("jsdom");

const fileDirectory = process.env.PATH_TO_HTML
let subDirectory
let timeoutBetweenPages = 600
let moreTrey = false

const credentials = {
  "url": process.env.URL,
  "id": process.env.ID,
  "secret": process.env.SECRET
};

const axios = new AxiosAdapter(credentials.url, credentials.id, credentials.secret)

let shelves = []
let books = []
let chapters = []
let chapterGeneralPages = []

let attachmentsByPage = {}

const sortedFiles = {
  shelves: [],
  books: [],
  chapterFilenames: [],
  chapters: {},
  pages: [],
  pagesBelongChapter: [],
  pagesBelongBook: []
}

const retry = {
  chapters: [],
  chapterGeneralPages: [],
  pages: []
}

let pageCreatedCount = 0
let chapterCreatedCount = 0
let bookCreatedCount = 0

let pagesNotCreated = []
let chaptersNotCreated = []
let booksNotCreated = []

const contentPageIdByPreviousId: Record<string, number> = {}
const chapterIdByPreviousId: Record<string, number> = {}

const checkLinkType = (href) => {
  let linkType: string
  // if (href)
}

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

const getSlugFromFilename = (filename) => {
  if (filename) {
    const splitByUnderscores = filename.split('.html')[0].split('_')
    const id = splitByUnderscores[splitByUnderscores.length - 1]
    const slug = filename.replace(`_${id}.html`, '').toLowerCase()
    return slug
  }
  return ''
}

const isInternalLink = (href: string) => {
  return href &&
    href.endsWith('.html') &&
    !href.startsWith('https://') &&
    !href.startsWith('http://')
}

const linkToType = (filename: string) => {
  if (sortedFiles.shelves.includes(filename)) {
    return 'shelf'
  }
  if (sortedFiles.books.includes(filename)) {
    return 'book'
  }
  if (sortedFiles.chapterFilenames.includes(filename)) {
    return 'chapter'
  }
  if (sortedFiles.pages.includes(filename)) {
    return 'page'
  }
  return 'COULD NOT FIND LINK TYPE'
}

const getSlugFromTitleInFile = (filename: string) => {
  const file = fs.readFileSync(getFilePath(filename), 'utf-8')
  const dom = new jsdom.JSDOM(file);
  let title = dom.window.document.getElementById('title-text')?.textContent || ''
  if (title.includes(" : ")) {
    title = title.split(' : ')[1]
  }
  title.toLowerCase().replace('_', '-')
  return slugify(title, {
    remove: /[*+~.()'"!:@]/g
  })
}

let currentBookSlug = 'content'

const getLinkToChapterOrPage = (filename: string, type: string) => {
  const slug = getSlugFromTitleInFile(filename)
  return `/books/${currentBookSlug}/page/${slug}`
}

const isAttachmentLink = (link: HTMLElement) => {
  const href = link.getAttribute('href')
  return href && href.startsWith("attachments/")
}

const removeElementByClassName = (dom, className) => {
  const elementToRemove = dom.window.document.getElementsByClassName(className)
  if (elementToRemove.length > 0) {
    elementToRemove[0].remove()
  }
}

// Confluence emoticon img → native Unicode symbol (data-emoji-shortname or data-emoticon-name)
const EMOTICON_TO_SYMBOL: Record<string, string> = {
  check_mark: '✓', tick: '✓', 'check': '✓',
  cross_mark: '✗', cross: '✗', 'x': '✗',
  warning: '⚠', 'warn': '⚠',
  info: 'ℹ', information: 'ℹ',
  star: '★', blue_star: '★', green_star: '★', red_star: '★', yellow_star: '★',
  heart: '♥', broken_heart: '♡',
  thumbs_up: '👍', thumbs_down: '👎',
  plus: '+', minus: '−',
  question: '?',
  light_on: '💡', light_off: '○',
  smile: '☺', wink: '😉', laugh: '😄', sad: '☹',
  cheeky: '😛',
}

const replaceEmoticonsWithSymbols = (dom: any) => {
  const doc = dom.window.document
  const imgs = doc.querySelectorAll ? doc.querySelectorAll('img.emoticon, img[data-emoji-shortname], img[data-emoticon-name]') : []
  for (let i = imgs.length - 1; i >= 0; i--) {
    const img = imgs[i]
    const shortname = (img.getAttribute('data-emoji-shortname') || '').replace(/^:|:$/g, '')
    const name = (img.getAttribute('data-emoticon-name') || '').toLowerCase().replace(/-/g, '_')
    const key = shortname || name
    const symbol = key ? (EMOTICON_TO_SYMBOL[key] ?? EMOTICON_TO_SYMBOL[name] ?? '') : ''
    const text = symbol || img.getAttribute('alt') || ''
    const textNode = doc.createTextNode(text)
    img.parentNode?.replaceChild(textNode, img)
  }
}

const replaceBreadcrumbsAndLinks = (dom: any, breadcrumbs: HTMLElement, filename: string) => {
  replaceEmoticonsWithSymbols(dom)
  const titleTextElement = dom.window.document.getElementById('title-text')
  let title = "title not found"
  // Get Title
  if (titleTextElement) {
    title = dom.window.document.getElementById('title-text').textContent
  }
  const titleHeading = dom.window.document.getElementById('title-heading')
  if (titleHeading) {
    titleHeading.remove()
  }
  const attachmentsH2 = dom.window.document.getElementById('attachments')
  if (attachmentsH2) {
    attachmentsH2.remove()
  }
  removeElementByClassName(dom, 'footer-body')
  removeElementByClassName(dom, 'plugin_attachments_upload_container')
  removeElementByClassName(dom, 'download-all-link')
  breadcrumbs?.remove()
  const allLinks = dom.window.document.getElementsByTagName('a')
  const linksArr = [...allLinks]
  linksArr.forEach((link, i) => {
    const href = link.getAttribute('href')
    if (isInternalLink(href)) {
      const linkType = linkToType(href)
      let newHref

      switch (linkType) {
        case 'shelf':
          newHref = `/shelves/${getSlugFromFilename(href)}`
          break
        case 'book':
          newHref = `/books/${getSlugFromFilename(href)}`
          break
        case 'chapter':
        case 'page':
          newHref = getLinkToChapterOrPage(href, linkType)
          break
      }

      if (newHref) {
        allLinks[i].setAttribute('href', newHref)
      }
    }

    if (href && isAttachmentLink(link)) {
      const existingRecord = attachmentsByPage[getIdFromFilename(filename)]
      const name = link.textContent
      if (existingRecord) {
        const obj = {
          attachmentHrefs: [...existingRecord.attachmentHrefs, { name, href }],
          pageNewId: undefined
        }
        attachmentsByPage[getIdFromFilename(filename)] = obj
      } else {
        const obj = {
          attachmentHrefs: [{ name, href }],
          pageNewId: undefined
        }
        attachmentsByPage[getIdFromFilename(filename)] = obj
      }
    }
  })
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
        sortedFiles.shelves.push(filename)
      }
  
      if (breadcrumbListItems.length === 2) {
        // Consistent. Always a book.
        sortedFiles.books.push(filename)
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
        sortedFiles.pages.push(filename)
        sortedFiles.chapterFilenames.push(branch[3])
        sortedFiles.chapters[branch[3]] = {
          bookPreviousId: getIdFromFilename(branch[2]),
          chapterFilename: branch[3],
          chapterPreviousId: getIdFromFilename(branch[3]),
          pageFilenames: sortedFiles.chapters[branch[3]] && sortedFiles.chapters[branch[3]].pageFilenames ? [...sortedFiles.chapters[branch[3]].pageFilenames, filename] : [filename]
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
      sortedFiles.pages.push(filename)
      sortedFiles.pagesBelongBook.push({
        pageFilename: filename
      })
    }
  })
}

const createChapters = async () => {
  const chapterFilenames = Object.keys(sortedFiles.chapters)
  const promises = chapterFilenames.map((chapterFilename, i) => {
    const file = fs.readFileSync(getFilePath(chapterFilename), 'utf-8')
    const dom = new jsdom.JSDOM(file);
    const breadcrumbs = dom.window.document.getElementById('breadcrumbs')
    const titleHeading = dom.window.document.getElementById('title-heading')
    const parentBook = books.find(book => book.previousId === sortedFiles.chapters[chapterFilename].bookPreviousId)
    if (!parentBook) {
      console.log(`createChapter SKIP: no parent book for ${chapterFilename}`)
      chaptersNotCreated.push(chapterFilename)
      return Promise.resolve(null)
    }

    const titleTextElement = dom.window.document.getElementById('title-text')
    let title = "generic title"
    if (titleTextElement) {
      title = dom.window.document.getElementById('title-text').textContent
    }
    titleHeading.remove()
    breadcrumbs.remove()
    const htmlString = dom.serialize()

    if (title.includes(" : ")) {
      title = title.split(' : ')[1]
    }

    const params = {
      name: title,
      book_id: parentBook.book
    }
    
    return new Promise(resolve => setTimeout(resolve, i * timeoutBetweenPages))
      .then(() => {
        return axios.createChapter(params)
          .then(resp => {
            const newChapterId = resp.data.id
            chapters.push({
              id: newChapterId,
              previousId: sortedFiles.chapters[chapterFilename].chapterPreviousId
            })
            sortedFiles.chapters[chapterFilename].pageFilenames.forEach(fn => {
              sortedFiles.pagesBelongChapter.push({
                chapterId: newChapterId,
                pageFilename: fn
              })
            })
            
            console.log(`\x1b[32m ${chapterFilename} \x1b[0m`)
            chapterCreatedCount++

            return newChapterId
          })
          .then(newChapterId => {
            const generalPageParams = {
              chapter_id: newChapterId,
              name: "_General",
              html: htmlString
            }
            return axios.createPage(generalPageParams)
              .then(resp => {
                if (attachmentsByPage[getIdFromFilename(chapterFilename)]) {
                  attachmentsByPage[getIdFromFilename(chapterFilename)].pageNewId = resp.data.id
                }
                chapterGeneralPages.push(chapterFilename)
              })
              .catch(err => {
                retry.chapterGeneralPages.push(generalPageParams)
              })
          })
          .catch(err => {
            console.log(err)
            chaptersNotCreated.push(chapterFilename)
            retry.chapters.push({
              chapterParams: params,
              generalHtml: htmlString
            })
            console.log(`\x1b[31m ${chapterFilename} \x1b[0m`)
          })
      })
  })

  const createdChapters = Promise.all(promises)
  return createdChapters
}

const putBooksOnShelves = async () => {
  const shelfIds = books.map(book => book.shelf)
  const uniqueIds = shelfIds.filter(onlyUnique)
  const promises = uniqueIds.map((id) => {
    const shelfBooks = books.filter(b => b.shelf === id).map(b => b.book)
    return axios.updateShelf(id, { books: shelfBooks })
  })

  const updatedShelves = await Promise.all(promises)
  return updatedShelves
}

const getContentBookIdForFilename = (filename: string): number | undefined => {
  const file = fs.readFileSync(getFilePath(filename), 'utf-8')
  const dom = new jsdom.JSDOM(file)
  const breadcrumbs = dom.window.document.getElementById('breadcrumbs')
  if (!breadcrumbs) return shelves.length === 1 ? shelves[0].contentBookId : undefined
  const firstLink = breadcrumbs.getElementsByTagName('a')[0]
  if (!firstLink) return shelves.length === 1 ? shelves[0].contentBookId : undefined
  const shelf = shelves.find(s => s.previousId === getIdFromHref(firstLink))
  return shelf?.contentBookId ?? (shelves.length === 1 ? shelves[0].contentBookId : undefined)
}

const getConfluenceBookPreviousIdForFilename = (filename: string): string | null => {
  const file = fs.readFileSync(getFilePath(filename), 'utf-8')
  const dom = new jsdom.JSDOM(file)
  const breadcrumbs = dom.window.document.getElementById('breadcrumbs')
  if (!breadcrumbs) return null
  const items = breadcrumbs.getElementsByTagName('li')
  const len = items.length
  if (len < 2) return null
  const branch = [...items].map(li => li.getElementsByTagName('a')[0]?.getAttribute('href')).filter(Boolean) as string[]
  return getIdFromFilename(branch[1])
}

const createChaptersOnlyWhenSourceHasSubpages = async () => {
  const chapterFilenamesWithSubpages = Object.keys(sortedFiles.chapters).filter(
    cf => (sortedFiles.chapters[cf].pageFilenames?.length ?? 0) > 0
  )
  for (let i = 0; i < chapterFilenamesWithSubpages.length; i++) {
    const chapterFilename = chapterFilenamesWithSubpages[i]
    const contentBookId = getContentBookIdForFilename(chapterFilename)
    if (!contentBookId) continue
    const file = fs.readFileSync(getFilePath(chapterFilename), 'utf-8')
    const dom = new jsdom.JSDOM(file)
    const titleTextElement = dom.window.document.getElementById('title-text')
    let name = 'Untitled'
    if (titleTextElement) name = titleTextElement.textContent || name
    if (name.includes(' : ')) name = name.split(' : ')[1]
    await new Promise(resolve => setTimeout(resolve, i * timeoutBetweenPages))
    try {
      const resp = await axios.createChapter({ book_id: contentBookId, name })
      chapterIdByPreviousId[getIdFromFilename(chapterFilename)] = resp.data.id
      chapterCreatedCount++
      console.log(`\x1b[32m Chapter: ${chapterFilename} \x1b[0m`)
    } catch (err) {
      console.log(`\x1b[31m Chapter failed: ${chapterFilename} \x1b[0m`, err?.response?.data || err)
    }
  }
}

const createFlatContentPages = async () => {
  type ContentItem = { filename: string; chapterPreviousId: string | null }
  const items: ContentItem[] = []
  sortedFiles.books.forEach(filename => {
    items.push({ filename, chapterPreviousId: null })
  })
  Object.keys(sortedFiles.chapters).forEach(chapterFilename => {
    items.push({ filename: chapterFilename, chapterPreviousId: getIdFromFilename(chapterFilename) })
    sortedFiles.chapters[chapterFilename].pageFilenames.forEach((fn: string) => {
      items.push({ filename: fn, chapterPreviousId: getIdFromFilename(chapterFilename) })
    })
  })
  sortedFiles.pagesBelongBook.forEach((p: { pageFilename: string }) => {
    items.push({ filename: p.pageFilename, chapterPreviousId: null })
  })

  const createOne = async (item: ContentItem, i: number): Promise<void> => {
    const { filename, chapterPreviousId } = item
    const contentBookId = getContentBookIdForFilename(filename)
    if (!contentBookId) {
      console.log(`createFlatContentPages SKIP: no content book for ${filename}`)
      return
    }
    const file = fs.readFileSync(getFilePath(filename), 'utf-8')
    const dom = new jsdom.JSDOM(file)
    const breadcrumbs = dom.window.document.getElementById('breadcrumbs')
    const titleHeading = dom.window.document.getElementById('title-heading')
    const titleTextElement = dom.window.document.getElementById('title-text')
    let title = 'Untitled'
    if (titleTextElement) title = titleTextElement.textContent || title
    if (title.includes(' : ')) title = title.split(' : ')[1]
    const embeddedImages = extractEmbeddedImagesToAttachments(dom, getIdFromFilename(filename))
    replaceBreadcrumbsAndLinks(dom, breadcrumbs || dom.window.document.createElement('div'), filename)
    titleHeading?.remove()
    let htmlString = dom.serialize()

    await new Promise(resolve => setTimeout(resolve, i * timeoutBetweenPages))
    const chapterId = chapterPreviousId != null ? chapterIdByPreviousId[chapterPreviousId] ?? null : null
    const params: ICreatePageParams = {
      name: title,
      html: htmlString
    }
    if (chapterId != null) {
      params.chapter_id = chapterId
    } else {
      params.book_id = contentBookId
    }
    try {
      const resp = await axios.createPage(params)
      const pageId = resp.data.id
      contentPageIdByPreviousId[getIdFromFilename(filename)] = pageId
      if (attachmentsByPage[getIdFromFilename(filename)]) {
        attachmentsByPage[getIdFromFilename(filename)].pageNewId = pageId
      }
      if (embeddedImages.length > 0) {
        const attachmentIds = await uploadEmbeddedAsAttachments(pageId, embeddedImages)
        htmlString = replaceEmbedPlaceholdersInHtml(htmlString, attachmentIds)
        await axios.updatePage(pageId, { html: htmlString })
      }
      pageCreatedCount++
      console.log(`\x1b[32m ${filename} \x1b[0m`)
    } catch (err) {
      console.log(`\x1b[31m ${filename} \x1b[0m`)
      pagesNotCreated.push(filename)
      console.log(err)
    }
  }

  for (let i = 0; i < items.length; i++) await createOne(items[i], i)
}

const createBooks = async () => {
  const promises = sortedFiles.books.map((filename, i) => {
    const file = fs.readFileSync(getFilePath(filename), 'utf-8')
    const dom = new jsdom.JSDOM(file);
    const breadcrumbs = dom.window.document.getElementById('breadcrumbs')
    const breadcrumbLinkItems = breadcrumbs.getElementsByTagName('a')
    var arr = [...breadcrumbLinkItems];
    let parentShelf: { id: number; previousId: string } | undefined
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i]
      const href = item.getAttribute('href')
      if (!href) continue
      parentShelf = shelves.find(shelf => shelf.previousId === getIdFromHref(item))
      if (parentShelf) break
    }
    if (!parentShelf && shelves.length === 1) parentShelf = shelves[0]
    if (!parentShelf) {
      console.log(`createBook SKIP: no shelf for ${filename}`)
      booksNotCreated.push(filename)
      return Promise.resolve(null)
    }

    const titleTextElement = dom.window.document.getElementById('title-text')
    let title = "generic title"
    if (titleTextElement) {
      title = dom.window.document.getElementById('title-text').textContent
    }

    if (title.includes(" : ")) {
      title = title.split(' : ')[1]
    }

    replaceBreadcrumbsAndLinks(dom, breadcrumbs, filename)
    const htmlString = dom.serialize()

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
              .then(resp2 => {
                if (attachmentsByPage[getIdFromFilename(filename)]) {
                  attachmentsByPage[getIdFromFilename(filename)].pageNewId = resp2.data.id
                }
                return resp2
              })
              .catch(err2 => {
                console.log(err2)
              })
          })
          .then(resp => {
            console.log(`\x1b[32m ${filename} \x1b[0m`)
            return resp.data
          })
          .catch(err => {
            console.log('createBook ERR:', err)
            console.log(`\x1b[31m ${filename} \x1b[0m`)
            booksNotCreated.push(filename)
          })
    })
  })
  const createdBooks = await Promise.all(promises)
  return createdBooks
}

const createShelves = async () => {
  const shelfPromises = sortedFiles.shelves.map((shelfFileName, i) => {
    const file = fs.readFileSync(getFilePath(shelfFileName), 'utf-8')
    const dom = new jsdom.JSDOM(file);
    const breadCrumbs = dom.window.document.getElementById('breadcrumbs')
    const titleHeading = dom.window.document.getElementById('title-heading')
    const breadcrumbsFirst = breadCrumbs.getElementsByClassName('first')
    const title = breadcrumbsFirst[0].getElementsByTagName('a')[0].textContent
    currentBookSlug = slugify(title, { lower: true, remove: /[*+~.()'"!:@]/g }) || 'content'
    replaceBreadcrumbsAndLinks(dom, breadCrumbs, shelfFileName)
    titleHeading?.remove()
    const htmlString = dom.serialize()

    let contentBookId: number
    return axios.createBook({
      name: title
    })
      .then(resp => {
        contentBookId = resp.data.id
        bookCreatedCount++
        return axios.createShelf({
          name: title,
          books: [contentBookId],
        })
      })
      .then(resp => {
        const shelfId = resp.data.id
        shelves.push({
          id: shelfId,
          previousId: getIdFromFilename(shelfFileName),
          contentBookId
        })
        books.push({
          book: contentBookId,
          previousId: getIdFromFilename(shelfFileName),
          shelf: shelfId
        })
        return axios.createPage({
          book_id: contentBookId,
          name: title,
          html: htmlString
        })
          .then(pageResp => {
            contentPageIdByPreviousId[getIdFromFilename(shelfFileName)] = pageResp.data.id
            if (attachmentsByPage[getIdFromFilename(shelfFileName)]) {
              attachmentsByPage[getIdFromFilename(shelfFileName)].pageNewId = pageResp.data.id
            }
            pageCreatedCount++
            console.log(`\x1b[32m ${shelfFileName} (shelf home) \x1b[0m`)
            return resp.data
          })
          .catch(err => {
            console.log('shelf home page error', err)
            return resp.data
          })
      })
      .catch(err => {
        console.log(err)
      })
  })
  const createdShelves = await Promise.all(shelfPromises)
  return createdShelves
}

const createAttachment = async () => {
  const params = {
    uploaded_to: 10306,
    name: 'Generic name!',
    file: fs.createReadStream('./html/ITDocs/attachments/3768481/3866673.jpg')
  }
  console.log(params)
  axios.createAttachment(params)
    .then(resp => {
      console.log(resp.data)
    })
    .catch(err => {
      console.log(err)
    })
}

const getBase64FromElement = (element) => {
  const path = getFilePath(element.getAttribute('src'))
  const data = fs.readFileSync(path)
  return data.toString('base64')
}

type EmbeddedImage = { buffer: Buffer; mime: string; ext: string; alt?: string }

const mimeToExt = (mime: string): string => {
  const map: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' }
  return map[mime?.toLowerCase()] || 'png'
}

const extractEmbeddedImagesToAttachments = (dom: any, _fileId: string): EmbeddedImage[] => {
  const embedded: EmbeddedImage[] = []
  const imgElements = dom.window.document.getElementsByTagName('img')
  const arr = [...imgElements]
  arr.forEach((img, i) => {
    const src = img.getAttribute('src')
    if (!src) return
    let buffer: Buffer | null = null
    let mime = 'image/png'
    if (src.startsWith('data:')) {
      const match = src.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        mime = match[1].trim()
        try {
          buffer = Buffer.from(match[2], 'base64')
        } catch {
          return
        }
      }
    } else if (fs.existsSync(getFilePath(src))) {
      buffer = fs.readFileSync(getFilePath(src))
      const ext = (src.split('.').pop() || '').toLowerCase()
      mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/png'
    }
    if (!buffer || buffer.length === 0) return
    const ext = mimeToExt(mime)
    const alt = img.getAttribute('alt') || undefined
    embedded.push({ buffer, mime, ext, alt })
    img.setAttribute('data-embed-id', String(i))
    img.removeAttribute('src')
  })
  return embedded
}

const replaceImgWithBase64 = (dom, fileId) => {
  let replacedImages = []
  const imgElements = dom.window.document.getElementsByTagName('img')
  const arr = [...imgElements]
  arr.forEach((img, i) => {
    if (img.getAttribute('src') && !img.getAttribute('src')?.startsWith('data:') && fs.existsSync(getFilePath(img.getAttribute('src')))) {
      replacedImages.push(img.getAttribute('src'))
      imgElements[i].setAttribute('src', `data:image/png;base64, ${getBase64FromElement(img)}`)
    }
  })
  return replacedImages
}

const uploadEmbeddedAsAttachments = async (pageId: number, embedded: EmbeddedImage[]): Promise<number[]> => {
  const ids: number[] = []
  for (let i = 0; i < embedded.length; i++) {
    const { buffer, ext, mime } = embedded[i]
    const name = `image-${i}.${ext}`.replace(/[^a-zA-Z0-9._-]/g, '_')
    const form = new FormData()
    form.append('uploaded_to', String(pageId))
    form.append('name', name)
    // BookStack API requires a real file upload so Laravel's hasFile('file') is true (see AttachmentApiController).
    // Append from a temp file path so the multipart part has a proper file stream and filename.
    const tmpPath = path.join(os.tmpdir(), `bookstack-upload-${Date.now()}-${i}-${name}`)
    let resp
    try {
      fs.writeFileSync(tmpPath, buffer)
      form.append('file', fs.createReadStream(tmpPath), { filename: name, contentType: mime })
      resp = await axios.createAttachment(form)
      ids.push(resp.data.id)
    } catch (err) {
      console.log(`Attachment upload failed for ${name}:`, err?.response?.data || err)
    } finally {
      try { fs.unlinkSync(tmpPath) } catch (_) { /* ignore */ }
    }
  }
  return ids
}

const replaceEmbedPlaceholdersInHtml = (html: string, attachmentIds: number[]): string => {
  let out = html
  for (let i = 0; i < attachmentIds.length; i++) {
    const id = attachmentIds[i]
    const re = new RegExp(`<img([^>]*?)data-embed-id="${i}"([^>]*?)/?>`, 'gi')
    out = out.replace(re, `<img$1src="/attachments/${id}"$2/>`)
  }
  return out
}

const createPages = async (pagesArray) => {
  const filenames = pagesArray.map(p => p.pageFilename)
  const promises = filenames.map((filename, i) => {
    const file = fs.readFileSync(getFilePath(filename), 'utf-8')
    let dom = new jsdom.JSDOM(file);
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

    if (title.includes(" : ")) {
      title = title.split(' : ')[1]
    }
    
    replaceImgWithBase64(dom, getIdFromFilename(filename))
    titleHeading.remove()
    replaceBreadcrumbsAndLinks(dom, breadcrumbs, filename)
    const htmlString = dom.serialize()

    const params: ICreatePageParams = {
      name: `${title}`,
      html: htmlString
    }

    if (pagesArray[i].chapterId) {
      params.chapter_id = pagesArray[i].chapterId
    } else {
      params.book_id = parentBook.book
    }
    return new Promise(resolve => setTimeout(resolve, i * timeoutBetweenPages))
      .then(() => {
        return axios.createPage(params)
         .then(resp => {
            console.log(`\x1b[32m ${filename} \x1b[0m`)
            if (attachmentsByPage[getIdFromFilename(filename)]) {
              attachmentsByPage[getIdFromFilename(filename)].pageNewId = resp.data.id
            }
            pageCreatedCount++
            // createAttachments(dom, replacedImages, resp.data.id)
         })
         .catch(err => {
            console.log(`\x1b[31m ${filename} \x1b[0m`)
            pagesNotCreated.push(filename)
            console.log(err)
         })
      })
  })

  const createdPages = Promise.all(promises)
  return createdPages
}

const fixLinks = () => {
  sortFiles()
  const files = fs.readdirSync(`${fileDirectory}/${subDirectory}`)
  const htmlFiles = files.filter(fn => fn.endsWith('.html'))
  htmlFiles.forEach(filename => {
    if (filename !== 'index.html') {
      const file = fs.readFileSync(getFilePath(filename), 'utf-8')
      const dom = new jsdom.JSDOM(file);
      const breadcrumbs = dom.window.document.getElementById('breadcrumbs')
      replaceBreadcrumbsAndLinks(dom, breadcrumbs, filename)
    }
  })
  const attachmentsCode = `module.exports = {
    attachmentsByPage: ${JSON.stringify(attachmentsByPage)}
  };`

  fs.writeFileSync("./outputJS/attachmentsFile.js", attachmentsCode);
}

const chapterRetry = async () => {
  let promises = retry.chapters.map((chapter) => {
    const { filename } = chapter.chapterParams
    return axios.createChapter(chapter.chapterParams)
      .then(resp => {
        const newChapterId = resp.data.id
        chapters.push({
          id: newChapterId,
          previousId: sortedFiles.chapters[filename].chapterPreviousId
        })
        sortedFiles.chapters[filename].pageFilenames.forEach(fn => {
          sortedFiles.pagesBelongChapter.push({
            chapterId: newChapterId,
            pageFilename: fn
          })
        })
        
        console.log(`\x1b[32m ${filename} \x1b[0m`)
        chapterCreatedCount++

        return resp
      })
      .then(resp => {
        // return axios.create
      })
  })
}

const handleRetry = async() => {
  if (retry.chapters.length > 0) {
    // await 
  }
  return
}

const displayResultsAndTrey = () => {
  console.log('------------------------------------------------')
  console.log(`\x1b[32m Books Created: ${bookCreatedCount} \x1b[0m`)
  console.log(`\x1b[32m Chapters Created: ${chapterCreatedCount} \x1b[0m`)
  console.log(`\x1b[32m Pages Created: ${pageCreatedCount} \x1b[0m`)
  console.log(`\x1b[31m Book Errors: ${booksNotCreated.length} \x1b[0m`)
  console.log(`\x1b[31m Chapter Errors: ${chaptersNotCreated.length} \x1b[0m`)
  console.log(`\x1b[31m Page Errors: ${pagesNotCreated.length} \x1b[0m`)
  logTrey({ 
    color: booksNotCreated.length > 0 || pagesNotCreated.length > 0 || retry.chapterGeneralPages.length > 0 ? '\x1b[91m' : '\x1b[32m'
    })

  console.log("Books Not Created:")
  booksNotCreated.forEach((book) => {
    console.log(`\x1b[91m ${book} \x1b[0m`)
    })
  console.log("Chapters Not Created:")
  chaptersNotCreated.forEach((chapter) => {
    console.log(`\x1b[91m ${chapter} \x1b[0m`)
    })
  console.log("Chapter Generals Not Created:")
  retry.chapterGeneralPages.forEach((chapter) => {
    console.log(`\x1b[91m ${chapter} \x1b[0m`)
    })
  console.log("Pages Not Created:")
  pagesNotCreated.forEach((page) => {
    console.log(`\x1b[91m ${page} \x1b[0m`)
  })
}

/** Upload Confluence attachment files (from attachments/ folder) to BookStack for already-imported pages. Uses attachmentRecords and pageNewId. */
const uploadConfluenceAttachmentFiles = async () => {
  const records = attachmentRecords[subDirectory]
  if (!records) {
    console.log('\x1b[33m No attachment records for this shelf. \x1b[0m')
    return
  }
  let uploaded = 0
  let failed = 0
  for (const pagePreviousId of Object.keys(records)) {
    const obj = records[pagePreviousId]
    if (!obj.pageNewId || !obj.attachmentHrefs?.length) continue
    for (let i = 0; i < obj.attachmentHrefs.length; i++) {
      const v = obj.attachmentHrefs[i]
      const hrefPath = (v.href || '').split('?')[0]
      if (!hrefPath) continue
      const filePath = getFilePath(hrefPath)
      if (!fs.existsSync(filePath)) {
        console.log(`\x1b[33m Skip (missing): ${hrefPath} \x1b[0m`)
        failed++
        continue
      }
      const name = (v.name && v.name.trim()) || path.basename(hrefPath)
      const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'attachment'
      const form = new FormData()
      form.append('uploaded_to', String(obj.pageNewId))
      form.append('name', safeName)
      const ext = path.extname(hrefPath).toLowerCase()
      const contentType = (ext && mimeFromExt(ext)) || 'application/octet-stream'
      form.append('file', fs.createReadStream(filePath), { filename: safeName, contentType })
      try {
        await axios.createAttachment(form)
        uploaded++
        console.log(`\x1b[32m Attachment: ${safeName} \x1b[0m`)
      } catch (err) {
        failed++
        console.log(`\x1b[31m Attachment failed: ${safeName} \x1b[0m`, err?.response?.data || err)
      }
      await new Promise(r => setTimeout(r, 200))
    }
  }
  console.log(`\x1b[32m Confluence attachments: ${uploaded} uploaded, ${failed} failed/skipped \x1b[0m`)
}

const mimeFromExt = (ext: string): string => {
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
    '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain', '.zip': 'application/zip', '.mp4': 'video/mp4', '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg', '.bat': 'text/plain', '.cfg': 'text/plain', '.dmg': 'application/octet-stream', '.exe': 'application/octet-stream',
  }
  return map[ext] || 'application/octet-stream'
}

const handleAttachments = () => {
  const newAttachmentsRecords = {...attachmentRecords}
  newAttachmentsRecords[subDirectory] = attachmentsByPage

  const attachmentsCode = `module.exports = {
    attachmentRecords: ${JSON.stringify(newAttachmentsRecords)}
  };`

  fs.writeFileSync("./outputJS/attachmentsFile.js", attachmentsCode);
}

const init = async () => {
  console.log('\x1b[33m Sorting files... \x1b[0m')
  sortFiles()
  console.log('\x1b[32m Files sorted \x1b[0m')
  console.log('\x1b[33m Creating shelves and one book per space... \x1b[0m')
  await createShelves()
  console.log('\x1b[32m Shelves created! \x1b[0m')
  console.log('\x1b[33m Putting Books on Shelves... \x1b[0m')
  await putBooksOnShelves()
  console.log('\x1b[32m Books are on the shelves! \x1b[0m')
  console.log('\x1b[33m Creating chapters (only where source has subpages)... \x1b[0m')
  await createChaptersOnlyWhenSourceHasSubpages()
  console.log('\x1b[32m Chapters created! \x1b[0m')
  console.log('\x1b[33m Creating pages... \x1b[0m')

  setTimeout(async () => {
    await createFlatContentPages()
    console.log('\x1b[32m Pages created! \x1b[0m')
    await handleRetry()

    console.log('\x1b[33m Uploading Confluence attachment files... \x1b[0m')
    await uploadConfluenceAttachmentFiles()
    handleAttachments()

    displayResultsAndTrey()
  }, 1000)
}

process.argv.forEach(function (val, index, array) {
  if (index === 4 && !!val) {
    subDirectory = val
  }

  if (index === 5 && !!val) {
    timeoutBetweenPages = parseFloat(val)
  }

  if (val.toLowerCase() === '-moretrey') {
    moreTrey = true
  }
});

if (process.argv[3] === 'import') {
  if (subDirectory) {
    init()
  } else {
    console.log('Please include an argument for subdirectory')
  }
}

if (process.argv[3] === 'sort') {
  sortFiles()
}
if (process.argv[3] === 'attachments') {
  if (subDirectory) {
    (async () => {
      console.log('\x1b[33m Uploading Confluence attachments for shelf:', subDirectory, '\x1b[0m')
      await uploadConfluenceAttachmentFiles()
      console.log('\x1b[32m Done. \x1b[0m')
    })().catch(err => { console.error(err); process.exit(1) })
  } else {
    console.log('Usage: node dist/import.js -- attachments <shelfName>\nSet PATH_TO_HTML to your HTML export root.')
  }
}
if (process.argv[3] === 'fixLinks') {
  fixLinks()
}