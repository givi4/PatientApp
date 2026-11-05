import { NextRequest, NextResponse } from 'next/server';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { DEFAULT_THERAPISTS,hashPin,iso,row,rows,run,session,setSessionCookie,validPin,verifyPin } from '@/lib/server';
import { TESTS, scoreTest } from '@/lib/tests';
export const dynamic='force-dynamic';
const ok=(data:unknown)=>NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
const bad=(message:string,status=400)=>NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
type Client={id:string;therapist_id:string;code:string;full_name:string;age:number;sex:string;note:string;findings:string;created_at:string;updated_at:string};
export async function GET(req:NextRequest){
 try{
  const user=await getChatGPTUser();if(!user)return bad('საჭიროა შესვლა ChatGPT ანგარიშით',401);
  const mode=req.nextUrl.searchParams.get('mode')||'bootstrap';const access=await session(req);
  if(mode==='bootstrap'){
   const dbTherapists=await rows<{id:string;name:string;specialty:string;owner_user_id:string;pin_hash:string}>('SELECT id,name,specialty,owner_user_id,pin_hash FROM therapists ORDER BY created_at');
   const merged=DEFAULT_THERAPISTS.map(t=>dbTherapists.find(x=>x.id===t.id)||{...t,owner_user_id:'',pin_hash:''});
   merged.push(...dbTherapists.filter(t=>!DEFAULT_THERAPISTS.some(x=>x.id===t.id)));
   const therapists=merged.map(t=>({id:t.id,name:t.name,specialty:t.specialty,claimed:!!t.pin_hash,own:!!t.pin_hash&&t.owner_user_id===user.userId}));
   const stats=await row<{total:number;new_clients:number;female:number;male:number;other:number;young:number;middle:number;older:number}>(`SELECT COUNT(*) total,
    COALESCE(SUM(CASE WHEN created_at>=? THEN 1 ELSE 0 END),0) new_clients,
    COALESCE(SUM(CASE WHEN sex='ქალი' THEN 1 ELSE 0 END),0) female,COALESCE(SUM(CASE WHEN sex='კაცი' THEN 1 ELSE 0 END),0) male,
    COALESCE(SUM(CASE WHEN sex NOT IN ('ქალი','კაცი') THEN 1 ELSE 0 END),0) other,
    COALESCE(SUM(CASE WHEN age<25 THEN 1 ELSE 0 END),0) young,COALESCE(SUM(CASE WHEN age BETWEEN 25 AND 44 THEN 1 ELSE 0 END),0) middle,
    COALESCE(SUM(CASE WHEN age>=45 THEN 1 ELSE 0 END),0) older FROM clients`,new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString());
   return ok({therapists,stats,active:access?.therapistId||null,user:user.displayName});
  }
  if(!access)return bad('PIN-ით შესვლა აუცილებელია',403);
  if(mode==='clients'){
   const clients=await rows<Client>('SELECT * FROM clients WHERE therapist_id=? ORDER BY updated_at DESC',access.therapistId);
   const assessments=await rows<{client_id:string;test_id:string;stage:string;result:string;created_at:string}>('SELECT client_id,test_id,stage,result,created_at FROM assessments WHERE therapist_id=? ORDER BY created_at DESC',access.therapistId);
   return ok({clients,assessments:assessments.map(a=>({...a,result:JSON.parse(a.result)}))});
  }
  if(mode==='case'){
   const id=req.nextUrl.searchParams.get('id')||'';
   const client=await row<Client>('SELECT * FROM clients WHERE id=? AND therapist_id=?',id,access.therapistId);if(!client)return bad('ქეისი ვერ მოიძებნა',404);
   const assessments=await rows<{id:string;test_id:string;stage:string;answers:string;result:string;created_at:string}>('SELECT id,test_id,stage,answers,result,created_at FROM assessments WHERE client_id=? AND therapist_id=? ORDER BY created_at DESC',id,access.therapistId);
   const files=await rows<{id:string;filename:string;bytes:number;created_at:string}>('SELECT id,filename,bytes,created_at FROM qeeg_files WHERE client_id=? AND therapist_id=? ORDER BY created_at DESC',id,access.therapistId);
   return ok({client,assessments:assessments.map(a=>({...a,answers:JSON.parse(a.answers),result:JSON.parse(a.result)})),files});
  }
  return bad('უცნობი მოთხოვნა');
 }catch(e){return bad(e instanceof Error?e.message:'შიდა შეცდომა',500);}
}

