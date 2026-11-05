import { NextRequest,NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { iso,row,run,session } from '@/lib/server';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 try{
  const access=await session(req);if(!access)return NextResponse.json({error:'წვდომა არ არის'},{status:403});
  const form=await req.formData(),file=form.get('file'),id=String(form.get('clientId')||'');
  const mine=await row('SELECT id FROM clients WHERE id=? AND therapist_id=?',id,access.therapistId);if(!mine)return NextResponse.json({error:'ქეისი ვერ მოიძებნა'},{status:404});
  if(!(file instanceof File)||file.size>12*1024*1024||file.size<100||!file.name.toLowerCase().endsWith('.pdf'))return NextResponse.json({error:'მხოლოდ PDF, მაქს. 12 MB'},{status:400});
  const data=await file.arrayBuffer();const head=new TextDecoder().decode(data.slice(0,5));if(head!=='%PDF-')return NextResponse.json({error:'PDF ფაილი არასწორია'},{status:400});
  if(!env.BUCKET)return NextResponse.json({error:'ფაილების საცავი მიუწვდომელია'},{status:503});
  const fileId=crypto.randomUUID(),key=`qeeg/${access.therapistId}/${id}/${fileId}.pdf`;
  await env.BUCKET.put(key,data,{httpMetadata:{contentType:'application/pdf'}});
  await run('INSERT INTO qeeg_files(id,client_id,therapist_id,object_key,filename,bytes,created_at) VALUES(?,?,?,?,?,?,?)',fileId,id,access.therapistId,key,file.name.slice(0,150),file.size,iso());
  return NextResponse.json({id:fileId});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'შეცდომა'},{status:400});}
}
export async function GET(req:NextRequest){
 const access=await session(req);if(!access)return new Response('Forbidden',{status:403});
 const id=req.nextUrl.searchParams.get('id')||'';
 const file=await row<{object_key:string}>('SELECT object_key FROM qeeg_files WHERE id=? AND therapist_id=?',id,access.therapistId);
 if(!file||!env.BUCKET)return new Response('Not found',{status:404});
 const data=await env.BUCKET.get(file.object_key);if(!data)return new Response('Not found',{status:404});
 return new Response(data.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="qeeg.pdf"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
