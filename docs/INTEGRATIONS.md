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
resume suggestions, coding mentorship, and optional assessment study plans. It never silently falls back or
retries. The default allowance is 25 attempts per rolling day per running
instance, with three per minute and one at a time. `GROQ_DAILY_REQUEST_LIMIT`
can lower the allowance. These are app limits and reset on restart; Groq
enforces the actual account quota. AI advice does not execute or grade code.
Students can request a study plan under **Workspace → Performance analytics**
after finishing an assessment. Only aggregate counts and accuracy by category
are sent after consent; there are no questions, answers, identifiers, or peer
data in that request. AI feedback never changes a grade.

With the same backend configuration injected securely, run
`npm run groq:check -w server` to check model access without generating text.
Then use a synthetic student account on a deployed instance to request one
non-sensitive question. Do not certify AI from the configuration status alone.

## Hackathons

Signed-in students can open **Workspace → Hackathons** at
`/workspace/hackathons`. The page and its API are restricted to students. Listings
come from the [Hack Club Hackathons API](https://hackathons.hackclub.com/data/),
which focuses on student-led events. The page shows active and upcoming events in the viewer's
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

## Coding practice on Render

Set `CODING_EXECUTION_PROVIDER=javascript` on the existing Render service for
JavaScript Run and Submit without another service, key, or execution credits.
Set `ONECOMPILER_ENABLED=false` if it is no longer used. Leave the GroqCloud
settings alone; Coding Mentor is independent of execution and grading.
`disabled` still turns off Run and Submit. In production, `auto` uses the
built-in runner if no credentialed OneCompiler or confirmed Judge0 is configured.

The runner uses QuickJS compiled to WebAssembly in a bounded worker. Each test
gets a fresh guest that receives only its source and standard input. It has no
host filesystem, network, Node process, or module access. The template's
`require("fs").readFileSync(0, "utf8")` is a guest-only input shim.
Use `console.log` for output. Run uses custom input. Submit uses server-side
hidden tests and saves the judged result. The runner accepts one job at a time.

Startup inserts three published starter challenges if their keys are absent:
Sum two integers, Reverse a word, and Longest increasing subsequence. It does not
overwrite or re-publish existing records and does not run development seeds.

Python, Java, and C++ can still be edited and saved. Public execution of those
languages requires a separately configured isolated provider; the local Docker
runner remains development-only.
