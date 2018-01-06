#!/bin/bash
#
#	Create archive files, similar to those created by CodePipeline.
#
(cd App; zip -r ../App.zip *)
(cd SecureConfig; zip -r ../SecureConfig.zip *)
