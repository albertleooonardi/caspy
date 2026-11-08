export type Person = { id: string; name: string; avatar_url: string | null; at: number };
export type SocialOverview = {
  code: string;
  friends: Person[];
  incoming: Person[];
  outgoing: Person[];
  limits: { friends: number; outgoing: number };
};
export type SendResult = { status: 'pending' | 'accepted'; message: string };

// Same alphabet as the server: no 0/O or 1/I/L, so codes are easy to read aloud.
const ALLOWED = /[ABCDEFGHJKMNPQRSTUVWXYZ23456789]/;

/** Uppercases input, drops separators/unsupported characters and formats as XXXX-XXXX. */
export function formatFriendCode(input: string): string {
  const characters = [...input.toUpperCase()].filter(character => ALLOWED.test(character)).slice(0, 8);
  return characters.length > 4 ? `${characters.slice(0, 4).join('')}-${characters.slice(4).join('')}` : characters.join('');
}

export const isCompleteFriendCode = (input: string) => formatFriendCode(input).replace('-', '').length === 8;

/** Compact result of sorting friends by name regardless of case, without mutating the input. */
export const sortedByName = (people: Person[]) => [...people].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
