import assert from 'node:assert/strict';
import test from 'node:test';
import { formatFriendCode, isCompleteFriendCode, sortedByName, type Person } from './social';

test('friend codes are uppercased, grouped and limited to eight readable characters', () => {
  assert.equal(formatFriendCode('abcd'), 'ABCD');
  assert.equal(formatFriendCode('abcd2345'), 'ABCD-2345');
  assert.equal(formatFriendCode(' abcd - 2345 extra'), 'ABCD-2345');
  assert.equal(formatFriendCode('ABCD-2345-ZZZZ'), 'ABCD-2345');
});

test('ambiguous characters are removed because the server never issues them', () => {
  assert.equal(formatFriendCode('0O1IL'), '');
  assert.equal(formatFriendCode('A0B1C2'), 'ABC2');
});

test('only complete codes can be submitted', () => {
  assert.equal(isCompleteFriendCode('ABCD-234'), false);
  assert.equal(isCompleteFriendCode('abcd2345'), true);
  assert.equal(isCompleteFriendCode(''), false);
});

test('sorting by name ignores case and leaves the original list unchanged', () => {
  const people: Person[] = [{ id: '1', name: 'zed', avatar_url: null, at: 1 }, { id: '2', name: 'Ada', avatar_url: null, at: 2 }, { id: '3', name: 'ben', avatar_url: null, at: 3 }];
  assert.deepEqual(sortedByName(people).map(person => person.name), ['Ada', 'ben', 'zed']);
  assert.equal(people[0].name, 'zed');
});