export async function POST(req:NextRequest){
 try{
  const user=await getChatGPTUser();if(!user)return bad('საჭიროა ავტორიზაცია',401);
  const body=await req.json() as Record<string,unknown>;const action=String(body.action||'');
  if(action==='claim'){
   const id=String(body.therapistId||''),pin=body.pin,confirm=body.confirm;
   if(!validPin(pin)||pin!==confirm)return bad('შეიყვანეთ და გაიმეორეთ ოთხნიშნა PIN');
   const defaultTherapist=DEFAULT_THERAPISTS.find(t=>t.id===id);
   const existing=await row<{id:string;owner_user_id:string;pin_hash:string}>('SELECT id,owner_user_id,pin_hash FROM therapists WHERE id=?',id);
   if(!existing&&!defaultTherapist)return bad('თერაპევტი ვერ მოიძებნა');
   if(existing?.pin_hash)return bad('PIN უკვე დაყენებულია; გამოიყენეთ შესვლის ფორმა');
   const claimedOther=await row<{id:string}>('SELECT id FROM therapists WHERE owner_user_id=? AND pin_hash IS NOT NULL',user.userId);
   if(claimedOther&&claimedOther.id!==id)return bad('ერთი ავტორიზებული ანგარიში მხოლოდ ერთ თერაპევტს უკავშირდება');
   const salt=crypto.randomUUID(),hash=await hashPin(String(pin),salt);
   if(existing){await run('UPDATE therapists SET owner_user_id=?,pin_salt=?,pin_hash=? WHERE id=? AND pin_hash IS NULL',user.userId,salt,hash,id);}
   else{await run('INSERT INTO therapists(id,name,specialty,owner_user_id,pin_salt,pin_hash,created_at) VALUES(?,?,?,?,?,?,?)',id,defaultTherapist!.name,defaultTherapist!.specialty,user.userId,salt,hash,iso());}
   const res=ok({active:id});res.cookies.set('portal_access',await setSessionCookie(id,user.userId),{httpOnly:true,sameSite:'strict',secure:true,path:'/',maxAge:1800});return res;
  }
  if(action==='unlock'){
   const id=String(body.therapistId||'');if(!validPin(body.pin))return bad('PIN უნდა იყოს ოთხნიშნა');
   await verifyPin(id,user.userId,String(body.pin));const res=ok({active:id});res.cookies.set('portal_access',await setSessionCookie(id,user.userId),{httpOnly:true,sameSite:'strict',secure:true,path:'/',maxAge:1800});return res;
  }
  if(action==='createTherapist'){
   const name=String(body.name||'').trim(),specialty=String(body.specialty||'ფსიქოლოგი');
   if(name.length<4||name.length>100)return bad('მიუთითეთ თერაპევტის სრული სახელი');
   const id=crypto.randomUUID();await run('INSERT INTO therapists(id,name,specialty,created_at) VALUES(?,?,?,?)',id,name,specialty==='ფსიქიატრი'?'ფსიქიატრი':'ფსიქოლოგი',iso());return ok({id});
  }
  const access=await session(req);if(!access)return bad('PIN-ით შესვლა აუცილებელია',403);
  if(action==='lock'){
   if(!validPin(body.pin))return bad('შეიყვანეთ ოთხნიშნა PIN');
   await verifyPin(access.therapistId,user.userId,String(body.pin));
   const res=ok({locked:true});res.cookies.delete('portal_access');return res;
  }
  if(action==='createClient'){
   const name=String(body.fullName||'').trim(),code=String(body.code||'').trim(),age=Number(body.age),sex=String(body.sex||'');
   if(name.length<3||name.length>120||!code||code.length>64||!Number.isInteger(age)||age<1||age>120||!['ქალი','კაცი','სხვა / არ მსურს მითითება'].includes(sex))return bad('შეავსეთ კლიენტის მონაცემები სრულად');
   const id=crypto.randomUUID(),now=iso();await run('INSERT INTO clients(id,therapist_id,code,full_name,age,sex,note,findings,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',id,access.therapistId,code,name,age,sex,'','{}',now,now);return ok({id});
  }
  if(action==='updateCase'){
   const id=String(body.clientId||'');const mine=await row('SELECT id FROM clients WHERE id=? AND therapist_id=?',id,access.therapistId);if(!mine)return bad('ქეისზე წვდომა არ გაქვთ',403);
   const note=String(body.note||'').slice(0,12000);const findings=body.findings;
   if(typeof findings!=='object'||!findings||Array.isArray(findings))return bad('QEEG მონაცემები არასწორია');
   const allowed=['delta','theta','alpha','lowBeta','highBeta'];const safe:Record<string,{status:string;region:string}>={};
   for(const band of allowed){const f=(findings as Record<string,unknown>)[band];if(typeof f==='object'&&f){const v=f as Record<string,unknown>;const status=String(v.status||'unknown');safe[band]={status:['high','low','normal','unknown'].includes(status)?status:'unknown',region:String(v.region||'').slice(0,120)};}}
   await run('UPDATE clients SET note=?,findings=?,updated_at=? WHERE id=? AND therapist_id=?',note,JSON.stringify(safe),iso(),id,access.therapistId);return ok({saved:true});
  }
  if(action==='saveTest'){
   const id=String(body.clientId||''),testId=String(body.testId||''),stage=String(body.stage||'');
   const mine=await row('SELECT id FROM clients WHERE id=? AND therapist_id=?',id,access.therapistId);if(!mine)return bad('კლიენტი ვერ მოიძებნა',403);
   if(!['pre','post'].includes(stage)||!TESTS.some(t=>t.id===testId)||!Array.isArray(body.answers))return bad('ტესტის ველები არასწორია');
   const result=scoreTest(testId,body.answers as number[]);const assessmentId=crypto.randomUUID();
   await run('INSERT INTO assessments(id,client_id,therapist_id,test_id,stage,answers,result,created_at) VALUES(?,?,?,?,?,?,?,?)',assessmentId,id,access.therapistId,testId,stage,JSON.stringify(body.answers),JSON.stringify(result),iso());
   await run('UPDATE clients SET updated_at=? WHERE id=? AND therapist_id=?',iso(),id,access.therapistId);
   return ok({assessmentId,result});
  }
  return bad('უცნობი მოქმედება');
 }catch(e){const message=e instanceof Error?e.message:'შიდა შეცდომა';return bad(message,/UNIQUE/.test(message)?409:400);}
}
