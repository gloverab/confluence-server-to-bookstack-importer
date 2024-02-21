# Confluence Server To Bookstack Importer

You'll need basically any version of node installed.

## Get Started

- Set your .env variables. 
- `cd` to this directory
- `npm install`
- Create an `.env` file and fill in your details following the format provided in `.env-example`.

## Functionality

You can import 1 shelf at a time from a Confluence HTML export.

BookStack does not support putting Pages directly on Shelves. Nor does it support a large amount of HTML directly on a Book. 

To fit the freeform nature of Confluence into BookStack's structure, for any "pages" that live directly on a "shelf" in Confluence, the importer will create a Book with a single page, titled "_General."

In the example below, any HTML content on "Our Services" and "Network Overview" will be turned into a "_General" page, and nested in the "Our Services" book. Other than that caveat, if your index.html looks anything like the one below, you'll be in good shape.

![Example index.html File](https://www.dropbox.com/scl/fi/iiwd1euldqbx5kul636x1/Screen-Shot-2024-02-21-at-3.30.44-PM.png?rlkey=12tncrign7zqjr49fdiwvhp1y&raw=1)

- Images displayed in the HTML will be automatically uploaded
- Embedded links to other docs will be updated with best guess of what the new URL will be, based on BookStack's slugify function and URL generation. This will get a little wonky if there are duplicate filenames, and there's definitely a chance I missed something.
- Attachments is a separate script and must be run after importing. More on that below.

## Usage
You should do a full Confluence HTML export and leave all the html files, attachments, images, and styles in place. You can move the whole folder wherever you want and define the path to the HTML in your .env file.

### Importing a shelf

To import a folder of HTML files to bookstack, run:
`npm run import <subdirectory-in-html-folder>`

For example, if you're trying to import `./html/ITDocs`:
- Your .env `PATH_TO_HTML` would be set to `./html`
- You would run `npm run import ITDocs`

### Importing Attachments
To import a shelf, you MUST have imported the shelf first. The shelf import script stores the attachment paths and their corresponding IDs in `attachmentsFile.js`, and it's crucial that the IDs are correct. Once the import script has successfully run on a folder:
- run `npm run attach ITDocs`

### Delete books by shelf
To delete all the books for a shelf:
- run `npm run killShelf`
- You will receive a list of existing shelves and their IDs, and you will be prompted to enter an ID for the shelf whose books you'd like to delete. Enter the id (ex. 257) and hit Enter.

## Nuke
You can delete everything by running:
`node nuke.js`

## Caveats
This is a work in progress. It currently does not import images and attachments.