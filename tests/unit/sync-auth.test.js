import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatSyncError, isAuthCallbackUrl } from '../../src/db/sync.js'

describe('formatSyncError', () => {
  it('maps raw Postgres permission errors to a friendly sign-in key', () => {
    assert.equal(formatSyncError({ message: 'permission denied for function join_team_with_code' }), 'needSignIn')
    assert.equal(formatSyncError({ message: '42501' }), 'needSignIn')
    assert.equal(formatSyncError({ code: 'not_signed_in', message: 'not_signed_in' }), 'needSignIn')
  })
  it('maps join and editor code mistakes', () => {
    assert.equal(formatSyncError({ message: 'Unknown join code' }), 'unknownJoinCode')
    assert.equal(formatSyncError({ message: 'Unknown editor code' }), 'unknownEditorCode')
  })
  it('maps disabled anonymous sign-in', () => {
    assert.equal(formatSyncError({ message: 'Anonymous sign-ins are disabled' }), 'anonSignInOff')
  })
  it('never returns the raw Postgres text', () => {
    const key = formatSyncError(new Error('permission denied for function join_team_with_code'))
    assert.notEqual(key, 'permission denied for function join_team_with_code')
    assert.equal(key, 'needSignIn')
  })
})

describe('isAuthCallbackUrl', () => {
  it('detects magic-link hashes and ignores normal app routes', () => {
    assert.equal(isAuthCallbackUrl('https://diebeste.github.io/cupc-worship/#access_token=abc&type=magiclink'), true)
    assert.equal(isAuthCallbackUrl('https://diebeste.github.io/cupc-worship/#/settings'), false)
    assert.equal(isAuthCallbackUrl('https://diebeste.github.io/cupc-worship/?code=abc'), true)
  })
})
