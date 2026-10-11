# India Climate Risk Tracker

District-level flood and drought risk for Assam, Bihar, Maharashtra and Rajasthan (2005 to 2025),
with email alerts. Three parts that share one data file:

    pipeline/   Python: builds the risk data          -> pipeline/data/risk_data.json
    src/        React (Vite): the map, charts, subscribe box
    backend/    Node.js on AWS Lambda: subscriptions + daily alert emails

    pipeline/data/risk_data.json --(npm run sync-data)--> src/data/districts.json      (React app)
                                                     \--> backend/src/data/districts.json (Lambda)

## 1. Run the app

    npm install
    npm run dev            # http://localhost:5173
    npm run build          # production build in dist/

The repo already contains `pipeline/data/risk_data.json`, so the app works straight away.

## 2. Rebuild the data (optional)

    cd pipeline
    pip install -r requirements.txt
    python build_risk_data.py --states Assam Bihar Maharashtra Rajasthan
    cd ..
    npm run sync-data

- Run the script from inside `pipeline/` (it reads and writes `./data`). Downloads are cached there,
  so you can stop and resume; Open-Meteo and NASA POWER have rate limits.
- `sync-data` converts the pipeline output for the app and backend. Flood values after 2021 are shown
  as "no data" because the flood sources stop there. Change it with `npm run sync-data -- --flood-end 2022`.
- River names the pipeline doesn't know are kept in `src/data/riverNames.json` (edit freely; sync only
  adds to it). River line shapes on the map are in `src/data/rivers.js`.

## 3. Email alerts (AWS)

How it works
- `POST /subscribe` saves a pending subscription and emails a confirmation link (double opt-in).
- `/confirm` and `/unsubscribe` handle the signed links in those emails.
- A daily job (07:00 IST) checks each subscribed district:
  - Flood districts: alert when the 5-day Open-Meteo forecast shows heavy rain (64.5 mm/day, IMD "heavy")
    or very heavy rain (115.6 mm/day). The same level is not re-sent for 72 hours.
  - Drought districts: one advisory per year when the monsoon starts (June).
- Stack: API Gateway + Lambda (Node.js 24), DynamoDB, Amazon SES, EventBridge Scheduler.

Deploy (region `ap-south-1` / Mumbai suggested)
1. In Amazon SES, verify the address you will send from. New SES accounts are in the sandbox, so also
   verify any address you want to test with, or request production access.
2. Make sure the backend has your latest data: `npm run sync-data`.
3. Install the AWS SAM CLI, then:

       cd backend
       sam build
       sam deploy --guided

   It asks for `SenderEmail`, `AllowedOrigin` (your site URL, no trailing slash) and `LinkSecret`
   (any random 32+ character string; changing it later invalidates old links).
4. Put the `ApiUrl` output in a `.env` file at the project root (see `.env.example`):

       VITE_API_URL=https://xxxx.execute-api.ap-south-1.amazonaws.com

5. `npm run build` and host `dist/` (S3 + CloudFront, or Amplify). Redeploy the backend with the real
   site URL as `AllowedOrigin` so browsers may call the API.

Test the backend locally (mocked AWS, no account needed)

    cd backend && npm install && npm test

## Notes
- Alerts combine a model forecast with a historical ranking. They are not official warnings; emails link to IMD and NDMA.
- Open-Meteo's free API is for non-commercial use.
- SMS in India needs DLT registration on SNS, so this version is email only.
- For a large subscriber list, replace the daily Scan with an index on `status`, and move the link
  secret to AWS Secrets Manager.
