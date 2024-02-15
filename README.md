# Confluence Server To Bookstack Importer

You'll need basically any version of node installed.

## Get Started

- Set your .env variables. 
- `cd` to this directory
- `npm install`

## Usage
To import a folder of HTML files to bookstack, run:
`npm run import <subdirectory-in-html-folder>`

For example, if you're trying to import `./html/IT-stuff`:
- Your .env `PATH_TO_HTML` would be set to `./html`
- You would run `npm run import IT-stuff`

## Nuke
If an import gets messed up, you can delete everything by running:
`node nuke.js`

## Caveats
This is a work in progress. It currently does not import images and attachments.