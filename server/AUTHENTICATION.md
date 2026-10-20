# Venue authentication

This workflow belongs only to the independent Venue application and its
`VENUE_DB_NAME` database. It does not change the Clinic application.

## Configuration

Set `VENUE_GOOGLE_CLIENT_ID` on the API and the same OAuth client ID as
`VITE_VENUE_GOOGLE_CLIENT_ID` when building the client. Configure the authorized
JavaScript origins in Google Cloud for the actual frontend origins. The API
fails startup without a Google client ID. Existing transactional email
configuration remains available; authentication sends no email or OTP.

## Registration and login

`POST /api/auth/google/challenge` accepts only a `purpose` of `register`, `login`,
or `recover`. It issues a five-minute HttpOnly challenge cookie and returns a
nonce for Google Identity Services. `POST /api/auth/google` accepts only the
Google `credential`. Google's SDK verifies the signature, audience, issuer and
lifetime. The API additionally requires strict expiration, a verified email,
a matching nonce and an issue time within five minutes. The challenge is
consumed atomically; a credential cannot be replayed against a new challenge.

Registration issues a separate five-minute HttpOnly setup cookie. Only a hash
of the opaque authorization is stored in MongoDB. No user, login session, venue,
membership or subscription is created until password setup succeeds.
`GET /api/auth/google/password-setup` returns the purpose, email and expiration
for display. `POST` on the same route accepts only matching `password` and
`confirmPassword`, each subject to the bcrypt 72-byte input bound. Passwords
are hashed on the backend with bcrypt cost 12. A successful registration
creates an owner, establishes a session and sends the frontend to `/venues/new`.

Existing users may use `POST /api/auth/login` with their application password
or use Google with the `login` purpose. Google accounts are identified by
`sub` (stored as `googleId`), even when the Google email changes. Login does
not grant a venue membership or a paid hall subscription. Existing tenant,
role, feature and verified-payment access checks continue to apply.

## Password recovery and legacy accounts

The `recover` purpose looks up only the linked Google subject. It never falls
back to an email lookup and never creates an account. The setup authorization
binds the target user, Google subject and session version. Password replacement
uses an atomic conditional update, increments `tokenVersion`, revokes all older
sessions and invalidates outstanding setups. The frontend returns to login.
No body parameter can select a different user or email.

A matching email without a linked subject grants no login or password reset.
An explicit linking authorization can be issued through Google login. The user
must confirm their **existing application password** at
`POST /api/auth/google/link`. This proves both the current password and control
of the freshly verified Google identity for that same account email. One
password attempt consumes the linking authorization. Linking increments the
session version, preserves the existing account and memberships, and cannot
replace an existing Google subject.

If the legacy password is unavailable, self-service recovery is denied. There
is no email-match or administrative reset bypass. Support must obtain
independent ownership evidence before any separately reviewed, audited account
migration; matching email alone is insufficient. Previously unverified legacy
accounts cannot use password-only login, but can complete this same explicit
Google-plus-current-password linking flow without an OTP.

All Google, password login, setup, linking and challenge endpoints are rate
limited. Setup state survives frontend reloads through cookies; credentials and
authorizations never enter URLs, browser storage or router history. Expiration
is checked in queries independently of MongoDB TTL cleanup. Unique email and
Google-subject indexes prevent concurrent duplicate accounts.

## Removed flows and validation

The dependency review found OTP delivery used only by authentication services
and the old auth integration tests. Those services, validators, model fields,
routes, UI modes and the OTP secret requirement were removed. The Resend
dependency, production email configuration and general transactional sender
remain for booking, payment and subscription notifications. Existing stored
OTP fields are inert; no database-wide deletion or user migration runs.

Run `npm test` in `server` and `client`, plus `npm run lint`, `npm run build`
and `npm run test:e2e` in `client`. Backend authentication tests use locally signed
RSA tokens and stub only Google's certificate retrieval, exercising the real
Google verification SDK. Browser tests simulate Google UI/provider responses
only inside the disposable browser-test server. Live Google consent and
production OAuth-origin configuration require a separate deployment smoke test.
