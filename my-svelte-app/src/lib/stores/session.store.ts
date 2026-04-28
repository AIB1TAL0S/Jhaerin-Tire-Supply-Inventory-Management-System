import { writable, derived } from 'svelte/store';
import { supabase } from '$lib/supabase';
import type { Session, Role } from '$lib/types';

/** Holds the current authenticated session, or null when logged out. */
export const sessionStore = writable<Session | null>(null);

/** Derived store exposing just the role for convenient role-guard checks. */
export const roleStore = derived<typeof sessionStore, Role | null>(
	sessionStore,
	($session) => $session?.role ?? null
);

/** Set to true when the session is cleared and the user should be sent to /login. */
export const shouldRedirectToLogin = writable<boolean>(false);

// Subscribe to Supabase auth state changes for silent token refresh and sign-out handling.
supabase.auth.onAuthStateChange((event, raw) => {
	if (event === 'SIGNED_OUT' || !raw) {
		sessionStore.set(null);
		shouldRedirectToLogin.set(true);
		return;
	}

	if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
		const meta = raw.user.user_metadata ?? {};
		const appMeta = raw.user.app_metadata ?? {};
		const role: Role = (meta.role ?? appMeta.role ?? 'staff') as Role;

		sessionStore.set({
			userId: raw.user.id,
			email: raw.user.email ?? '',
			role,
			accessToken: raw.access_token,
			refreshToken: raw.refresh_token ?? '',
			expiresAt: raw.expires_at ?? 0
		});
		shouldRedirectToLogin.set(false);
	}
});
