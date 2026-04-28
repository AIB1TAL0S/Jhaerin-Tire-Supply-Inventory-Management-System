import { supabase } from '$lib/supabase';
import { sessionStore, shouldRedirectToLogin } from '$lib/stores/session.store';
import type { Session, Role } from '$lib/types';

export interface AuthService {
	login(email: string, password: string): Promise<Session>;
	logout(): Promise<void>;
	refreshSession(): Promise<Session>;
	getSession(): Session | null;
	getRole(): Role | null;
}

function mapSupabaseSession(raw: import('@supabase/supabase-js').Session): Session {
	const meta = raw.user.user_metadata ?? {};
	const appMeta = raw.user.app_metadata ?? {};
	const role: Role = (meta.role ?? appMeta.role ?? 'staff') as Role;

	return {
		userId: raw.user.id,
		email: raw.user.email ?? '',
		role,
		accessToken: raw.access_token,
		refreshToken: raw.refresh_token ?? '',
		expiresAt: raw.expires_at ?? 0
	};
}

class AuthServiceImpl implements AuthService {
	private _session: Session | null = null;

	constructor() {
		// Keep internal cache in sync with the store
		sessionStore.subscribe((s) => {
			this._session = s;
		});
	}

	async login(email: string, password: string): Promise<Session> {
		const { data, error } = await supabase.auth.signInWithPassword({ email, password });
		if (error || !data.session) {
			throw new Error(error?.message ?? 'Login failed');
		}
		const session = mapSupabaseSession(data.session);
		sessionStore.set(session);
		shouldRedirectToLogin.set(false);
		return session;
	}

	async logout(): Promise<void> {
		await supabase.auth.signOut();
		sessionStore.set(null);
		shouldRedirectToLogin.set(true);
	}

	async refreshSession(): Promise<Session> {
		const { data, error } = await supabase.auth.refreshSession();
		if (error || !data.session) {
			sessionStore.set(null);
			shouldRedirectToLogin.set(true);
			throw new Error(error?.message ?? 'Session refresh failed');
		}
		const session = mapSupabaseSession(data.session);
		sessionStore.set(session);
		return session;
	}

	getSession(): Session | null {
		return this._session;
	}

	getRole(): Role | null {
		return this._session?.role ?? null;
	}
}

export const authService: AuthService = new AuthServiceImpl();
