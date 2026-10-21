export const categories = ['科技','AI','财经','社会','人文','艺术'] as const
export type Category = typeof categories[number]
export interface Post {
 content_kind?:'news'|'project'|'model_update';
 id: string; title: string; category: Category; short_summary: string; medium_summary: string; full_content: string; key_points: string[];
 source_name: string; source_url: string; source_published_at: string; event_time: string | null; generated_at: string; published_at: string | null;
 tags: string[]; image_path: string | null; image_url?: string | null; image_attribution: string; is_ai_generated_image: boolean;
 verification_status: 'pending'|'verified'|'rejected'; status: 'draft'|'queued'|'published'; pinned: boolean; origin: 'agent'|'manual'|'demo';
 related_sources?: {name:string;url:string}[]
}
export interface Note {id:string; post_id:string; body:string; created_at:string}
export interface Follow {kind:'category'|'source'|'keyword'; value:string}
export interface Settings {timezone:string; daily_target:number; auto_publish:boolean; agent_enabled:boolean}
export interface AgentJob {id:string; kind:string; status:string; created_at:string; error:string|null; result:Record<string, unknown>|null}
export interface NewsSource {id:string;name:string;url:string;category:Category;enabled:boolean;license_note:string;last_fetched_at:string|null}
