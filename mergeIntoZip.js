//
// Merge one zip file into another.
//
// References:
//  http://stuk.github.io/jszip/documentation/examples.html
//  https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getObject-property
//

var JSZip = require('jszip');

/*
 *  Input is two zip files in memory, in Zip format.
 *  These are converted into object representation.
 *  All the files in the second zip are copied across into the first, with
 *  their same relative paths, but under 'insertPath'.
 *  The returned 'newZipfile' is already in Zip format, ready to be written to disk or S3.
 */
module.exports = function mergeIntoZip(zipfile1, zipfile2, insertPath, callback/*(err,newZipfile)*/) {
  console.log('mergeIntoZip 1');
  JSZip.loadAsync(zipfile1).then(function(zip1) {
    console.log('mergeIntoZip 2');
    JSZip.loadAsync(zipfile2).then(function(zip2) {
      console.log('mergeIntoZip 3');
      // console.log('files 1:', zip1.files);
      //console.log('files 2:', zip2.files);

      // console.log('-------------');
      // Create an array of file names (paths actually)
      var list = []
      for (name in zip2.files) {
        var file = zip2.files[name]
        if (!file.dir) {
          // console.log(' - ' + name);
          list.push(name);
        }
      }

      // Iterate through the files. This is an asynchronous operation.
      console.log('-------------');
      (function nextFile(index) {
        if (index >= list.length) {
          // All done. Convert the modified Zip file back into a buffer
          console.log('mergeIntoZip 4');
          zip1.generateAsync({type: 'nodeBuffer'}).then(function(outputContent) {
            console.log('mergeIntoZip 5');
            // Successfully converted to zip file format.
            // console.log(typeof(outputContent));
            // console.log('Length is: ' + outputContent.length);
            callback(null, outputContent)
          }, function(error) {
            // Error
            console.log('Failed to convert to zipfile format:', error);
            callback(error);
          });
          return;
        }

        // Copy the next file from zip2 into zip1.
        var name = list[index]
        console.log(`    - ${name}`);
        var file = zip2.file(name);
        file.async("uint8array").then(content => {
          // console.log('  content:', content);

          // Add the file into the first zip
          zip1.file(insertPath + name, content, {
            date: file.date,
            unixPermissions: file.unixPermissions,
            dosPermissions: file.dosPermissions,
            comment: file.comment
          })

          // On to the next file
          nextFile(index + 1)
        })
      })(0); // Start iterating
    }, function(err) { return callback(err) });
  }, function(err) { return callback(err) });
}
