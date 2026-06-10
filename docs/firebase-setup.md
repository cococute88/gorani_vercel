# Firebase setup

This app uses the Firebase **client SDK** only. It does not use Firebase Admin SDK, Cloud Functions, or server API routes for persistence.

## 1. Create a Firebase project

1. Open the Firebase Console.
2. Create a project for GORAFI/Gorani preview data.
3. Keep analytics optional.

## 2. Add a Web app

1. In Project settings, add a Web app.
2. Copy the Web app config values.
3. Put the values in `.env.local` for local development:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Do not commit `.env.local`. Commit only `.env.example`.

## 3. Enable Google Auth

1. Go to Authentication > Sign-in method.
2. Enable Google as a provider.
3. Add your local and Vercel domains to the authorized domains list.

## 4. Create Firestore

1. Go to Firestore Database.
2. Create a database.
3. Choose a region appropriate for your users.
4. Start with locked down rules, then apply this repository's `firestore.rules` in the Firebase Console.

The rules must be applied manually in Firebase Console or with your own deployment workflow. This PR does not deploy Firebase resources.

## 5. Configure Vercel Environment Variables

Add the same `NEXT_PUBLIC_FIREBASE_*` values to Vercel Project Settings > Environment Variables for Preview and Production.

## 6. Data scope and free plan guidance

The Spark free plan is appropriate only for lightweight user preference and preview persistence such as:

- Portfolio snapshots uploaded by the signed-in user
- Dividend calendar ticker preferences and event metadata
- Asset simulator input configs
- Calculator preset values

Do not use this Firestore setup to store large market price histories, external dividend feeds, yfinance/Polygon/Finnhub payloads, or exchange-rate datasets. Those integrations are intentionally out of scope for this persistence-only step.
