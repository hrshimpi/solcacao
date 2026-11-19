# Deploying SolCacao on AWS

We put the website (the React client) on AWS Amplify Hosting, the API on one Amazon Lightsail instance behind Nginx with HTTPS, and the database on MongoDB Atlas. These steps are done by hand, in this order. Commands for our own computer are PowerShell (Windows). Commands for the server are bash (Ubuntu).

Words we use below:

- `API_HOSTNAME` is the name of the API, for example `your-name-api.duckdns.org`. We have no domain of our own, so we use a free DuckDNS name.
- `STATIC_IP` is the static IP of the Lightsail instance.
- `AMPLIFY_URL` is the address Amplify gives the website, like `https://main.xxxxxxxx.amplifyapp.com`.

How the pieces talk to each other: the browser only talks to Amplify. Amplify sends every `/api/...` request on to `https://API_HOSTNAME/api/...` (a rewrite rule we add in the console). So the browser sees one website, the login cookies stay first party, and the client needs no `VITE_API_URL`. The API only accepts changes from `AMPLIFY_URL` (`CLIENT_URL`).

Order of the work: AWS account, Atlas, Lightsail with its static IP, DuckDNS name, Amplify (the address is needed for the server settings), then the server.

## a. AWS account

1. Sign in to the AWS console and choose one region for everything (for example N. Virginia, `us-east-1`). Use the same region for Lightsail and, if Atlas offers it, for the Atlas cluster.
2. Billing, Budgets: create a small monthly budget (for example 10 USD) with an email alert.

## b. Atlas (database)

1. Create a free M0 cluster on AWS, in the same region if it is offered.
2. Database Access: add a database user with a password that has only letters and numbers. Give it read and write on any database.
3. Network Access: do not allow `0.0.0.0/0`. Add `STATIC_IP` after step c. Add your own current IP only while you work from your computer, and remove it afterwards.
4. Connect, Drivers: copy the connection string and write it like this (the database name `solcacao` goes after the host):
   `mongodb+srv://USER:PASSWORD@CLUSTER.xxxxx.mongodb.net/solcacao?retryWrites=true&w=majority`
   This is the value of `MONGODB_URI` in step g. Do not paste it into a chat or a file in the repository.

## c. Lightsail instance

1. Lightsail, Create instance. Region: the same one. Platform: Linux/Unix. Blueprint: OS only, Ubuntu LTS (24.04). Pick the smallest plan that has a public IPv4 address (a static IP cannot be attached to an IPv6 only instance). Name it `solcacao-api`.
2. Networking tab of the instance: create a static IP and attach it to the instance (it is free while attached). Write it down as `STATIC_IP`.
3. Same tab, IPv4 Firewall: keep SSH (22) and HTTP (80), and add HTTPS (443).
4. Atlas, Network Access: add `STATIC_IP` now.

## d. DNS name (DuckDNS)

1. Go to duckdns.org and sign in. Make a subdomain (for example `your-name-api`) and put `STATIC_IP` in the "current ip" box, then update.
2. The name is `API_HOSTNAME` (`your-name-api.duckdns.org`). Check it from your computer:
   ```powershell
   nslookup API_HOSTNAME
   ```
   The answer must show `STATIC_IP`. If DuckDNS does not work for you, any DNS service that lets you point an A record at an IP is fine. We did not test one other than DuckDNS.

## e. Amplify (the website)

We do this before the server so that `AMPLIFY_URL` is known when we write the server settings. The client does not need to know the API address, because Amplify forwards `/api`.

1. Build the client (from the `frontend` folder):
   ```powershell
   cd frontend
   pnpm install
   pnpm build
   ```
2. Make the zip. The files must be at the top level of the zip, not inside a folder:
   ```powershell
   cd dist
   tar -a -c -f ..\solcacao-client.zip (Get-ChildItem -Name)
   cd ..
   ```
   `tar -tf solcacao-client.zip` must list `index.html` first, without a folder name before it.
