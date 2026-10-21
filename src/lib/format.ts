export const dateLabel = (value: string, timeZone?:string) => new Intl.DateTimeFormat('zh-CN', {timeZone,year:'numeric',timeZoneName:'short',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value))
export function secureUrl(value:string):boolean { try {const u=new URL(value); return u.protocol==='https:' && !u.username && !u.password} catch{return false} }
export function nextPublication(timezone:string, now=new Date()):Date {
 const parts = (d:Date) => Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(p=>[p.type,p.value]))
 const p=parts(now); const offset=Date.UTC(+p.year!,+p.month!-1,+p.day!,+p.hour!,+p.minute!)-Math.floor(now.getTime()/60000)*60000
 let next=new Date(Date.UTC(+p.year!,+p.month!-1,+p.day!,8)-offset)
 if(next<=now) next=new Date(next.getTime()+86400000)
 return next
}
