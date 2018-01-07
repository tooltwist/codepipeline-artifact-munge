//
// Extract files from a zip file to form another.
//
// References:
//  http://stuk.github.io/jszip/documentation/examples.html
//  https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getObject-property
//

var JSZip = require('jszip');

/* Input is one zip files in memory, and a comma separated file of files to extract.  The returned 'newZipfile' is already in Zip format, ready to be written to disk or S3. */
module.exports = function extractFromZip(zipcontent, filenames, callback/* (err,newZipfile) */) {

  console.log('type = ' + typeof(filenames));
  const list = filenames.split(',');
  const outputZip = new JSZip();

  JSZip.loadAsync(zipcontent).then(function(inputZip) {

    // Iterate through the files. This is an asynchronous operation.
    (function nextFile(index) {
      if (index >= list.length) {
        // All done. Convert the modified Zip file back into a buffer
        console.log('Finished creating new Zip.');
        outputZip.generateAsync({type: 'nodeBuffer'}).then(function(outputZipContent) {
          // Successfully converted to zip file format.
          callback(null, outputZipContent)
        }, function(error) {
          // Error
          console.log('Failed to convert to zipfile format:', error);
          callback(error);
        });
        return;
      }

      // Copy the next required file from inputZip to outputZip.
      var name = list[index].trim()
      console.log(`    - ${name}`);
      var file = inputZip.file(name);
      if (!file) {
        console.log(`***  WARNING: Unknown file: ${name}.`);
        return nextFile(index + 1)
      }
      file.async ("string").then(content => {
        // console.log('  content:', content);

        // Add the file into the first zip
        outputZip.file(name, content, {
          date: file.date,
          unixPermissions: file.unixPermissions,
          dosPermissions: file.dosPermissions,
          comment: file.comment
        })

        // On to the next file
        return nextFile(index + 1)
      })
    })(0); // Start iterating
  }, function(err) {
    return callback(err)
  });
}
