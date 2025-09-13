// src/debug.ts (temporary helper so you can trigger OAuth from the console)
import { signInWithGoogle } from './lib/oauth';
// @ts-ignore
(window as any)._connectGoogle = () => signInWithGoogle();
console.log('[debug] Type window._connectGoogle() to start Google OAuth');
