/*
 *  References:
 *
 *  https://docs.aws.amazon.com/codepipeline/latest/APIReference/Welcome.html
 *  https://docs.aws.amazon.com/codepipeline/latest/userguide/actions-invoke-lambda-function.html
 *  https://stelligent.com/2016/02/08/aws-lambda-functions-aws-codepipeline-cloudformation/
 *  http://manualzz.com/doc/7476000/aws-codepipeline-user-guide---aws-documentation (page 85)
 */

'use strict';

console.log('Loading function');

const AWS = require('aws-sdk');
const extractFromZip = require('./extractFromZip')
const VERSION = require('./version.js')

// const s3 = new AWS.S3({apiVersion: '2006-03-01'});

exports.handler = (event, context, callback) => {
  console.log('extract.handler()');
  console.log('Version is ' + VERSION);
  console.log('Received event:', JSON.stringify(event, null, 2));

  // Get the CodePipeline details
  const job = event['CodePipeline.job']
  if (!job) {
    const message = `Error: lambda is missing event['CodePipeline.job']`;
    console.log(message);
    return callback(message);
  }

  /*
   *  Functions to set job status
   *  These (1) notify CodePipeline of the result, then (2) Notify Lambda of the result.

   *  Without notifying CodePipeline, the stage will hang and eventually time out.
   *
   *  Some example code uses context.succeed() and context.fail() to indicate the handler
   *  result, but those functions are now deprecated.
   *
   *  References:
   *    https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-handler.html)
   *    https://www.linkedin.com/pulse/aws-pro-tip-codepipeline-lambda-invocation-milos-bejda/
   *    http://manualzz.com/doc/7476000/aws-codepipeline-user-guide---aws-documentation, page 85
   */
  var codepipeline = new AWS.CodePipeline();
  var jobId = job.id;

  var notifySuccess = function(message) {
    const params = {
      jobId: jobId
    }
    codepipeline.putJobSuccessResult(params, function(err, data) {
      if (err) {
        console.log('---- Error calling codepipeline.putJobSuccessResult() ----\n', err);
        return callback(err);
      } else {
        console.log('codepipeline.putJobSuccessResult() called successfully');
        return callback(null, message);
      }
    });
  };

  var notifyFailure = function(message, failureError) {
    console.log('notifyFailure: ' + message);
    console.log(failureError);

    // Notify CodePipeline of the problem
    console.log('CodePipeline jobId is ' + jobId);
    const params = {
      jobId: jobId,
      failureDetails: {
        message: JSON.stringify(message),
        type: 'JobFailed',
        externalExecutionId: context.invokeid
      }
    }
    codepipeline.putJobFailureResult(params, function(err, data) {
      if (err) {
        console.log('---- Error calling codepipeline.putJobFailureResult() ----\n', err);
        return callback(err); // Could not update status (a error reporting the error)
      } else if (failureError) {
        console.log('codepipeline.putJobFailureResult() called successfully');
        return callback(failureError);
      } else {
        console.log('codepipeline.putJobFailureResult() called successfully');
        return callback(new Error(message)); // Return the failure
      }
    });
  };

  /*
   *  Check parameters to this Lambda.
   */
  const filenames = job.data.actionConfiguration.configuration.UserParameters;
  if (!filenames) {
    const message = `Error: lambda expects UserParameters to be a comma separated list of file names.`;
    return notifyFailure(null, message);
  }
  console.log('UserParameters used as filenames: ' + filenames);
  const inputArtifacts = job.data.inputArtifacts;
  if (!inputArtifacts || inputArtifacts.length != 1) {
    const message = `Error: lambda expects event['CodePipeline.job'].data.inputArtifacts to have one entry.`;
    return notifyFailure(null, message);
  }
  const artifact1 = inputArtifacts[0];
  if (!artifact1.location || artifact1.location.type != 'S3') {
    const message = `Error: lambda expects event['CodePipeline.job'].data.inputArtifacts[0].location.type to be "S3".`;
    return notifyFailure(null, message);
  }
  const outputArtifacts = job.data.outputArtifacts;
  if (!outputArtifacts || outputArtifacts.length != 1) {
    const message = `Error: lambda expects event['CodePipeline.job'].data.inputArtifacts to have one entry.`;
    return notifyFailure(null, message);
  }
  const outputArtifact = outputArtifacts[0];
  if (!outputArtifact.location || outputArtifact.location.type != 'S3') {
    const message = `Error: lambda expects event['CodePipeline.job'].data.outputArtifacts[0].location.type to be "S3".`;
    return notifyFailure(null, message);
  }

  // https://reformatcode.com/code/nodejs/extract-a-kms-encrypted-zip-file-from-aws-s3
  const credentials = job.data.artifactCredentials;
  const s3 = new AWS.S3({apiVersion: '2006-03-01', credentials: credentials});

  /*
   *  Load the input artifact
   */
  const artifactName1 = artifact1.name;
  const bucket1 = artifact1.location.s3Location.bucketName;
  const key1 = artifact1.location.s3Location.objectKey;
  const params1 = {
    Bucket: bucket1,
    Key: key1
  };
  console.log(`Artifact ${artifactName1}:`, params1);
  s3.getObject(params1, (err, data1) => {
    if (err) {
      const message = `Error getting object ${key1} from bucket ${bucket1}. Make sure they exist and your bucket is in the same region as this function.`;
      return notifyFailure(message, err);
    }
    console.log(`  type=${data1.ContentType}, length=${data1.ContentLength}`)
    var content1 = data1.Body;

    // /*
    //  *  Load the second artifact
    //  */
    // const artifactName2 = artifact2.name;
    // const bucket2 = artifact2.location.s3Location.bucketName;
    // const key2 = artifact2.location.s3Location.objectKey;
    // const params2 = {
    //   Bucket: bucket2,
    //   Key: key2
    // };
    // console.log(`Artifact ${artifactName2}:`, params2);
    // s3.getObject(params2, (err, data2) => {
    //   if (err) {
    //     const message = `Error getting object ${key2} from bucket ${bucket2}. Make sure they exist and your bucket is in the same region as this function.`;
    //     return notifyFailure(message, err);
    //   }
    //   console.log(`  type=${data2.ContentType}, length=${data2.ContentLength}`)
    //   var content2 = data2.Body;

    /*
       *  Merge the second zip file into the first.
       */
    //const filenames = 'Deploy.zip'
    extractFromZip(content1, filenames, function(err, outputContent) {
      if (err) {
        const message = `Error while merging Zip files.`
        return notifyFailure(message, err);
      }
      console.log('Merge complete.');

      // Save the output artifact
      const outputName = outputArtifact.name;
      const outputBucket = outputArtifact.location.s3Location.bucketName;
      const outputKey = outputArtifact.location.s3Location.objectKey;
      console.log(`Writing output artifact ${outputName}`);
      console.log(`  bucket: ${outputBucket}`);
      console.log(`     key: ${outputKey}`);

      // newZipfile.generateAsync({type: 'array'}).then(function(outputContent) {

      console.log('Have zip file - time to write to S3 bucket.');

      // See https://stackoverflow.com/questions/40188287/aws-lambda-function-write-to-s3
      //var s3 = new AWS.S3();
      var params = {
        Bucket: outputBucket,
        Key: outputKey,
        Body: outputContent
      }
      s3.putObject(params, function(err, data) {
        if (err) {
          const message = `Error while saving output artifact to S3 bucket.`
          return notifyFailure(message, err);
        }

        // All complete
        console.log('Output artifact written successfully');
        return notifySuccess('Merge complete');

      }) //- putObject
      // }, function(err) {
      //   const message = `Error while saving output artifact to S3 bucket.`
      //   return notifyFailure(message, err);
      // }) - newZipfile
    }) //- mergeIntoZip
  }) // first artifact
}
