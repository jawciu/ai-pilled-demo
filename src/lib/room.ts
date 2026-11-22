import type { Person } from './types';

export function roomProfiles(people: Person[], viewerId: string, query = ''): Person[] {
  const search = query.trim().toLowerCase();
  return people
    .filter(person => person.id !== viewerId && `${person.name} ${person.need} ${person.offer}`.toLowerCase().includes(search))
    .sort((a, b) => {
      const recent = (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0);
      return recent || a.name.localeCompare(b.name);
    });
}
