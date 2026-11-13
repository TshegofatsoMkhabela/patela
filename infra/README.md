# Patela hosting (AWS Amplify)

`amplify-hosting.yaml` is a CloudFormation template for the web app's hosting. It creates:

- **PatelaApp**: the Amplify app, connected to GitHub, using `WEB_COMPUTE` hosting (needed for Next.js server rendering). Every build runs `npm test` and then `npm run build`. If either fails, nothing is deployed and the last good version stays live.
- **MainBranch**: `main`, for development. It rebuilds and redeploys on every push.
- **DemoBranch**: `demo`, the URL used on stage. Auto-build is off, so it only changes when you release it on purpose (see below).

Each branch has its own `NEXT_PUBLIC_SITE_URL`, set to its own address.

Everything runs in `us-east-1` using the AWS CLI profile `patella`. Sign in with `aws login --profile patella`.

## One-time: store the GitHub token

Amplify needs a GitHub token once, to add the deploy webhook to the repo. Store it in Secrets Manager so it never appears in this repo or in your terminal output:

```powershell
aws secretsmanager create-secret --name patela/github-token --secret-string (gh auth token) --profile patella --region us-east-1
```

One secret costs about $0.40 a month.

## Create or update the hosting

```powershell
aws cloudformation deploy --stack-name patela-hosting --template-file infra/amplify-hosting.yaml --profile patella --region us-east-1
```

Run the same command again after editing the template. To preview the changes first, add `--no-execute-changeset`.

Creating the stack doesn't build the site: the first build starts on the next push to `main`, or with:

```powershell
aws amplify start-job --app-id <AppId> --branch-name main --job-type RELEASE --profile patella --region us-east-1
```

## Release the demo

The `demo` URL is frozen. To put a version on it after rehearsing it on `main`:

1. Point the `demo` git branch at the commit you rehearsed, and push it:

   ```powershell
   git push origin main:demo
   ```

2. Build and deploy it (the push alone does nothing):

   ```powershell
   aws amplify start-job --app-id <AppId> --branch-name demo --job-type RELEASE --profile patella --region us-east-1
   ```

From then until the next release, pushes to `main` never change what's on stage. To roll back, push an older commit to `demo` and release again.

## Find the URLs and build status

```powershell
aws cloudformation describe-stacks --stack-name patela-hosting --query "Stacks[0].Outputs" --profile patella --region us-east-1
aws amplify list-jobs --app-id <AppId> --branch-name main --max-items 3 --profile patella --region us-east-1
```

## Remove everything

```powershell
aws cloudformation delete-stack --stack-name patela-hosting --profile patella --region us-east-1
```

This deletes the Amplify app and its URL. It doesn't delete the GitHub token secret.