3. Amplify console, Create new app, Deploy without Git. Enter an app name (`solcacao`) and a branch name (`main`), drag `solcacao-client.zip` in and deploy.
4. Copy the address Amplify shows. That is `AMPLIFY_URL` (https, no trailing slash).
5. App settings, Rewrites and redirects, Manage redirects. Add these two rules, in this order (the first rule that matches wins):

   Rule 1, the API:
   - Source address: `/api/<*>`
   - Target address: `https://API_HOSTNAME/api/<*>`
   - Type: 200 (Rewrite)

   Rule 2, the pages of the website:
   - Source address: `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>`
   - Target address: `/index.html`
   - Type: 200 (Rewrite)

   The `public/_redirects` file in the project is not used by Amplify, we leave it as it is.

## Quick path with the AWS CLI (replaces the clicks in steps c and e)

The AWS CLI is faster than the console. Run these in PowerShell. `deploy/amplify-rules.json` holds the two Amplify rules of step e, with `API_HOSTNAME` as a placeholder. We checked the options of these commands against the CLI help, but did not run them against a real account.

Sign in once (the CLI version must be 2.32 or newer, check with `aws --version`), and use one region:

```powershell
aws login
aws configure set region us-east-1
aws sts get-caller-identity
```

If `aws login` does not work for your account, make an IAM user with an access key in the console and run `aws configure` (type the keys into the CLI, never into a chat).

Lightsail (step c). Check the names first, then create the instance, the static IP and the HTTPS port:

```powershell
aws lightsail get-blueprints --query "blueprints[?contains(blueprintId,'ubuntu')].[blueprintId,name]" --output table
aws lightsail get-bundles --query "bundles[].[bundleId,price,ramSizeInGb,supportedPlatforms[0]]" --output table
aws lightsail create-instances --instance-names solcacao-api --availability-zone us-east-1a --blueprint-id ubuntu_24_04 --bundle-id nano_3_0
aws lightsail allocate-static-ip --static-ip-name solcacao-api-ip
aws lightsail attach-static-ip --static-ip-name solcacao-api-ip --instance-name solcacao-api
aws lightsail open-instance-public-ports --instance-name solcacao-api --port-info fromPort=443,toPort=443,protocol=TCP
aws lightsail get-static-ip --static-ip-name solcacao-api-ip --query staticIp.ipAddress --output text
```

`ubuntu_24_04` and `nano_3_0` are the Ubuntu 24.04 blueprint and the smallest plan with a public IPv4 address. If the first two commands show other ids, use those. The last command prints `STATIC_IP`. Wait until `aws lightsail get-instance-state --instance-name solcacao-api` says `running` before the next command.

The key for ssh and scp:

```powershell
New-Item -ItemType Directory -Force $HOME\.ssh | Out-Null
$key = "$HOME\.ssh\lightsail-key.pem"
[IO.File]::WriteAllText($key, ((aws lightsail download-default-key-pair --query privateKeyBase64 --output text) -join "`n") + "`n")
icacls $key /inheritance:r
icacls $key /grant:r "$($env:USERNAME):(R)"
ssh -i $key ubuntu@STATIC_IP
```

Amplify (step e). Run it after the zip is built. The rules file gets the real hostname first:

```powershell
$app = aws amplify create-app --name solcacao --platform WEB --query app.appId --output text
aws amplify create-branch --app-id $app --branch-name main
$rules = "$env:TEMP\amplify-rules.json"
(Get-Content deploy\amplify-rules.json -Raw).Replace('API_HOSTNAME','YOUR_API_HOSTNAME') | Set-Content -Encoding ascii $rules
aws amplify update-app --app-id $app --custom-rules file://$rules
$job = aws amplify create-deployment --app-id $app --branch-name main | ConvertFrom-Json
curl.exe -T frontend\solcacao-client.zip $job.zipUploadUrl
aws amplify start-deployment --app-id $app --branch-name main --job-id $job.jobId
aws amplify get-job --app-id $app --branch-name main --job-id $job.jobId --query job.summary.status --output text
$domain = aws amplify get-app --app-id $app --query app.defaultDomain --output text
"https://main.$domain"
```

The status must become `SUCCEED`. The last line is `AMPLIFY_URL`. To update the site later, run only the lines from `create-deployment` down.

## f. The server: install the tools

