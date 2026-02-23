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

- Images displayed in the HTML (including embedded/base64) are uploaded as BookStack attachments during import.
- Confluence attachment files (from the export's `attachments/` folder) are uploaded after pages are created—either automatically when using the runner, or manually (see below).
- Embedded links to other docs will be updated with best guess of what the new URL will be, based on BookStack's slugify function and URL generation. This will get a little wonky if there are duplicate filenames, and there's definitely a chance I missed something.

## Usage
You should do a full Confluence HTML export and leave all the html files, attachments, images, and styles in place. You can move the whole folder wherever you want and define the path to the HTML in your .env file.

### Run from input folder (recommended)
1. Export your Confluence space as HTML and zip the export folder.
2. Put the **single** `.zip` file in the `input/` folder at the project root.
3. Run:
   ```bash
   npm run from-input
   ```
   The script will:
   - Unzip the archive into `html/`
   - Detect the HTML root and all shelf subdirectories
   - Build TypeScript, then run the import for each shelf (with detailed progress)
   - After each shelf, upload Confluence attachment files for that shelf
   - Optionally remove the zip when done (disabled by default)

   To import only one shelf: `npm run from-input <shelfName>` (e.g. `npm run from-input ITDocs`).

### Importing a shelf (manual)

To import a folder of HTML files to bookstack, run:
`npm run import <subdirectory-in-html-folder>`

For example, if you're trying to import `./html/ITDocs`:
- Your .env `PATH_TO_HTML` would be set to `./html`
- You would run `npm run import ITDocs`

### Uploading attachments for already-imported pages
If you have already run the import and only need to upload Confluence attachment files (and/or re-run that step), set `PATH_TO_HTML` to the same HTML export root you used for the import (e.g. in `.env` or in the shell), then run:

```bash
node ./dist/import.js -- attachments <shelfName>
```

Example for a shelf named CHAX (after building with `npx tsc`):

```bash
# Windows (cmd)
set PATH_TO_HTML=C:\path\to\html
node ./dist/import.js -- attachments CHAX

# Windows (PowerShell)
$env:PATH_TO_HTML = "C:\path\to\html"
node ./dist/import.js -- attachments CHAX

# Unix / macOS
PATH_TO_HTML=/path/to/html node ./dist/import.js -- attachments CHAX
```

Or use the npm script (shelf name after `--`): `npm run attachments -- CHAX`

The import must have run at least once for that shelf so that `outputJS/attachmentsFile.js` contains the mapping of Confluence pages to BookStack page IDs (`pageNewId`).

### Delete books by shelf
To delete all the books for a shelf:
- run `npm run killShelf`
- You will receive a list of existing shelves and their IDs, and you will be prompted to enter an ID for the shelf whose books you'd like to delete. Enter the id (ex. 257) and hit Enter.

## Nuke
You can delete everything by running:
`node nuke.js`

## Caveats
This is a work in progress.