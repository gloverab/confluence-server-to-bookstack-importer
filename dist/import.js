"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
const slugify = require('slugify');
const fs = require('fs');
const { AxiosAdapter } = require('../axiosAdapter.js');
const jsdom = require("jsdom");
const fileDirectory = process.env.PATH_TO_HTML;
let subDirectory;
let timeoutBetweenPages = 600;
let moreTrey = false;
const credentials = {
    "url": process.env.URL,
    "id": process.env.ID,
    "secret": process.env.SECRET
};
const axios = new AxiosAdapter(credentials.url, credentials.id, credentials.secret);
let shelves = [];
let books = [];
let chapters = [];
let chapterGeneralPages = [];
const sortedFiles = {
    shelves: [],
    books: [],
    chapterFilenames: [],
    chapters: {},
    pages: [],
    pagesBelongChapter: [],
    pagesBelongBook: []
};
const retry = {
    chapters: [],
    chapterGeneralPages: [],
    pages: []
};
let pageCreatedCount = 0;
let chapterCreatedCount = 0;
let bookCreatedCount = 0;
let pagesNotCreated = [];
let chaptersNotCreated = [];
let booksNotCreated = [];
const checkLinkType = (href) => {
    let linkType;
    // if (href)
};
const onlyUnique = (value, index, array) => {
    return array.indexOf(value) === index;
};
const getFilePath = (filename) => {
    return `${fileDirectory}/${subDirectory}/${filename}`;
};
const getIdFromHref = (tagA) => {
    const splitByUnderscores = tagA.getAttribute('href').split('.html')[0].split('_');
    return splitByUnderscores[splitByUnderscores.length - 1];
};
const getIdFromFilename = (filename) => {
    const splitByUnderscores = filename.split('.html')[0].split('_');
    return splitByUnderscores[splitByUnderscores.length - 1];
};
const getSlugFromFilename = (filename) => {
    if (filename) {
        const splitByUnderscores = filename.split('.html')[0].split('_');
        const id = splitByUnderscores[splitByUnderscores.length - 1];
        const slug = filename.replace(`_${id}.html`, '').toLowerCase();
        return slug;
    }
    return '';
};
const isInternalLink = (href) => {
    return href &&
        href.endsWith('.html') &&
        !href.startsWith('https://') &&
        !href.startsWith('http://');
};
const linkToType = (filename) => {
    if (sortedFiles.shelves.includes(filename)) {
        return 'shelf';
    }
    if (sortedFiles.books.includes(filename)) {
        return 'book';
    }
    if (sortedFiles.chapterFilenames.includes(filename)) {
        return 'chapter';
    }
    if (sortedFiles.pages.includes(filename)) {
        return 'page';
    }
    return 'COULD NOT FIND LINK TYPE';
};
const getSlugFromTitleInFile = (filename) => {
    var _a;
    const file = fs.readFileSync(getFilePath(filename), 'utf-8');
    const dom = new jsdom.JSDOM(file);
    let title = ((_a = dom.window.document.getElementById('title-text')) === null || _a === void 0 ? void 0 : _a.textContent) || '';
    if (title.includes(" : ")) {
        title = title.split(' : ')[1];
    }
    title.toLowerCase().replace('_', '-');
    return slugify(title, {
        remove: /[*+~.()'"!:@]/g
    });
};
const getLinkToChapterOrPage = (filename, type) => {
    const file = fs.readFileSync(getFilePath(filename), 'utf-8');
    const dom = new jsdom.JSDOM(file);
    const breadcrumbs = dom.window.document.getElementById('breadcrumbs');
    const breadcrumbListItems = (breadcrumbs === null || breadcrumbs === void 0 ? void 0 : breadcrumbs.getElementsByTagName('li')) || [];
    const breadcrumbsArr = [...breadcrumbListItems];
    const branch = breadcrumbsArr.map(v => v.getElementsByTagName('a')[0].getAttribute('href'));
    if (type === 'chapter') {
        return `/books/${getSlugFromTitleInFile(branch[2])}/chapter/${getSlugFromTitleInFile(filename)}`;
    }
    if (type === 'page') {
        return `/books/${getSlugFromTitleInFile(branch[2])}/page/${getSlugFromTitleInFile(filename)}`;
    }
};
const replaceBreadcrumbsAndLinks = (dom, breadcrumbs, filename) => {
    const titleTextElement = dom.window.document.getElementById('title-text');
    let title = "title not found";
    // Get Title
    if (titleTextElement) {
        title = dom.window.document.getElementById('title-text').textContent;
    }
    const titleHeading = dom.window.document.getElementById('title-heading');
    if (titleHeading) {
        titleHeading.remove();
    }
    const footer = dom.window.document.getElementsByClassName('footer-body');
    if (footer.length > 0) {
        footer[0].remove();
    }
    breadcrumbs === null || breadcrumbs === void 0 ? void 0 : breadcrumbs.remove();
    const linksToOtherFiles = dom.window.document.getElementsByTagName('a');
    const linksArr = [...linksToOtherFiles];
    linksArr.forEach((link, i) => {
        const href = link.getAttribute('href');
        if (isInternalLink(href)) {
            const linkType = linkToType(href);
            let newHref;
            switch (linkType) {
                case 'shelf':
                    newHref = `/shelves/${getSlugFromFilename(href)}`;
                    break;
                case 'book':
                    newHref = `/books/${getSlugFromFilename(href)}`;
                    break;
                case 'chapter':
                case 'page':
                    newHref = getLinkToChapterOrPage(href, linkType);
                    break;
            }
            if (newHref) {
                linksToOtherFiles[i].setAttribute('href', newHref);
            }
        }
    });
};
const sortFiles = () => {
    const files = fs.readdirSync(`${fileDirectory}/${subDirectory}`);
    const htmlFiles = files.filter(fn => fn.endsWith('.html'));
    const threeBreadcrumbsFilenames = [];
    const branchesWithFourOrMore = [];
    htmlFiles.forEach(filename => {
        const file = fs.readFileSync(getFilePath(filename), 'utf-8');
        const dom = new jsdom.JSDOM(file);
        const breadcrumbs = dom.window.document.getElementById('breadcrumbs');
        if (breadcrumbs) {
            const breadcrumbListItems = breadcrumbs.getElementsByTagName('li');
            if (breadcrumbListItems.length === 1) {
                // Consistent. Always a shelf.
                sortedFiles.shelves.push(filename);
            }
            if (breadcrumbListItems.length === 2) {
                // Consistent. Always a book.
                sortedFiles.books.push(filename);
            }
            if (breadcrumbListItems.length === 3) {
                // PROBLEM: Could be chapter or page depending on what comes after.
                // Populate branchesWithFourOrMore FIRST, then handle this and check branches for existing structures to determine if something comes after or not.
                threeBreadcrumbsFilenames.push(filename);
            }
            if (breadcrumbListItems.length >= 4) {
                // Third breadcrumb is chapter, anything after is page
                const arr = [...breadcrumbListItems];
                const branch = arr.map(v => v.getElementsByTagName('a')[0].getAttribute('href'));
                branchesWithFourOrMore.push(branch);
                sortedFiles.pages.push(filename);
                sortedFiles.chapterFilenames.push(branch[3]);
                sortedFiles.chapters[branch[3]] = {
                    bookPreviousId: getIdFromFilename(branch[2]),
                    chapterFilename: branch[3],
                    chapterPreviousId: getIdFromFilename(branch[3]),
                    pageFilenames: sortedFiles.chapters[branch[3]] && sortedFiles.chapters[branch[3]].pageFilenames ? [...sortedFiles.chapters[branch[3]].pageFilenames, filename] : [filename]
                };
            }
        }
    });
    threeBreadcrumbsFilenames.forEach(filename => {
        const indexIncludingThisFile = branchesWithFourOrMore.findIndex(arr => arr.includes(filename));
        if (indexIncludingThisFile > -1) {
            // Is a chapter
        }
        else {
            // Is a page with no chapter files
            sortedFiles.pages.push(filename);
            sortedFiles.pagesBelongBook.push({
                pageFilename: filename
            });
        }
    });
};
const createChapters = () => __awaiter(void 0, void 0, void 0, function* () {
    const chapterFilenames = Object.keys(sortedFiles.chapters);
    const promises = chapterFilenames.map((chapterFilename, i) => {
        const file = fs.readFileSync(getFilePath(chapterFilename), 'utf-8');
        const dom = new jsdom.JSDOM(file);
        const breadcrumbs = dom.window.document.getElementById('breadcrumbs');
        const titleHeading = dom.window.document.getElementById('title-heading');
        const parentBook = books.find(book => book.previousId === sortedFiles.chapters[chapterFilename].bookPreviousId);
        const titleTextElement = dom.window.document.getElementById('title-text');
        let title = "generic title";
        if (titleTextElement) {
            title = dom.window.document.getElementById('title-text').textContent;
        }
        titleHeading.remove();
        breadcrumbs.remove();
        const htmlString = dom.serialize();
        if (title.includes(" : ")) {
            title = title.split(' : ')[1];
        }
        const params = {
            name: title,
            book_id: parentBook.book
        };
        return new Promise(resolve => setTimeout(resolve, i * timeoutBetweenPages))
            .then(() => {
            return axios.createChapter(params)
                .then(resp => {
                const newChapterId = resp.data.id;
                chapters.push({
                    id: newChapterId,
                    previousId: sortedFiles.chapters[chapterFilename].chapterPreviousId
                });
                sortedFiles.chapters[chapterFilename].pageFilenames.forEach(fn => {
                    sortedFiles.pagesBelongChapter.push({
                        chapterId: newChapterId,
                        pageFilename: fn
                    });
                });
                console.log(`\x1b[32m ${chapterFilename} \x1b[0m`);
                chapterCreatedCount++;
                return newChapterId;
            })
                .then(newChapterId => {
                const generalPageParams = {
                    chapter_id: newChapterId,
                    name: "_General",
                    html: htmlString
                };
                return axios.createPage(generalPageParams)
                    .then(resp => {
                    chapterGeneralPages.push(chapterFilename);
                })
                    .catch(err => {
                    retry.chapterGeneralPages.push(generalPageParams);
                });
            })
                .catch(err => {
                console.log(err);
                chaptersNotCreated.push(chapterFilename);
                retry.chapters.push({
                    chapterParams: params,
                    generalHtml: htmlString
                });
                console.log(`\x1b[31m ${chapterFilename} \x1b[0m`);
            });
        });
    });
    const createdChapters = Promise.all(promises);
    return createdChapters;
});
const putBooksOnShelves = () => __awaiter(void 0, void 0, void 0, function* () {
    const shelfIds = books.map(book => book.shelf);
    const uniqueIds = shelfIds.filter(onlyUnique);
    const promises = uniqueIds.map((id) => {
        const shelfBooks = books.filter(b => b.shelf === id).map(b => b.book);
        return axios.updateShelf(id, { books: shelfBooks });
    });
    const updatedShelves = yield Promise.all(promises);
    return updatedShelves;
});
const createBooks = () => __awaiter(void 0, void 0, void 0, function* () {
    const promises = sortedFiles.books.map((filename, i) => {
        const file = fs.readFileSync(getFilePath(filename), 'utf-8');
        const dom = new jsdom.JSDOM(file);
        const breadcrumbs = dom.window.document.getElementById('breadcrumbs');
        const breadcrumbLinkItems = breadcrumbs.getElementsByTagName('a');
        var arr = [...breadcrumbLinkItems];
        let parentShelf;
        arr.forEach((item, i) => {
            if (item.getAttribute('href').includes('Home_')) {
                parentShelf = shelves.find(shelf => shelf.previousId === getIdFromHref(item));
            }
        });
        const titleTextElement = dom.window.document.getElementById('title-text');
        let title = "generic title";
        if (titleTextElement) {
            title = dom.window.document.getElementById('title-text').textContent;
        }
        if (title.includes(" : ")) {
            title = title.split(' : ')[1];
        }
        replaceBreadcrumbsAndLinks(dom, breadcrumbs, filename);
        const htmlString = dom.serialize();
        let bookId;
        return new Promise(resolve => setTimeout(resolve, i * timeoutBetweenPages))
            .then(() => {
            return axios.createBook({
                name: `${title}`,
            })
                .then(resp => {
                bookId = resp.data.id;
                books.push({
                    book: bookId,
                    previousId: getIdFromFilename(filename),
                    shelf: parentShelf.id
                });
                bookCreatedCount++;
                return axios.createPage({
                    book_id: bookId,
                    name: "_General",
                    html: htmlString
                });
            })
                .then(resp => {
                console.log(`\x1b[32m ${filename} \x1b[0m`);
                return resp.data;
            })
                .catch(err => {
                console.log(`\x1b[31m ${filename} \x1b[0m`);
                booksNotCreated.push(filename);
            });
        });
    });
    const createdBooks = yield Promise.all(promises);
    return createdBooks;
});
const createShelves = () => __awaiter(void 0, void 0, void 0, function* () {
    const shelfPromises = sortedFiles.shelves.map((shelfFileName, i) => {
        const file = fs.readFileSync(getFilePath(shelfFileName), 'utf-8');
        const dom = new jsdom.JSDOM(file);
        const breadCrumbs = dom.window.document.getElementById('breadcrumbs');
        const titleHeading = dom.window.document.getElementById('title-heading');
        const breadcrumbsFirst = breadCrumbs.getElementsByClassName('first');
        breadCrumbs.remove();
        titleHeading.remove();
        const htmlString = dom.serialize();
        const title = breadcrumbsFirst[0].getElementsByTagName('a')[0].textContent;
        let bookId;
        return axios.createBook({
            name: `${title}: Home`
        })
            .then(resp => {
            bookId = resp.data.id;
            return axios.createPage({
                book_id: bookId,
                name: "_General",
                html: htmlString
            });
        })
            .then(resp => {
            return axios.createShelf({
                name: title,
                books: [bookId],
            });
        })
            .then(resp => {
            shelves.push({
                id: resp.data.id,
                previousId: getIdFromFilename(shelfFileName)
            });
            return resp.data;
        })
            .catch(err => {
            console.log(err);
        });
    });
    const createdShelves = yield Promise.all(shelfPromises);
    return createdShelves;
});
const createAttachment = () => __awaiter(void 0, void 0, void 0, function* () {
    const params = {
        uploaded_to: 10306,
        name: 'Generic name!',
        file: fs.createReadStream('./html/ITDocs/attachments/3768481/3866673.jpg')
    };
    console.log(params);
    axios.createAttachment(params)
        .then(resp => {
        console.log(resp.data);
    })
        .catch(err => {
        console.log(err);
    });
});
const createAttachments = (dom, replacedImages, page_id) => __awaiter(void 0, void 0, void 0, function* () {
    const links = dom.window.document.getElementsByTagName('a');
    const arr = [...links];
    arr.forEach((link, i) => {
        const href = link.getAttribute('href');
        if (href && fs.existsSync(getFilePath(href))) {
            if (!replacedImages.includes(href)) {
                setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
                    let name = '';
                    if (link.textContent) {
                        name = link.textContent;
                    }
                    const params = {
                        uploaded_to: page_id,
                        name: link.textContent,
                        file: fs.createReadStream(getFilePath(href))
                    };
                    axios.createAttachment(params)
                        .then(resp => {
                        console.log(resp.data);
                    })
                        .catch(err => {
                        console.log(err);
                        // console.log(err.response.data)
                    });
                }), i * timeoutBetweenPages);
            }
        }
    });
});
const getBase64FromElement = (element) => {
    const path = getFilePath(element.getAttribute('src'));
    const data = fs.readFileSync(path);
    return data.toString('base64');
};
const replaceImgWithBase64 = (dom, fileId) => {
    let replacedImages = [];
    const imgElements = dom.window.document.getElementsByTagName('img');
    const arr = [...imgElements];
    arr.forEach((img, i) => {
        if (img.getAttribute('src') && fs.existsSync(getFilePath(img.getAttribute('src')))) {
            replacedImages.push(img.getAttribute('src'));
            imgElements[i].setAttribute('src', `data:image/png;base64, ${getBase64FromElement(img)}`);
        }
    });
    return replacedImages;
};
const createPages = (pagesArray) => __awaiter(void 0, void 0, void 0, function* () {
    const filenames = pagesArray.map(p => p.pageFilename);
    const promises = filenames.map((filename, i) => {
        const file = fs.readFileSync(getFilePath(filename), 'utf-8');
        let dom = new jsdom.JSDOM(file);
        const breadcrumbs = dom.window.document.getElementById('breadcrumbs');
        const breadcrumbLinkItems = breadcrumbs.getElementsByTagName('a');
        const titleHeading = dom.window.document.getElementById('title-heading');
        var arr = [...breadcrumbLinkItems];
        let parentBook;
        arr.forEach((item, i) => {
            if (i === 2) {
                const parentBookPreviousId = getIdFromHref(item);
                parentBook = books.find(b => b.previousId === parentBookPreviousId);
            }
        });
        const titleTextElement = dom.window.document.getElementById('title-text');
        let title = "title not found";
        if (titleTextElement) {
            title = dom.window.document.getElementById('title-text').textContent;
        }
        if (title.includes(" : ")) {
            title = title.split(' : ')[1];
        }
        replaceImgWithBase64(dom, getIdFromFilename(filename));
        titleHeading.remove();
        replaceBreadcrumbsAndLinks(dom, breadcrumbs, filename);
        const htmlString = dom.serialize();
        const params = {
            name: `${title}`,
            html: htmlString
        };
        if (pagesArray[i].chapterId) {
            params.chapter_id = pagesArray[i].chapterId;
        }
        else {
            params.book_id = parentBook.book;
        }
        return new Promise(resolve => setTimeout(resolve, i * timeoutBetweenPages))
            .then(() => {
            return axios.createPage(params)
                .then(resp => {
                console.log(`\x1b[32m ${filename} \x1b[0m`);
                pageCreatedCount++;
                // createAttachments(dom, replacedImages, resp.data.id)
            })
                .catch(err => {
                console.log(`\x1b[31m ${filename} \x1b[0m`);
                pagesNotCreated.push(filename);
                console.log(err);
            });
        });
    });
    const createdPages = Promise.all(promises);
    return createdPages;
});
const fixLinks = () => {
    sortFiles();
    const files = fs.readdirSync(`${fileDirectory}/${subDirectory}`);
    const htmlFiles = files.filter(fn => fn.endsWith('.html'));
    htmlFiles.forEach(filename => {
        if (filename !== 'index.html') {
            const file = fs.readFileSync(getFilePath(filename), 'utf-8');
            const dom = new jsdom.JSDOM(file);
            const breadcrumbs = dom.window.document.getElementById('breadcrumbs');
            replaceBreadcrumbsAndLinks(dom, breadcrumbs, filename);
        }
    });
};
const chapterRetry = () => __awaiter(void 0, void 0, void 0, function* () {
    let promises = retry.chapters.map((chapter) => {
        const { filename } = chapter.chapterParams;
        return axios.createChapter(chapter.chapterParams)
            .then(resp => {
            const newChapterId = resp.data.id;
            chapters.push({
                id: newChapterId,
                previousId: sortedFiles.chapters[filename].chapterPreviousId
            });
            sortedFiles.chapters[filename].pageFilenames.forEach(fn => {
                sortedFiles.pagesBelongChapter.push({
                    chapterId: newChapterId,
                    pageFilename: fn
                });
            });
            console.log(`\x1b[32m ${filename} \x1b[0m`);
            chapterCreatedCount++;
            return resp;
        })
            .then(resp => {
            // return axios.create
        });
    });
});
const handleRetry = () => __awaiter(void 0, void 0, void 0, function* () {
    if (retry.chapters.length > 0) {
        // await 
    }
    return;
});
const hiJon = (options) => {
    console.log(options.color);
    console.log("                         *#@@@@@@@@@@@@@@@@@@@*                           ");
    console.log("                  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@                        ");
    console.log("                @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@                     ");
    console.log("              @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%                  ");
    console.log("           *@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*               ");
    console.log("         &@@@@@@@@@@@@@@@@@@@@@@@@@,@@@@@@@@@@@@@@@@@@@@@@@.              ");
    console.log("       /@@@@@@@@@@@@@@@@@@@@@@@@@@ @@@@@@@@@@@@@@@@@@@@@@@@@@(            ");
    console.log("      @@@@@@@@@@@@@@@@@@@@@@@@@@.@@@@@&@@@@@@@@@@@@@@@@@@@@@@@@           ");
    console.log("     @%@@@@@@@@@@@@@@@@@@@@@@@ @@@@@.@@@@@@@@@@@@ @@@@@@@@@@@@@@          ");
    console.log("      (@@@@@@@@@@@@@/@@@@@@,*@@@@  @@@@@@@@@@@@/ @@%@@@@@@@@@@@@@         ");
    console.log("      @@@@@@@@@@@,.@@@@  /@@&   @@@@@@@@@@@@@.  @@  @@@@@@@@@@@@@%        ");
    console.log("     %@@@@@@@@@@@@   @@    @@@@@@@@@@@@@@(           @@@@@@@@@@@@@@       ");
    console.log("     &@@@@@@@@@@@@@@@@@@@@@@@@@@@@*   .#@@@@@@#      @@@@@@@@@@@@@        ");
    console.log("     @@@@@@@@@@@@@,           #@   @@            @@@@@@@@@@@@@@@@         ");
    console.log("    @@@@@@@@@@   %,           #,    @            @     @@@@@@@@@@@        ");
    console.log("    %@@@@@@@@@    @           @     @           @     /@@@@@@@@@&*        ");
    console.log("  &@@@@@@@@@@@(     #@*   *#&         #@*   *&@       /@@@@@@@#           ");
    console.log("       @@@@% @@                                       @@  @@@@@@          ");
    console.log("        @@@@ /@                                      ,@. @@@@%            ");
    console.log("      (@@@@@# @@                                     @@ #@@@@@@           ");
    console.log("      @@@@@@@ /@*        .@@@@@@@@@@@@@@@@.         *@@ #@@@@@@@          ");
    console.log("        &@@@@@@@@@.   &@@@@@@@@@@@@@@@@@@@@@@.    .@@@@@@@@,.             ");
    console.log("            ((,@@@@@( (@@                  @@,  @@@@@@ ((                 ");
    console.log("                 @@@@. @@                  @@  @@@@@                      ");
    console.log("                  &@@@@@@#  @@@@&&&&@@@@  @@@@@@@@&                       ");
    console.log("                   &@@@@@@#  ,@@@@@@@@   @@@@@@@@                         ");
    console.log("                     %@@@@@@@@@@@@@@@@@@@@@@@@@                           ");
    console.log("                       ,@@@@@@@@@@@@@@@@@@@@@                             ");
    console.log("                          #@@@@@@@@@@@@@@@                                ");
    console.log("                                                                          ");
    console.log("\x1b[0m");
};
const displayResultsAndTrey = () => {
    console.log('------------------------------------------------');
    console.log(`\x1b[32m Books Created: ${bookCreatedCount} \x1b[0m`);
    console.log(`\x1b[32m Chapters Created: ${chapterCreatedCount} \x1b[0m`);
    console.log(`\x1b[32m Pages Created: ${pageCreatedCount} \x1b[0m`);
    console.log(`\x1b[31m Book Errors: ${booksNotCreated.length} \x1b[0m`);
    console.log(`\x1b[31m Chapter Errors: ${chaptersNotCreated.length} \x1b[0m`);
    console.log(`\x1b[31m Page Errors: ${pagesNotCreated.length} \x1b[0m`);
    hiJon({
        color: booksNotCreated.length > 0 || pagesNotCreated.length > 0 || retry.chapterGeneralPages.length > 0 ? '\x1b[91m' : '\x1b[32m'
    });
    console.log("Books Not Created:");
    booksNotCreated.forEach((book) => {
        console.log(`\x1b[91m ${book} \x1b[0m`);
    });
    console.log("Chapters Not Created:");
    chaptersNotCreated.forEach((chapter) => {
        console.log(`\x1b[91m ${chapter} \x1b[0m`);
    });
    console.log("Chapter Generals Not Created:");
    retry.chapterGeneralPages.forEach((chapter) => {
        console.log(`\x1b[91m ${chapter} \x1b[0m`);
    });
    console.log("Pages Not Created:");
    pagesNotCreated.forEach((page) => {
        console.log(`\x1b[91m ${page} \x1b[0m`);
    });
};
const init = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('\x1b[33m Sorting files... \x1b[0m');
    sortFiles();
    console.log('\x1b[32m Files sorted \x1b[0m');
    console.log('\x1b[33m Creating shelves... \x1b[0m');
    yield createShelves();
    console.log('\x1b[32m Shelves created! \x1b[0m');
    console.log('\x1b[33m Creating books... \x1b[0m');
    yield createBooks();
    console.log('\x1b[32m Books created! \x1b[0m');
    console.log('\x1b[33m Putting Books on Shelves... \x1b[0m');
    yield putBooksOnShelves();
    console.log('\x1b[32m Books are on the shelves! \x1b[0m');
    console.log('\x1b[33m Creating chapters... \x1b[0m');
    setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
        yield createChapters();
        console.log('\x1b[32m Chapters Created! \x1b[0m');
        console.log('\x1b[33m Creating Standalone Pages... \x1b[0m');
        yield createPages(sortedFiles.pagesBelongBook);
        console.log('\x1b[32m Standalone Pages Created! \x1b[0m');
        console.log('\x1b[33m Creating Pages in Chapters... \x1b[0m');
        yield createPages(sortedFiles.pagesBelongChapter);
        console.log('\x1b[32m Pages in Chapters Created! \x1b[0m');
        yield handleRetry();
        displayResultsAndTrey();
    }), 1000);
});
process.argv.forEach(function (val, index, array) {
    console.log('HIIIII', index, val);
    if (index === 4 && !!val) {
        subDirectory = val;
    }
    if (index === 5 && !!val) {
        timeoutBetweenPages = parseFloat(val);
    }
    if (val.toLowerCase() === '-moretrey') {
        moreTrey = true;
    }
});
if (process.argv[3] === 'import') {
    if (subDirectory) {
        init();
    }
    else {
        console.log('Please include an argument for subdirectory');
    }
}
if (process.argv[3] === 'sort') {
    sortFiles();
}
if (process.argv[3] === 'attachments') {
    createAttachment();
}
if (process.argv[3] === 'fixLinks') {
    fixLinks();
}
//# sourceMappingURL=import.js.map