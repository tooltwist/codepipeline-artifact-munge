# codepipeline-artifact-munge

CodePipeline uses a series of "stages", each consisting of one or more "actions", where the outputs of one action can be used as inputs for subsequent action. These outputs are called "artifacts" and  are stored in an S3 bucket as Zip files.

Unfortunately, some actions only ollow a single artifact to be used as input. For example, the CodePipeline _Build_ action only allows one artifact to be used as input. This causes a problem if you want to build an application that combines source files from more than one location.

In other cases, only some of the files in an artifact should be passed to an action.

This project provides a general purpose [Lambda](https://aws.amazon.com/lambda/) that can be inserted into a [AWS CodePipeline](https://aws.amazon.com/codepipeline/) to allow artifacts to be **merged** or to allow files from an artifact to be **extracted**, in each case creating a new artifact.

In the example below, we have the source code in a Github repository managed by the development team, while security sensitive infrastructure configuration files and a deployment script are stored in an AWS CodeCommit repository and managed by the infras team.

These two repositories are _merged_ before the build stage, so the configuration can be baked into the Docker image.

Similarly, the Deployment script is _extracted_ from the infrastucture artifact and passed on to the deployment stage.


## Typical Use Case

<img align="right" src="https://user-images.githubusercontent.com/848697/34682108-e02e30dc-f4d8-11e7-85ec-37a96290e161.png">

At ToolTwist we use CodePipeline to deploy into CI, test, staging and production environments, which we run on Amazon ECS.

In earlier times we used the same Docker image for an applicaton in these various environments, and then injected the necessary environment-specific config files by copying them into the Docker hosts and mounting them as Docker Volumes into the application containers. This was a multi-step process, prone to error, and introducing a larger security-sensitive surface area than we would like.

Using CodePipeline, we now generate a separate Docker image for each environment, which has the environment-specific config files baked in.

- Application code comes from a Github repo.
- Environment config comes from CodeCommit repo.
- This merge step combines these before the build step that creates the Docker image, and the Dockerfile placed the config files into the required locations.

As well as simpler process, there are considerable security benefits.
1. Sensitive config details are safely stored in CodeCommit with restricted access, rather than floating around on developer and Ops user's machines.
1. The entire build process is locked down, from the time source and configs leave their git repos till the time the applications are deployed.
1. In production, sensitive config information is hidden many levels deep, back behind the subnets, security groups, and ECS hosts.
1. No sensitive information is located on in S3 buckets, or other locations that may be accidentally made public.




# Preparing the Lambda

This Lambda is available in our public S3 bucket, but we recommend you build it from scratch yourself.

1. Clone this repository onto your machine
1. Run `npm build` to create `CodepipelineArtifactMunge.zip`
1. Upload this Zip file into an S3 bucket that can be accessed from your CodePipelines.
1. Include the Lambda in your CodePipeline.

Feel free to give your S3 bucket public access if it's more convenient - this project is open source.

#### Using the Lambda

<div style="text-align:center"><img src="https://user-images.githubusercontent.com/848697/34648933-532c01c2-f3df-11e7-8909-d0be3e0f50fe.png"/></div>

#### Cloudformation definition
If you are using Cloudformation to create you CodePipeline, the following may provide a guide.

First you need to define a role for the lambdas to use. This may include a few more permissions than required - feel free to let me know.

    # From https://stelligent.com/2016/02/08/aws-lambda-functions-aws-codepipeline-cloudformation/
    CodePipelineLambdaRole:
      Type: AWS::IAM::Role
      Properties:
        RoleName: !Sub "nbt-${EnvironmentName}-${ApplicationName}-CodePipelineLambdaRole"
        Path: /
        AssumeRolePolicyDocument: |
          {
            "Statement": [{
              "Effect": "Allow",
              "Principal": { "Service": [ "lambda.amazonaws.com" ]},
              "Action": [ "sts:AssumeRole" ]
            }]
          }
        Policies:
          - PolicyName: root
            PolicyDocument:
              Version: 2012-10-17
              Statement:
                - Resource:
                    - !Sub arn:aws:s3:::${ArtifactBucket}/*
                    - !Sub arn:aws:s3:::nbt-${EnvironmentName}-configs
                    - !Sub arn:aws:s3:::nbt-${EnvironmentName}-configs/*
                  Effect: Allow
                  Action:
                    - s3:PutObject
                    - s3:GetObject
                    - s3:GetObjectVersion
                    - s3:GetBucketVersioning
                - Resource: "*"
                  Effect: Allow
                  Action:
                    - lambda:*
                    - codecommit:GetBranch
                    - codecommit:GetCommit
                    - codecommit:UploadArchive
                    - codecommit:GetUploadArchiveStatus
                    - codecommit:CancelUploadArchive
                    - codebuild:StartBuild
                    - codebuild:BatchGetBuilds
                    - cloudformation:*
                    - iam:PassRole
                    - codepipeline:PutJobSuccessResult
                    - codepipeline:PutJobFailureResult
                    - lambda:Listfunctions
                - Resource: "*"
                  Effect: Allow
                  Action:
                    - logs:CreateLogGroup
                    - logs:CreateLogStream
                    - logs:PutLogEvents


Next, define the `MergeLambda` and `ExtractLambda` functions. In this example the `CodepipelineArtifactMunge.zip` file
has been uploaded to an S3 bucket named `nbt-lambda`. You should replace that with the name of your bucket.

    # Lambda to merge artifacts
    # Reference: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-lambda-function.html
    MergeLambda:
      Type: AWS::Lambda::Function
      Properties:
        FunctionName: !Sub "nbt-${EnvironmentName}-${ApplicationName}-merge"
        Code:
          S3Bucket: "nbt-lambdas"
          S3Key: "CodepipelineArtifactMunge.zip"
        Role: !GetAtt CodePipelineLambdaRole.Arn
        Description: "Lambda function to merge artifacts in a CodePipeline"
        Timeout: 30
        Handler:  "merge.handler"
        Runtime: "nodejs6.10"
        MemorySize: 128

    # Lambda to extract artifacts
    ExtractLambda:
      Type: AWS::Lambda::Function
      Properties:
        FunctionName: !Sub "nbt-${EnvironmentName}-${ApplicationName}-extract"
        Code:
          S3Bucket: "nbt-lambdas"
          S3Key: "CodepipelineArtifactMunge.zip"
        Role: !GetAtt CodePipelineLambdaRole.Arn
        Description: "Lambda function to extract from artifacts in a CodePipeline"
        Timeout: 30
        Handler:  "extract.handler"
        Runtime: "nodejs6.10"
        MemorySize: 128



#### Inputs to MergeLambda

**Artifact 1** - a zip file in the S3 bucket  
**Artifact 2** - also a zip file in the S3 bucket  
**UserParameters**  - a path where Artifact 2 files will be inserted  

The output artifact will be Artifact 1, with the entire contents of Artifact 2 inserted at the specified location.


#### Inputs to ExtractLambda
**An Artifact** - a zip file in the S3 bucket  
**UserParameters** - a comma separated list of file names to extract from the artifact. 

The output will be an artifact containing only the specified files.


Finally, to use these functions in your CodePipeline.

    Pipeline:
      Type: AWS::CodePipeline::Pipeline
      Properties:
        ...
        Stages:
          ...

          # Merge stage
          # This merges the App and SecureConfig artifacts
          # See https://dzone.com/articles/running-aws-lambda-functions-in-aws-codepipeline-u
          - Name: Merge
            Actions:
              - Name: "app-and-config"
                ActionTypeId:
                  Category: Invoke
                  Owner: AWS
                  Version: 1
                  Provider: Lambda
                Configuration:
                  FunctionName: !Ref MergeLambda
                  UserParameters: "secure-config"
                InputArtifacts:
                  - Name: App
                  - Name: SecureConfig
                OutputArtifacts:
                  - Name: AppAndConfig
                RunOrder: 1

          ...

          # Extract stage
          # This extracts the deployment template from the SecureConfig artifact
          # See https://dzone.com/articles/running-aws-lambda-functions-in-aws-codepipeline-u
          - Name: Extract
            Actions:
              - Name: "deploy-template"
                ActionTypeId:
                  Category: Invoke
                  Owner: AWS
                  Version: 1
                  Provider: Lambda
                Configuration:
                  FunctionName: !Ref ExtractLambda
                  UserParameters: "Deploy/service.cf"
                InputArtifacts:
                  - Name: SecureConfig
                OutputArtifacts:
                  - Name: DeployTemplate2
                RunOrder: 1



## The Use Case at ToolTwist

-oOo-
