# Auth redirects — the settings that are not in this repo

Password reset and the invite mails the Stripe webhook sends both leave the app,
go through Supabase, and come back. Where they come back to is configured in the
Supabase dashboard, **not** here — so it can be wrong while every test in this
repo passes, and it was.

## The failure this file exists to prevent

Reset hasła appeared to do nothing. The mail arrived; the link in it pointed at
`http://localhost:3000`, which is the Site URL Supabase ships with and nobody
had changed. On a phone that address is nothing at all.

`resetPasswordForEmail` was being called with no `redirectTo`, so it fell back
to that Site URL every time. It now passes `window.location.origin`, which fixes
the common case — but only if the origin is on the allow list below, because
Supabase silently falls back to the Site URL for any redirect it does not
recognise. Both halves are required.

## Required dashboard settings

**Authentication → URL Configuration**

| Setting | Value |
|---|---|
| Site URL | `https://projectenglishapp.netlify.app` |
| Redirect URLs | `https://projectenglishapp.netlify.app/**` |
| | `https://*--projectenglishapp.netlify.app/**` (deploy previews) |
| | `http://localhost:5173/**` (vite dev) |
| | `http://localhost:8888/**` (netlify dev, matches APP_URL) |

The `/**` wildcard is needed: the app redirects to `/konto?reset=1`, and a bare
origin entry does not match a path.

## How to check it without sending a mail

`admin.generateLink` returns the URL the mail would contain, and sends nothing:

```js
const { data } = await sb.auth.admin.generateLink({ type: 'recovery', email })
console.log(new URL(data.properties.action_link).searchParams.get('redirect_to'))
```

If that prints `http://localhost:3000`, the Site URL is still the default and
every reset mail in production is dead on arrival.

## Where the return is handled

There is no callback route. `supabase-js` picks the session out of the URL on
load (`detectSessionInUrl`, on by default), so the recovery link lands the user
logged in. That is the trap: logged in is not the same as told what to do, and
without `?reset=1` they arrive on an ordinary account page with the password
form collapsed. `LoginPage` adds the flag; `AccountPage` opens the form and
changes the hint when it sees it, and clears it once the password is set.

## Adjacent

The Stripe webhook creates anonymous buyers with `inviteUserByEmail` and its own
`redirectTo` (`${APP_URL}/konto?checkout=success&anon=1`) — see
`netlify/functions/_lib/reconcile.ts`. `APP_URL` is a Netlify env var, and the
same allow list governs it.

Note also that the app offers **email + password only** — no magic link, no
OAuth. An invite or recovery link is therefore the only way a user without a
password ever gets one.
