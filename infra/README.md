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

`backend-lambda.yaml` is a separate stack for the Fastify API. It creates a private single-instance RDS PostgreSQL database, a Lambda HTTP API, a one-off migration Lambda, a VPC, and a NAT gateway so the Lambda can reach Google OAuth and other Google APIs. RDS and NAT incur recurring charges even while idle. The database has backups and deletion protection. This AWS account has a concurrency quota of 10 and does not permit reserved concurrency; API Gateway throttles the stage to 2 requests per second with a burst of 5, while each Lambda uses at most two PostgreSQL connections. Review RDS Proxy and the account quota before raising traffic substantially.

Both Lambda functions require verified TLS for RDS. They set `DATABASE_SSL=true` and `NODE_EXTRA_CA_CERTS=/var/runtime/ca-cert.pem` for the Node 22 runtime.

The template was validated with `aws cloudformation validate-template` in `us-east-1`. The Google Cloud project `patela-oauth-20261113` has a `Patela Backend` Web OAuth client (`934939871903-vejm2a9gg95ugo9nu2fu054ktsttnvqm.apps.googleusercontent.com`). The AWS secret `patela/google-oauth-client-secret` exists but has no value yet. The private, encrypted S3 artifact bucket is `patela-api-artifacts-698251583462-use1`. A client secret is optional for Google Identity Services ID-token sign-in; it is required only for the separate authorization-code flow. Google verifies the user; Patela owns its sessions and business data in PostgreSQL.

The development stack `patela-backend` is deployed at `https://g629knqcjc.execute-api.us-east-1.amazonaws.com`. Its migrations `001`–`003` applied successfully; `/health` returns 200. The Google test page loads and Google consent opens, but the end-to-end browser test is pending a device verification challenge on the test Google account. No authenticated Patela session has been confirmed yet. The smoke page is currently enabled for that test; disable it after sign-in succeeds.

Build a deployment ZIP with `pwsh -NoProfile -File infra/package-backend.ps1`. The resulting `infra/artifacts/patela-backend.zip` is ignored by Git. It contains compiled JavaScript, migrations, and production dependencies. Do not commit OAuth secrets or database credentials. When enabling the authorization-code flow, store its client secret as a raw string in AWS Secrets Manager and supply only its ARN to CloudFormation. The frontend can use Google Identity Services to obtain an ID token, then send it as JSON to `/auth/google/id-token` from the allowed origin. Send later API requests with `credentials: "include"` from a same-site frontend.

Deployment order:

1. Upload the built ZIP to the private S3 artifact bucket.
2. Deploy `infra/backend-lambda.yaml` with `CodeBucket`, `CodeKey`, and `GoogleClientId` parameters. Leave `GoogleClientSecretArn` empty for ID-token-only sign-in. Set `EnableAuthSmokePage=true` for the API-only live test and turn it off afterward. `PublicOrigin` may be blank for the API-only test; set it to the real HTTPS web origin when the frontend is deployed. Order and driver accept links are built from `PublicOrigin`, so the demo needs it set.

   For the two-handoff rehearsal (Celo Sepolia), also set:

   | Parameter | Value |
   |---|---|
   | `ChainId` | `11142220` (`42220` is Celo mainnet) |
   | `RpcUrl` | a Celo Sepolia HTTPS RPC |
   | `EscrowAddress` | `PatellaEscrowAndLogistics` from `contracts/deployments/celoSepolia.json`; canonical ZARm is selected automatically |
   | `ChainConfirmations` | blocks to wait before trusting an event (default `3`) |
   | `SmtpSecretArn` | ARN of a Secrets Manager secret you create, holding `{"user":"<gmail address>","appPassword":"<app password>"}`. The Gmail account needs 2-step verification. The stack grants the API function read access to that secret only. Blank keeps emails queued and unsent |
   | `DemoMode` | `true` only for the demo: API responses also carry the one-time accept links, in case an email is slow |

   The API function reaches Gmail (`smtp.gmail.com:465`), Secrets Manager and the RPC through the NAT gateway.
3. Read the stack's `ApiOrigin` output and add that origin to the Google client's Authorized JavaScript origins. The Lambda derives this origin from API Gateway's request domain at cold start. The authorization-code flow additionally needs `${ApiOrigin}/auth/google/callback` in Authorized redirect URIs.
4. Invoke the stack's `MigrationFunctionName` once. It applies any of `001_core.sql` to `004_two_handoff_orders.sql` not yet applied, inside the private VPC. `004` adds the two-handoff order tables. It also marks emails queued before delivery existed as failed, so enabling Gmail doesn't send that backlog.
5. Check `${ApiOrigin}/health`, then complete a real Google browser login at `${ApiOrigin}/auth/google/test`. The page exchanges Google's signed ID token for a Patela session and navigates to `${ApiOrigin}/auth/success`. Check `${ApiOrigin}/me` with the session cookies and logout. The smoke page is for development only.

The template uses a development-sized RDS instance and a single NAT gateway. Before production use, add high availability, database connection management, request observability, backup restore exercises, and a domain email sender such as Amazon SES. Gmail SMTP (`SmtpSecretArn`) is a demo choice: it may rate-limit or spam-folder automated mail. Without `SmtpSecretArn`, sign-in codes and invitations stay in `email_outbox` and are not delivered.

The Google client is at [Google Auth Platform → Patela Backend](https://console.cloud.google.com/auth/clients/934939871903-vejm2a9gg95ugo9nu2fu054ktsttnvqm.apps.googleusercontent.com?project=patela-oauth-20261113). Two enabled client secrets currently exist: the original ending `Fjdw` and an extra unused one ending `RoRM` that an automation added by mistake. Deletion of `RoRM` was authorized but the automation could not access its row action. Remove only `RoRM` manually. Neither secret is used by ID-token sign-in.

Google does not document a CLI/API for creating the standard Google Auth Platform Web client used for Google account sign-in. `gcloud iam oauth-clients create` creates a different Workforce Identity Federation client for IAP/Looker; it cannot replace this credential. The AWS artifact bucket, ZIP upload, stack deploy, and migration invocation can all be done from the CLI once the standard Google client exists.
