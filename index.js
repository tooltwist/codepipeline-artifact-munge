var JSZip = require('jszip');
const fs = require("fs")
const mergeIntoZip = require('./mergeIntoZip')

const file1 = './testfiles/App.zip'
const file2 = './testfiles/SecureConfig.zip'
const ofile = '/tmp/out.zip'

fs.readFile(file1, function(err, content1) {
  if (err) {
    throw err; // or handle err
  }

  fs.readFile(file2, function(err, content2) {
    if (err) {
      throw err; // or handle err
    }

    mergeIntoZip(content1, content2, 'secure-config', function(err, newZipfile) {
      if (err) {
        console.log(err);
        throw err; // or handle err
      }

      newZipfile.generateNodeStream({type: 'nodebuffer', streamFiles: true}).pipe(fs.createWriteStream(ofile)).on('finish', function() {
        // JSZip generates a readable stream with a "end" event,
        // but is piped here in a writable stream which emits a "finish" event.
        console.log(`${ofile} written.`);
      });
    })

  }); //- read file2
}); //- read file1
