import { requireSupabase } from './supabase';

export type CalendarEvent = {
  id: string;
  family_id: string;
  created_by: string;
  name: string;
  start_at: string | null;
  location_name: string | null;
  map_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  family_name: string;
};

type EventQueryRow = Omit<CalendarEvent, 'family_name'> & {
  families: { name: string } | { name: string }[] | null;
};

function mapEvent(row: EventQueryRow): CalendarEvent {
  const family = Array.isArray(row.families) ? row.families[0] : row.families;
  return { ...row, family_name: family?.name ?? 'Family' };
}

function readableError(error: { message?: string } | null, fallback: string) {
  return error?.message ? `${fallback} ${error.message}` : fallback;
}

export async function listCalendarEvents(familyIds: string[]) {
  if (familyIds.length === 0) return [];

  const { data, error } = await requireSupabase()
    .from('events')
    .select('id, family_id, created_by, name, start_at, location_name, map_url, created_at, updated_at, deleted_at, families(name)')
    .in('family_id', familyIds)
    .is('deleted_at', null)
    .order('start_at', { ascending: true, nullsFirst: false });

  if (error) throw new Error(readableError(error, 'Events could not be loaded.'));
  return ((data ?? []) as unknown as EventQueryRow[]).map(mapEvent);
}

export async function createCalendarEvent(input: {
  familyId: string;
  name: string;
  startAt?: string | null;
  locationName?: string | null;
  mapUrl?: string | null;
}) {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error('Authentication is required to create an event.');

  const { data, error } = await client
    .from('events')
    .insert({
      family_id: input.familyId,
      created_by: userData.user.id,
      name: input.name.trim(),
      start_at: input.startAt ?? null,
      location_name: input.locationName?.trim() || null,
      map_url: input.mapUrl?.trim() || null,
    })
    .select('id, family_id, created_by, name, start_at, location_name, map_url, created_at, updated_at, deleted_at, families(name)')
    .single();

  if (error || !data) throw new Error(readableError(error, 'The event could not be created.'));
  return mapEvent(data as unknown as EventQueryRow);
}

export async function updateCalendarEvent(input: {
  id: string;
  name: string;
  startAt?: string | null;
  locationName?: string | null;
  mapUrl?: string | null;
}) {
  const { data, error } = await requireSupabase()
    .from('events')
    .update({
      name: input.name.trim(),
      start_at: input.startAt ?? null,
      location_name: input.locationName?.trim() || null,
      map_url: input.mapUrl?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .is('deleted_at', null)
    .select('id, family_id, created_by, name, start_at, location_name, map_url, created_at, updated_at, deleted_at, families(name)')
    .single();

  if (error || !data) throw new Error(readableError(error, 'The event could not be updated.'));
  return mapEvent(data as unknown as EventQueryRow);
}

export async function deleteCalendarEvent(eventId: string) {
  const { error } = await requireSupabase()
    .from('events')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', eventId)
    .is('deleted_at', null);

  if (error) throw new Error(readableError(error, 'The event could not be deleted.'));
}