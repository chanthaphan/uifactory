import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIp } from '../src/common/safe-url';

test('flags private / loopback / reserved IPv4 ranges', () => {
  for (const ip of ['10.0.0.1', '127.0.0.1', '192.168.1.1', '169.254.169.254', '172.16.0.1', '100.64.0.1', '0.0.0.0']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
});

test('allows public IPv4', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '93.184.216.34']) {
    assert.equal(isPrivateIp(ip), false, ip);
  }
});

test('handles IPv6 loopback/ULA/link-local and IPv4-mapped', () => {
  assert.equal(isPrivateIp('::1'), true);
  assert.equal(isPrivateIp('fc00::1'), true);
  assert.equal(isPrivateIp('fe80::1'), true);
  assert.equal(isPrivateIp('::ffff:10.0.0.1'), true);
  assert.equal(isPrivateIp('2001:4860:4860::8888'), false);
});
