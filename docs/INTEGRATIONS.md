# Disha360 integrations and account recovery

## GroqCloud Free

Keep the existing MongoDB and frontend settings. In the existing Render service, choose
`AI_PROVIDER=groq`, `GROQ_MODEL=openai/gpt-oss-20b`, and set `GROQ_API_KEY`
privately from a **GroqCloud Free** project. Do not enable billing or put this key
in Vercel, Git, the browser, or a shared transcript. Verify the plan and the account's
remaining limits in the Groq dashboard. The app cannot determine the account plan
from the key. The [model list and limits](https://console.groq.com/docs/rate-limits)
may change.

The backend uses one credential and model for interview questions and feedback,
resume suggestions, and coding mentorship. It never silently falls back or
retries. The default allowance is 25 attempts per rolling day per running
instance, with three per minute and one at a time. `GROQ_DAILY_REQUEST_LIMIT`
can lower the allowance. These are app limits and reset on restart; Groq
enforces the actual account quota. AI advice does not execute or grade code.

With the same backend configuration injected securely, run
`npm run groq:check -w server` to check model access without generating text.
Then use a synthetic student account on a deployed instance to request one
non-sensitive question. Do not certify AI from the configuration status alone.

## Hackathons

The signed-in Hackathons page for students, trainers, and admins reads the
[Hack Club Hackathons API](https://hackathons.hackclub.com/data/), which focuses on
student-led events. The page shows active and upcoming events in the viewer's
time zone, links to organizer websites, and shows the last successful sync.
A visit refreshes a cache older than one hour. If the public feed fails, the
last successful in-memory snapshot can be shown for up to 24 hours. This
integration syncs listings, not accounts, registrations, or submissions.

## Recover an existing account

Existing passwords cannot be retrieved. An authorized database operator can
reset one identified account after deploying the code that checks account
session versions. Verify the user's identity before resetting their account.
Inject the existing `MONGODB_URI` privately from your approved environment,
then run the following in a private terminal. Do not use this command with the
production account until its identity and exact database have been confirmed.

```bash
export RECOVERY_DATABASE='existing-database-name'
export RECOVERY_EMAIL='confirmed-account-email'
export RECOVERY_ROLE='trainer' # or admin / student
bash -c 'read -r -s -p "New password: " pw; printf "\n"; RECOVERY_PASSWORD="$pw" npm run user:recover -- --apply'
unset RECOVERY_DATABASE RECOVERY_EMAIL RECOVERY_ROLE
```

The password is entered without echo, isn't written to a file, and must have
at least 12 characters with uppercase, lowercase, and a number. This updates the
existing account only if the exact email and role match a non-demo user. Old
sessions are invalidated. Convey the new password only through your approved
private credential channel. Do not bulk-reset or share staff passwords in chat.

## Hosted coding sandbox

The local Docker runner on `work` is development-only. Do not expose its socket
or worker to the public internet. A hosted sandbox is a separate release:
determine that the existing Vercel account is eligible for the
[Hobby Sandbox allowance](https://vercel.com/docs/sandbox/pricing), require
network-denied ephemeral isolation, and verify real execution and grading in all
four supported languages before enabling it. Keep paid OneCompiler and Render
Sandboxes disabled unless the cost constraint changes.
