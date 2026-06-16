import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const auth = read('lib/firebase/auth.ts');
const loginButton = read('components/auth/LoginButton.tsx');
const packageJson = read('package.json');

assert.ok(auth.includes('browserLocalPersistence'), 'auth must use browserLocalPersistence');
assert.ok(auth.includes('setPersistence(firebaseAuth, browserLocalPersistence)'), 'auth must explicitly set local persistence');
assert.ok(auth.includes('getRedirectResult(auth)'), 'auth startup must handle Google redirect results');
assert.ok(auth.includes('onAuthStateChanged(firebaseAuth'), 'auth state listener must remain the source of truth');
assert.ok(auth.includes('isMobileBrowser()') && auth.includes('signInWithRedirect(firebaseAuth, provider)'), 'mobile browsers must use redirect sign-in');
assert.ok(auth.includes('isPopupBlockedError(err)') && auth.includes('Google redirect fallback failed'), 'popup failure path must fall back to redirect');
assert.ok(auth.includes('credential.user') && auth.includes('ensureUserProfile(credential.user)'), 'popup success should hydrate the user profile immediately');
assert.ok(auth.includes('authStateResolved') && auth.includes('redirectResolved') && auth.includes('finishHydration()'), 'loading must wait for both redirect handling and auth hydration');
assert.ok(loginButton.includes('const signedIn = Boolean(user)') && loginButton.includes('const label = signedIn ? "Logout"'), 'LoginButton must render Logout from auth user state');
assert.ok(loginButton.includes('onClick={signedIn ? logout : signInWithGoogle}'), 'LoginButton must keep logout click path');
assert.ok(packageJson.includes('check:auth-mobile-login-persistence'), 'package script must expose auth mobile regression check');
assert.ok(!existsSync('firestore.rules') || !read('firestore.rules').includes('AUTH-MOBILE-LOGIN-AND-DIVCAP-AXIS-FIX-1'), 'Firebase rules must not be edited for this fix');

console.log('auth mobile login persistence checks passed');
