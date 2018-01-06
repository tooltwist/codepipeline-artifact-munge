var JSZip = require('jszip');

module.exports = function mergeIntoZip(zipfile1, zipfile2, insertPath, callback) {

  JSZip.loadAsync(zipfile1).then(function(zip1) {
    JSZip.loadAsync(zipfile2).then(function(zip2) {
      console.log('files 1:', zip1.files);
      //console.log('files 2:', zip2.files);

      console.log('-------------');
      // Create an array of file names (paths actually)
      var list = []
      for (name in zip2.files) {
        var file = zip2.files[name]
        if (!file.dir) {
          list.push(name);
        }
      }

      // Iterate through the files. This is an asynchronous operation.
      console.log('-------------');
      (function nextFile(index) {
        if (index >= list.length) {
          // All done
          console.log('Finished');
          callback(null, zip1)
          return
        }

        var name = list[index]
        console.log(`-> ${name}`);
        var file = zip2.file(name);
        file.async("string").then(content => {
          console.log('  content:', content);

          // Add the file into the first zip
          zip1.file(insertPath + '/' + name, content, {
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
