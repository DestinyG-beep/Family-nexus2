import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { hasSupabaseConfig, requireSupabase, supabase } from '../lib/supabase';

export type ProfileRecord = {
  id: string;
  name: string | null;
  email: string | null;
  phone_number: string | null;
  residence: string | null;
  avatar_media_id: string | null;
  profile_completed: boolean | null;
  username: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

type AuthContextValue = {
  session: SessionUser | null;
  profile: ProfileRecord | null;
  isLoading: boolean;
  isProfileComplete: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  updateProfile: (input: {
    name?: string;
    email?: string | null;
    phone_number?: string | null;
    residence?: string | null;
    avatar_media_id?: string | null;
  }) => Promise<ProfileRecord>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<ProfileRecord | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return (data as ProfileRecord | null) ?? null;
}

async function ensureProfileRecord(userId: string, fallbackName?: string, email?: string | null) {
  const client = requireSupabase();
  const existing = await fetchProfile(userId);

  if (existing) {
    return existing;
  }

  const profilePayload = {
    id: userId,
    name: fallbackName?.trim() || 'Family member',
    email: email ?? null,
    profile_completed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client.from('profiles').insert(profilePayload).select('*').single();

  if (error) {
    throw error;
  }

  return data as ProfileRecord;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncAuthState = async () => {
    if (!hasSupabaseConfig || !supabase) {
      setSession(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw sessionError;
    }

    const active = sessionData.session?.user;
    if (!active) {
      setSession(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    const nextProfile = await ensureProfileRecord(active.id, active.user_metadata?.name, active.email ?? null).catch(() => fetchProfile(active.id));
    const nextSession: SessionUser = {
      id: active.id,
      email: active.email ?? '',
      name: nextProfile?.name ?? active.user_metadata?.name ?? 'Family member',
    };

    setSession(nextSession);
    setProfile(nextProfile);
    setIsLoading(false);
  };

  useEffect(() => {
    void syncAuthState();

    if (!supabase) {
      return undefined;
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!nextSession?.user) {
        setSession(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      const nextProfile = await ensureProfileRecord(nextSession.user.id, nextSession.user.user_metadata?.name, nextSession.user.email ?? null).catch(() => fetchProfile(nextSession.user.id));
      setSession({
        id: nextSession.user.id,
        email: nextSession.user.email ?? '',
        name: nextProfile?.name ?? nextSession.user.user_metadata?.name ?? 'Family member',
      });
      setProfile(nextProfile);
      setIsLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      throw new Error(error?.message ?? 'Unable to sign in.');
    }

    const nextProfile = await ensureProfileRecord(data.user.id, data.user.user_metadata?.name, data.user.email ?? email);
    setSession({
      id: data.user.id,
      email: data.user.email ?? email,
      name: nextProfile?.name ?? data.user.user_metadata?.name ?? 'Family member',
    });
    setProfile(nextProfile);
  };

  const signUp = async (name: string, email: string, password: string) => {
    const client = requireSupabase();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error || !data.user) {
      throw new Error(error?.message ?? 'Unable to create account.');
    }

    const nextProfile = await ensureProfileRecord(data.user.id, name, data.user.email ?? email);
    setSession({
      id: data.user.id,
      email: data.user.email ?? email,
      name: nextProfile?.name ?? name,
    });
    setProfile(nextProfile);
  };

  const updateProfile = async (input: {
    name?: string;
    email?: string | null;
    phone_number?: string | null;
    residence?: string | null;
    avatar_media_id?: string | null;
  }) => {
    const client = requireSupabase();
    const currentUser = session ?? (await client.auth.getUser()).data.user;

    if (!currentUser) {
      throw new Error('Authentication required to update profile.');
    }

    const payload = {
      id: currentUser.id,
      name: input.name ?? profile?.name ?? '',
      email: input.email ?? profile?.email ?? currentUser.email,
      phone_number: input.phone_number ?? profile?.phone_number ?? null,
      residence: input.residence ?? profile?.residence ?? null,
      avatar_media_id: input.avatar_media_id ?? profile?.avatar_media_id ?? null,
      profile_completed: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client.from('profiles').upsert(payload).select('*').single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Unable to save profile.');
    }

    const nextProfile = data as ProfileRecord;
    setProfile(nextProfile);
    setSession((current) =>
      current
        ? {
            ...current,
            name: nextProfile.name ?? current.name,
            email: nextProfile.email ?? current.email,
          }
        : current
    );

    return nextProfile;
  };

  const signOut = async () => {
    if (!supabase) {
      throw new Error('Supabase is not configured.');
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }

    setSession(null);
    setProfile(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      isLoading,
      isProfileComplete: !!profile?.name && profile.name.trim().length > 0,
      signIn,
      signUp,
      updateProfile,
      signOut,
    }),
    [session, profile, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return ctx;
}
