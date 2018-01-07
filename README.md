# lambda-codepipeline-merge

CodePipeline allows a series of "stages", each consisting of one or more "actions", where the outputs of one action can be used as inputs for subsequent action. These outputs are called "artifacts" and  are stored in an S3 bucket as Zip files.

Unfortunately, some actions only ollow a single artifact to be used as input. For example, the CodePipeline _Build_ action only allows one artifact to be used as input. This causes a problem if you want to build an application that combines source files from more than one location.

This project provides a general purpose Lambda that can be inserted into a CodePipeline to allow two artifacts from previous steps to be combined to create a new artifact, to be used by a subsequent step such as _Build_.

<div style="text-align:center"><img src="https://user-images.githubusercontent.com/848697/34648939-6d0971f6-f3df-11e7-8920-c634dfea0737.png"/></div>


Inputs to the Lambda are:

**Artifact 1** - a zip file in the S3 bucket  
**Artifact 2** - also a zip file in the S3 bucket  
**insertPath**  - a path where Artifact 2 files will be inserted  

The output artifact of the step will be Artifact 1, with the entire contents of Artifact 2 inserted at the specified location.


### Using this Lambda

This Lambda is available in our public S3 bucket, but we recommend you build it from scratch yourself. To do this

1. Clone this repository onto your machine
1. Run `npm build` to create Lambda.zip
1. Upload this Zip file either into a the AWS Lambda console or into your own S3 bucket.
1. Include the Lambda in your CodePipeline.


<div style="text-align:center"><img src="https://user-images.githubusercontent.com/848697/34648933-532c01c2-f3df-11e7-8909-d0be3e0f50fe.png"/></div>

### The Use Case at ToolTwist
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

-oOo-
