import {describe,it,expect} from 'vitest'
import {infoImages} from '../src/lib/info-images'
describe('private information images',()=>{
 it('renders three factual text cards and identifies their nature',()=>{const images=infoImages('模型升级',['原始材料的第一条要点','第二条要点'],'官方出处');expect(images).toHaveLength(3);for(const image of images){const xml=decodeURIComponent(image.url.split(',')[1]!);expect(xml).toContain('非新闻现场照片');expect(xml).not.toContain('<script');}expect(decodeURIComponent(images[1]!.url)).toContain('第一条要点')})
 it('escapes hostile source text as text rather than SVG markup',()=>{const xml=decodeURIComponent(infoImages('<script>alert(1)</script>',['& " unsafe'],'source')[0]!.url);expect(xml).not.toContain('<script>');expect(xml).toContain('&lt;script&gt;')})
 it('does not invent a summary or unknown source',()=>{const images=infoImages('已知标题',[],'');expect(decodeURIComponent(images[1]!.url)).toContain('暂无可提取摘要');expect(decodeURIComponent(images[2]!.url)).toContain('来源尚未确定')})
})
