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

## Backend: PostgreSQL and Lambda API

`backend-lambda.yaml` is a separate stack for the Fastify API. It creates a private single-instance RDS PostgreSQL database, a Lambda HTTP API, a one-off migration Lambda, a VPC, and a NAT gateway so the Lambda can reach Google OAuth and other Google APIs. RDS and NAT incur recurring charges even while idle. The database has backups and deletion protection. The API is intentionally limited to five concurrent Lambda executions with two PostgreSQL connections per execution; review RDS Proxy before raising concurrency substantially.

The template was validated with `aws cloudformation validate-template` in `us-east-1`. It has **not** been deployed. This account currently has no Patela RDS instance or Lambda function. The Google Cloud project `patela-oauth-20261113` has a `Patela Backend` Web OAuth client (`934939871903-vejm2a9gg95ugo9nu2fu054ktsttnvqm.apps.googleusercontent.com`) with `http://localhost:4000/auth/google/callback` allowed. The AWS secret `patela/google-oauth-client-secret` exists at `arn:aws:secretsmanager:us-east-1:698251583462:secret:patela/google-oauth-client-secret-61qVZa` but has **no value yet**. The private, encrypted S3 artifact bucket `patela-api-artifacts-698251583462-use1` has been created, and the tested 25.9 MB ZIP is uploaded at `releases/patela-backend-5c3a9d4cbd0bfbac.zip` (SHA-256 `5c3a9d4cbd0bfbac5223682249e2b3db6e921bd8149b239bb89f88c6a78c492b`). The Google client secret must be placed in the AWS secret before deployment. After the stack returns `ApiOrigin`, add `https://<api-id>.execute-api.us-east-1.amazonaws.com/auth/google/callback` to the client's authorized redirect URIs. Google verifies the user; Patela owns its sessions and business data in PostgreSQL.

Build a deployment ZIP with `pwsh -NoProfile -File infra/package-backend.ps1`. The resulting `infra/artifacts/patela-backend.zip` is ignored by Git. It contains compiled JavaScript, migrations, and production dependencies. Do not commit OAuth secrets or database credentials. Store the Google client secret as a raw string in AWS Secrets Manager and supply only its ARN to CloudFormation; the template resolves both that secret and a generated PostgreSQL password from Secrets Manager. Configure the frontend to navigate to the API's `/auth/google/start` and send API requests with `credentials: "include"`.

Deployment order:

1. Create the Google OAuth Web client in `patela-oauth-20261113`. The ZIP is already uploaded to the private S3 artifact bucket.
2. Deploy `infra/backend-lambda.yaml` with `CodeBucket`, `CodeKey`, `GoogleClientId`, and `GoogleClientSecretArn` parameters. `PublicOrigin` may be blank for an API-only OAuth test; set it to the real HTTPS web origin when the frontend is deployed.
3. Read the stack's `ApiOrigin` output and allow `${ApiOrigin}/auth/google/callback` in Google Cloud's OAuth client redirect URIs. The Lambda derives this origin from API Gateway's request domain at cold start.
4. Invoke the stack's `MigrationFunctionName` once. It applies `001_core.sql`, `002_organizations.sql`, and `003_auth.sql` inside the private VPC.
5. Check `${ApiOrigin}/health`, then complete a real Google browser login. With blank `PublicOrigin`, the callback redirects to `${ApiOrigin}/auth/success`, which confirms the PostgreSQL session. Also check `${ApiOrigin}/me` with the session cookies, logout, and an expired-token refresh.

The template uses a development-sized RDS instance and a single NAT gateway. Before production use, add high availability, database connection management, request observability, backup restore exercises, and an email sender. OTP and business invitation messages currently remain in `email_outbox` and are not delivered.

The Google client is at [Google Auth Platform → Patela Backend](https://console.cloud.google.com/auth/clients/934939871903-vejm2a9gg95ugo9nu2fu054ktsttnvqm.apps.googleusercontent.com?project=patela-oauth-20261113). Google Cloud's current client details page does not offer a JSON download of existing secret values. Create a new client secret in a trusted local session and put its raw value directly into the existing AWS Secrets Manager secret; keep it out of Git and chat. There are currently two enabled Google client secrets: the original ending `Fjdw` and an extra unused one ending `RoRM` that an automation added by mistake. Deletion of `RoRM` was authorized but the automation could not access its row action. Remove only `RoRM` manually before creating another secret. After the API stack exists, add its HTTPS callback URI to the same Google client before attempting a live login.

Google does not document a CLI/API for creating the standard Google Auth Platform Web client used for Google account sign-in. `gcloud iam oauth-clients create` creates a different Workforce Identity Federation client for IAP/Looker; it cannot replace this credential. The AWS artifact bucket, ZIP upload, stack deploy, and migration invocation can all be done from the CLI once the standard Google client exists.
