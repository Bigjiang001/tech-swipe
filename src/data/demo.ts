import type { Post, Category } from '../lib/types'
const examples:[string,Category,string,string,string,string][]=[
 ['当 AI 开始理解物理世界，智能的下一站在哪里？','AI','ai','世界模型','从识别图像到理解因果，世界模型让人工智能有机会建立对空间、运动和物理规律的内部表征。技术走向现实之前，我们也需要厘清评测、安全和数据边界。','https://deepmind.google/research/'],
 ['把计算带到轨道上：重新想象下一代基础设施','科技','tech','太空计算','如果将部分计算任务放到轨道，通信、能源和散热会带来哪些新问题？这个概念案例帮助我们观察工程约束如何影响一种技术的落地路径。','https://www.nasa.gov/technology/'],
 ['算力投资热潮之下，我们应该关注什么信号？','财经','finance','算力经济','阅读科技投资消息时，需要把资本支出、实际收入和长期回报分开。与其追逐一个宏大数字，不如先核对财报口径、时间区间和商业模式。','https://www.sec.gov/edgar/search/'],
 ['一座更友好的城市，如何被数据看见？','社会','society','公共空间','从无障碍路线到社区公共空间，城市的数字化不应只衡量效率。这个设计情景讨论居民参与、隐私保护，以及如何让看不见的需求进入决策。','https://unhabitat.org/'],
 ['数字档案让古老手稿拥有新的阅读方式','人文','culture','数字人文','高精度扫描与开放目录，让历史资料跨越地理边界。但数字化也需要保留原始语境、版权和出处，技术的便利不应抹去历史的复杂性。','https://www.loc.gov/collections/'],
 ['当算法进入画布，创作的边界向哪里延伸？','艺术','art','艺术与技术','生成式工具改变了草图和试验的成本，也让作者身份、训练许可和作品署名更受关注。艺术的价值，仍与创作者如何表达和选择息息相关。','https://www.metmuseum.org/art/collection'],
 ['端侧 AI：让智能走近每一台设备','AI','ai','端侧智能','把模型放进本地设备，能降低延迟，也可能减少敏感数据的传输。模型压缩、能耗和更新机制是理解这类产品时需要一起观察的三个维度。','https://ai.google.dev/edge'],
 ['更小的芯片，为什么需要更大的系统视角？','科技','tech','半导体','先进计算的进步不仅来自晶体管，也来自封装、存储和软件协同。这篇概念解读提供一个观察框架，帮助区分实验室指标与可交付的系统能力。','https://spectrum.ieee.org/semiconductors'],
 ['读懂一份财报，从区分事实和预期开始','财经','finance','阅读方法','营收、利润和现金流各自回答不同问题。对新兴技术公司的判断，应建立在可追溯的披露文件之上，同时保留对预测和风险的不确定性。','https://www.investor.gov/'],
 ['远程协作之后，我们如何重新设计工作？','社会','society','未来工作','协作工具降低了空间限制，却也带来注意力分散和沟通负担。这个情景从信息透明、异步沟通和工作边界三个方面，探索更可持续的工作方式。','https://www.ilo.org/'],
 ['GitHub 开源雷达：如何发现值得追踪的 AI 项目？','科技','tech','GitHub','这是开源项目观察的演示卡。正式模式会读取 GitHub 官方 API，展示近期活跃项目的公开指标、用途和许可证；累计星标不等于日增星标，也不是性能评测。','https://github.com/topics/artificial-intelligence'],
 ['Hugging Face 热门模型，热度之外应该看什么？','AI','ai','Hugging Face','这张演示卡介绍模型雷达的阅读方式：结合模型卡、任务类型、使用许可与平台指标做判断。下载量和喜欢数体现关注情况，不能直接代表能力、安全性或商用许可。','https://huggingface.co/models'],
 ['大模型升级观察：能力宣称，如何与证据对照？','AI','ai','模型升级','模型版本更新时，关注上下文、工具调用、多模态、价格与可用范围。正式报道会优先保留官方公告和模型卡，将厂商自测与独立评测分开，未证实的提升不作确定结论。','https://huggingface.co/docs/hub/model-cards'],
]
export const demoPosts:Post[]=examples.map(([title,category,cover,tag,summary,url],i)=>({
 content_kind:tag==='模型升级'?'model_update':tag==='GitHub'||tag==='Hugging Face'?'project':'news',id:`demo-${i+1}`,title,category,short_summary:summary,medium_summary:`【演示内容，非新闻报道】${summary} 阅读这一主题时，可以从三个问题出发：它试图解决什么具体问题，已有证据支持哪些结论，以及当前仍然存在哪些限制。这里展示的是阅读界面的内容层级，并不代表最近发生的事件，也不声称链接中的机构发布过这篇文章。`,
 full_content:`【演示说明】\n这是科技刷用于演示阅读体验的原创概念文章，不是实际新闻。文中的主题用于测试分类、搜索、收藏、私人笔记和分享，不代表任何机构的新闻发布。下方链接仅供主题参考阅读。\n\n从问题开始，而不是从结论开始\n${summary} 对一个快速发展的领域来说，理解背景往往比记住一句标题更有价值。我们可以先识别参与者、讨论的范围和明确的技术条件，再把事实、解释与预测分开。\n\n在证据与想象之间保留边界\n当你阅读真实报道时，请核对原始文件、发布日期和所使用的统计口径。单一案例并不一定说明普遍趋势，一项实验的成功也不意味着已经能够稳定交付。如果报道缺少关键细节，应当保留疑问，而不是用确定的语言填补空白。\n\n这对我们的意义\n科技刷希望提供一种更从容的信息消费方式：先在十五秒内理解主题，再用一分钟了解要点，最后根据兴趣深入阅读。你可以把自己的观察记在私人笔记中，随着更多证据出现，回来修正判断。正式接入新闻流水线后，只有通过服务端审核的内容才允许进入每日发布批次。`,
 key_points:['本卡为原创交互演示，不是实时新闻','来源链接为主题参考资料，不代表新闻出处','正式新闻需保留原始日期并通过核验'],
 source_name:'科技刷 · 概念编辑部',source_url:url,source_published_at:'2026-10-21T00:00:00Z',event_time:null,generated_at:'2026-10-21T00:00:00Z',published_at:new Date(Date.UTC(2026,9,21,0,0,0)-i*1000).toISOString(),tags:[tag,'演示'],image_path:null,image_url:`${import.meta.env.BASE_URL}covers/${cover}.svg`,image_attribution:'科技刷原创 SVG 概念插画 · 非新闻现场',is_ai_generated_image:false,verification_status:'pending',status:'published',pinned:false,origin:'demo'
}))
