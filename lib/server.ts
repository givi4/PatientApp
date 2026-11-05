import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import type { NextRequest } from 'next/server';

export const DEFAULT_THERAPISTS=[
  {id:'dav-eradze',name:'დავით ერაძე',specialty:'ფსიქოლოგი'},
  {id:'ana-bubuteishvili',name:'ანანო ბუბუტეიშვილი',specialty:'ფსიქოლოგი'},
  {id:'givi-makharadze',name:'გივი მახარაძე',specialty:'ფსიქოლოგი'},
  {id:'keti-vardiashvili',name:'ქეთი ვარდიაშვილი',specialty:'ფსიქიატრი'},
];
export const database=()=>{if(!env.DB)throw Error('DB მიუწვდომელია');return env.DB;};
const secret=()=>{const s=(env as unknown as {PORTAL_SECRET?:string}).PORTAL_SECRET;if(!s)throw Error('სერვერის უსაფრთხოების გასაღები არ არის გამართული');return s;};
const bytes=(s:string)=>new TextEncoder().encode(s);
function encode(s:string){return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}
function decode(s:string){return atob(s.replace(/-/g,'+').replace(/_/g,'/'));}
async function hmac(text:string){const key=await crypto.subtle.importKey('raw',bytes(secret()),{name:'HMAC',hash:'SHA-256'},false,['sign']);const mac=await crypto.subtle.sign('HMAC',key,bytes(text));return Array.from(new Uint8Array(mac)).map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function hashPin(pin:string,salt:string){const base=await crypto.subtle.importKey('raw',bytes(pin),'PBKDF2',false,['deriveBits']);const derived=await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes(salt),iterations:120000,hash:'SHA-256'},base,256);return Array.from(new Uint8Array(derived)).map(x=>x.toString(16).padStart(2,'0')).join('');}
export const validPin=(s:unknown)=>typeof s==='string'&&/^\d{4}$/.test(s);
export const iso=()=>new Date().toISOString();
export const row=async<T=Record<string,unknown>>(sql:string,...params:unknown[])=>database().prepare(sql).bind(...params).first<T>();
export const rows=async<T=Record<string,unknown>>(sql:string,...params:unknown[])=>{const x=await database().prepare(sql).bind(...params).all<T>();return x.results||[];};
export const run=(sql:string,...params:unknown[])=>database().prepare(sql).bind(...params).run();
export type Session={therapistId:string;userId:string};
export async function session(req:NextRequest):Promise<Session|null>{
 const user=await getChatGPTUser();const raw=req.cookies.get('portal_access')?.value;
 if(!user||!raw)return null;
 const [payload,mac]=raw.split('.');if(!payload||!mac)return null;
 const expected=await hmac(payload);if(mac.length!==expected.length)return null;
 let diff=0;for(let i=0;i<mac.length;i++)diff|=mac.charCodeAt(i)^expected.charCodeAt(i);if(diff)return null;
 try{const data=JSON.parse(decode(payload));if(data.userId!==user.userId||Date.now()>data.exp)return null;
  const therapist=await row<{owner_user_id:string}>('SELECT owner_user_id FROM therapists WHERE id=?',data.therapistId);
  if(!therapist||therapist.owner_user_id!==user.userId)return null;
  return {userId:user.userId,therapistId:data.therapistId};
 }catch{return null;}
}
export async function setSessionCookie(therapistId:string,userId:string){
 const payload=encode(JSON.stringify({therapistId,userId,exp:Date.now()+30*60*1000}));
 return `${payload}.${await hmac(payload)}`;
}
export async function verifyPin(therapistId:string,userId:string,pin:string){
 const therapist=await row<{pin_hash:string;pin_salt:string;owner_user_id:string}>('SELECT pin_hash,pin_salt,owner_user_id FROM therapists WHERE id=?',therapistId);
 if(!therapist||therapist.owner_user_id!==userId||!therapist.pin_hash)throw Error('წვდომა შეზღუდულია');
 const key=`${therapistId}:${userId}`;
 const attempt=await row<{failures:number;locked_until:number}>('SELECT failures,locked_until FROM pin_attempts WHERE key=?',key);
 if(attempt&&attempt.locked_until>Date.now())throw Error('ბევრი მცდელობა. სცადეთ 15 წუთში.');
 const current=await hashPin(pin,therapist.pin_salt);
 let diff=0;for(let i=0;i<current.length;i++)diff|=current.charCodeAt(i)^therapist.pin_hash.charCodeAt(i);
 if(diff!==0){const failures=(attempt?.failures||0)+1;await run('INSERT INTO pin_attempts(key,failures,locked_until) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET failures=excluded.failures,locked_until=excluded.locked_until',key,failures,failures>=5?Date.now()+900000:0);throw Error('PIN არასწორია');}
 await run('DELETE FROM pin_attempts WHERE key=?',key);
 return true;
}
