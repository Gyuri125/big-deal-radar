import { describe, expect, it } from 'vitest';
import {
  classifyLinkStatus,
  summarizeLinkStatuses,
} from '../src/utils/link-status';

describe('link státusz osztályozás', () => {
  it('megkülönbözteti az OK, botblokk, HTTP-hiba és elérhetetlen linkeket', () => {
    expect(classifyLinkStatus(200)).toBe('ok');
    expect(classifyLinkStatus(301)).toBe('ok');
    expect(classifyLinkStatus(403)).toBe('blocked');
    expect(classifyLinkStatus(429)).toBe('blocked');
    expect(classifyLinkStatus(521)).toBe('blocked');
    expect(classifyLinkStatus(404)).toBe('failed');
    expect(classifyLinkStatus(500)).toBe('failed');
    expect(classifyLinkStatus('ERR')).toBe('unreachable');
  });

  it('összesíti a státuszokat', () => {
    expect(summarizeLinkStatuses([200, 301, 403, 404, 'ERR'])).toEqual({
      ok: 2,
      blocked: 1,
      failed: 1,
      unreachable: 1,
    });
  });
});
