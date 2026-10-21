import {describe,it,expect} from 'vitest'
import {nextPublication,secureUrl,dateLabel} from '../src/lib/format'
describe('Timezone and source links',()=>{it('finds next Tokyo / Shanghai 08:00 independently of browser timezone',()=>{const n=new Date('2026-10-21T23:30:00Z');expect(nextPublication('Asia/Tokyo',n).toISOString()).toBe('2026-10-22T23:00:00.000Z');expect(nextPublication('Asia/Shanghai',n).toISOString()).toBe('2026-10-22T00:00:00.000Z')});it('rejects dangerous source URL schemes',()=>{expect(secureUrl('javascript:alert(1)')).toBe(false);expect(secureUrl('https://user:pass@example.com')).toBe(false);expect(secureUrl('https://www.nasa.gov/')).toBe(true)})})

it("displays planned publication in its configured timezone",()=>{const planned="2026-10-22T23:00:00Z";expect(dateLabel(planned,"Asia/Tokyo")).toContain("08:00");expect(dateLabel(planned,"Asia/Shanghai")).toContain("07:00")})