Connect with the browser SSH button in Lightsail, or with `ssh -i KEYFILE ubuntu@STATIC_IP` (the key is under Account, SSH keys in Lightsail). Then:

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx
sudo npm install -g pm2 pnpm
node -v
mkdir -p ~/solcacao-api ~/solcacao-uploads
```

`node -v` must start with `v24`, the same as `engines.node` in `backend/package.json`.

## g. The server: the code and the settings

1. On our computer, build the API and pack the compiled folder and the package files. We never copy `node_modules` or `.env`:
   ```powershell
   cd backend
   pnpm install
   pnpm build
   tar -czf ..\solcacao-api.tar.gz dist package.json pnpm-lock.yaml
   cd ..
   scp -i KEYFILE solcacao-api.tar.gz deploy\nginx-api.conf deploy\ecosystem.config.cjs ubuntu@STATIC_IP:~/
   ```
2. On the server, unpack and install the production packages:
   ```bash
   cd ~/solcacao-api
   tar -xzf ~/solcacao-api.tar.gz
   pnpm install --prod --frozen-lockfile
   ```
   If the install is killed because the server runs out of memory, add a swap file and run it again:
   ```bash
   sudo fallocate -l 1G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```
3. Make the settings file and let only our user read it:
   ```bash
   nano ~/solcacao-api/.env
   chmod 600 ~/solcacao-api/.env
   ```
   Put these lines in it (the names are the same as in `backend/.env.example`). Make `JWT_SECRET` on the server with
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`:

   ```
   NODE_ENV=production
   PORT=4000
   MONGODB_URI=<the Atlas string from step b>
   JWT_SECRET=<the long random text>
   CLIENT_URL=<AMPLIFY_URL>
   UPLOAD_DIR=/home/ubuntu/solcacao-uploads
   MAIL_MODE=off
   ADMIN_EMAIL=<an email you can use>
   ADMIN_PASSWORD=<at least 10 characters, with a letter and a number>
   ```

   `TRUST_PROXY` is 1 by default in production. The largest upload is 5 files of 50 MB each. To change that, set `MAX_UPLOAD_MB` and `MAX_UPLOAD_FILES` here, and change `client_max_body_size` in Nginx to match.
4. Load the products and the admin account once (it is safe to run again, it prints counts only):
   ```bash
   cd ~/solcacao-api
   pnpm seed:built
   ```
   It should print `Products: 7 created, 0 updated.` and `Admin: 1 created.`

## h. The server: start the API with PM2

```bash
cd ~/solcacao-api
cp ~/ecosystem.config.cjs .
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

`pm2 startup` prints one command that starts with `sudo`. Copy that command, run it, then run `pm2 save` once more. Check the API from the server itself:

```bash
curl http://127.0.0.1:4000/api/health
```

The answer is `{"status":"ok","db":"connected"}`. If it says `disconnected`, look at step "Problems and fixes" (MongoServerSelectionError).

## i. The server: Nginx

```bash
sudo cp ~/nginx-api.conf /etc/nginx/sites-available/solcacao-api
sudo sed -i 's/API_HOSTNAME/YOUR_API_HOSTNAME/; s/API_PORT/4000/' /etc/nginx/sites-available/solcacao-api
sudo ln -s /etc/nginx/sites-available/solcacao-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Write your real hostname instead of `YOUR_API_HOSTNAME`. `nginx -t` must say the test is successful.

## j. The server: HTTPS

```bash
sudo certbot --nginx -d YOUR_API_HOSTNAME
sudo certbot renew --dry-run
```

Choose to redirect HTTP to HTTPS when Certbot asks. Then open `https://API_HOSTNAME/api/health` in a browser. It must show `{"status":"ok","db":"connected"}`.

## k. Test the live site

Open `AMPLIFY_URL` and check:

1. The shop shows 7 products.
2. Register a new account and sign in. Stay on the site for more than 15 minutes, or reload, and check that you are still signed in (this proves the refresh cookie travels through the Amplify rewrite).
3. Sign in with the admin account from `ADMIN_EMAIL`: the account page shows the dashboard link.
4. Register a business account, send a quote request in the studio with a small PDF or PNG file. It must be saved (this tests the Nginx upload limit).
5. Send the contact form.
6. Refresh the page on `/en/shop` (it must open the shop, not an error).
7. Switch the language to Spanish and back.
8. Add a product to the cart and place a test order with the card `4242 4242 4242 4242`.

