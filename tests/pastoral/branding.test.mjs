import test from 'node:test';
import assert from 'node:assert/strict';
import { getBranding, publicPageMetadata } from '../../src/lib/branding.ts';

test('unconfigured installs have 45 branding without an invented origin or contact', () => {
  const branding = getBranding({});
  assert.equal(branding.appName, '삼덕사오');
  assert.equal(branding.communityName, '삼덕교회 45공동체');
  assert.equal(branding.supportEmail, undefined);
  assert.deepEqual(publicPageMetadata('/about', {}), {});
  assert.deepEqual(publicPageMetadata('/privacy', {}), {});
});

test('public canonical metadata uses this installation origin and accepts either URL setting', () => {
  assert.equal(publicPageMetadata('/about', { PUBLIC_APP_URL: 'https://community45.example/' }).alternates.canonical, 'https://community45.example/about');
  assert.equal(publicPageMetadata('/privacy', { NEXT_PUBLIC_APP_URL: 'https://community45.example' }).alternates.canonical, 'https://community45.example/privacy');
  assert.equal(getBranding({ PUBLIC_APP_URL: 'https://primary.example', NEXT_PUBLIC_APP_URL: 'https://secondary.example' }).appOrigin, 'https://primary.example');
});

test('invalid configured origins fail instead of publishing a misleading canonical', () => {
  for (const PUBLIC_APP_URL of ['http://community45.example', 'https://u:p@community45.example', 'https://community45.example:444', 'https://community45.example/about', 'https://community45.example/?key=value', 'https://community45.example/#fragment', 'invalid']) {
    assert.throws(() => getBranding({ PUBLIC_APP_URL }));
  }
});

test('support email is optional, configurable and rejects malformed mailto destinations', () => {
  assert.equal(getBranding({ SUPPORT_EMAIL: ' care+45@example.org ' }).supportEmail, 'care+45@example.org');
  for (const SUPPORT_EMAIL of ['not-an-email', 'care@example.org?subject=extra', 'care@example.org\r\nBcc:other@example.org']) assert.throws(() => getBranding({ SUPPORT_EMAIL }));
});
