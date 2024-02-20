# Confluence Server To Bookstack Importer

You'll need basically any version of node installed.

## Get Started

- Set your .env variables. 
- `cd` to this directory
- `npm install`

## Usage

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