If the login is lost after a reload, or the cart is empty after a refresh, the rewrite does not pass cookies. We could not confirm that from the Amplify documentation and did not test it from here. See "Problems and fixes".

## l. Updating later

Server (the code):

```powershell
cd backend
pnpm build
tar -czf ..\solcacao-api.tar.gz dist package.json pnpm-lock.yaml
scp -i KEYFILE ..\solcacao-api.tar.gz ubuntu@STATIC_IP:~/
```

```bash
cd ~/solcacao-api
tar -xzf ~/solcacao-api.tar.gz
pnpm install --prod --frozen-lockfile
pm2 restart solcacao-api
```

Client: build again, make a new zip (step e), then in the Amplify app choose Deploy updates and drag the new zip in.

## m. Email (optional)

`MAIL_MODE=off` only writes one line to the log for every email, and nothing fails. To send real email, set `MAIL_MODE=smtp` and `SMTP_HOST`, `SMTP_PORT` (587 or 465, never 25, AWS blocks it), `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM` in `.env`, then `pm2 restart solcacao-api --update-env`. Test it from the instance by sending the contact form and reading `pm2 logs solcacao-api`. We did not test SMTP from a Lightsail instance. If it fails there, tell us and we add an email API mode.

## n. Cost control

- The instance is billed by the hour until it is deleted. Stopping it does not stop the billing.
- After grading, delete the instance first, then the static IP (an unattached static IP is billed by the hour).
- Atlas free pauses a cluster after 30 days without connections.
- Remove your own IP from the Atlas access list when you are done.

## Problems and fixes

| Symptom | Likely cause and fix |
|---|---|
| A CORS error in the browser, or a 403 on a change ("That request came from a website we don't recognize.") | `CLIENT_URL` in `.env` is not exactly the Amplify address (https, no trailing slash, no path). Fix it, then `pm2 restart solcacao-api --update-env`. |
| The browser blocks the request because the API is not on HTTPS | The Amplify rewrite points at `http://`. The target must be `https://API_HOSTNAME/api/<*>`, and Certbot (step j) must have finished. |
| 404 on refresh of a page like `/en/shop` | The second Amplify rule (the single page app rewrite) is missing, or it is above the `/api` rule with a wrong source. Add it exactly as in step e. |
| 502 from Nginx | The API is not running or is on another port. Run `pm2 status` and `pm2 logs solcacao-api --lines 50`, and check that `PORT` in `.env` is the same as in the Nginx file. |
| 413 on upload | `client_max_body_size` in Nginx is too small. It must be above 250m for the default limits. Edit the file in `/etc/nginx/sites-available`, then `sudo nginx -t && sudo systemctl reload nginx`. |
| MongoServerSelectionError, or health says `"db":"disconnected"` | Atlas does not allow the IP. Add `STATIC_IP` in Atlas Network Access. Also check that the user and the password in `MONGODB_URI` are right and have no special characters. |
| The seed or the API says `mongodb+srv URI cannot have port number` | The Atlas password has a special character such as `#`, `@`, `:` or `/`. Use a password with only letters and numbers, or write the character in the connection string as its percent code (`#` is `%23`). |
| The shop is empty | The seed did not run. Run `pnpm seed:built` in `~/solcacao-api`, then reload the shop. |
| Email not arriving | `MAIL_MODE` is `off` (the default in production), or SMTP fails. Read `pm2 logs solcacao-api` for the "could not send email" line. Use port 587 or 465. |
| Certbot fails | The DNS name does not point at `STATIC_IP` yet (check with `nslookup`), or port 80 is closed in the Lightsail firewall, or the Nginx file still has the placeholder name. Fix, then run Certbot again. |
| The API is gone after a reboot | `pm2 startup` was not run, or `pm2 save` was not run after it. Run `pm2 startup`, run the command it prints, then `pm2 save`. |
| Login is lost after a reload, the cart is empty after a refresh | The cookies do not pass the Amplify rewrite. Open the browser developer tools, Network, and look at the `Set-Cookie` header of the login answer. Send us what you see. |
| The first request is slow or times out | Amplify rewrites stop waiting after about 30 seconds. The instance does not sleep, so check `pm2 logs` for a slow database call. |
