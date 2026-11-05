'use client';
import { PDFDocument,rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { TESTS } from './tests';

type Data={client:{full_name:string;code:string;age:number;sex:string;note:string;findings:string};assessments:{test_id:string;stage:string;result:{score:number;max:number;label:string;zone:string;subscales?:{name:string;score:number}[]};created_at:string}[];files:{id:string;filename:string}[]};
const waves:Record<string,{label:string;range:string;high:string;low:string}>={
 delta:{label:'დელტა',range:'0.5–4 Hz',high:'სწავლის სირთულეებთან, ნევროლოგიურ მდგომარეობებთან ან ძილის/არტეფაქტულ ფაქტორებთან',low:'ძილისა და აღგზნების რეგულაციის ცვლილებებთან'},
 theta:{label:'თეტა',range:'4–8 Hz',high:'ძილიანობასთან, ყურადღების სირთულეებთან ან კოგნიტური დატვირთვის ცვლილებებთან',low:'მომატებულ აღგზნებასთან და ძილის სირთულეებთან'},
 alpha:{label:'ალფა',range:'8–12 Hz',high:'მოსვენების რიტმის განაწილების თავისებურებებთან ან ფრონტალურ ასიმეტრიასთან',low:'შფოთვით აღგზნებასთან, სტრესთან ან თვალის მდგომარეობის გავლენასთან'},
 lowBeta:{label:'დაბალი ბეტა',range:'15–20 Hz',high:'აქტიურ კოგნიტურ ჩართულობასთან',low:'ყურადღების მოდულაციის თავისებურებებთან'},
 highBeta:{label:'მაღალი ბეტა',range:'21–30 Hz',high:'დაძაბულობასთან, რუმინაციასთან ან კუნთის არტეფაქტთან',low:'აქტივაციის ინდივიდუალურ განსხვავებებთან'},
};
export const waveInterpretation=(findings:Record<string,{status:string;region:string}>)=>Object.entries(waves).flatMap(([id,w])=>{
 const f=findings[id];if(!f||f.status==='unknown'||!f.status)return [];
 const state=f.status==='high'?'მომატებული':f.status==='low'?'შემცირებული':'ნორმის ფარგლებში';
 const loc=f.region?` (${f.region})`:'';
 if(f.status==='normal')return [`${w.label} (${w.range})${loc}: მონიშნულია, როგორც ნორმის ფარგლებში. კლინიკური დასკვნა მხოლოდ რუკაზე არ უნდა დაეფუძნოს.`];
 return [`${w.label} (${w.range})${loc}: Absolute Power მონიშნულია, როგორც ${state}. შესაძლოა ასოცირდებოდეს / ვლინდებოდეს ${f.status==='high'?w.high:w.low}. ეს არასპეციფიკური ასოციაციაა და არა დიაგნოსტიკური დასკვნა.`];
});

export async function generateReport(data:Data,therapistName:string){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const fontBytes=await fetch('/fonts/DejaVuSans.ttf').then(r=>r.arrayBuffer());const font=await pdf.embedFont(fontBytes,{subset:true});
 const W=595,H=842,margin=48,blue=rgb(.10,.20,.29),teal=rgb(.11,.48,.48),muted=rgb(.37,.43,.47),line=rgb(.86,.9,.89);
 let page=pdf.addPage([W,H]),y=H-55,number=1;
 const newPage=()=>{page=pdf.addPage([W,H]);y=H-55;number++;header(false);};
 const write=(value:string,x:number,size=10,color=blue)=>{page.drawText(value,{x,y,size,font,color,maxWidth:W-x-margin});};
 const wrap=(value:string,maxWidth:number,size:number)=>{const words=value.split(/\s+/),lines:string[]=[];let current='';for(const word of words){const next=current?current+' '+word:word;if(font.widthOfTextAtSize(next,size)>maxWidth&&current){lines.push(current);current=word;}else current=next;}if(current)lines.push(current);return lines;};
 const text=(value:string,opts:{size?:number;color?:typeof blue;space?:number;indent?:number}={})=>{const size=opts.size||10,space=opts.space||16,indent=opts.indent||0;for(const para of String(value||'').split('\n')){const chunks=wrap(para||' ',W-2*margin-indent,size);for(const chunk of chunks){if(y<72)newPage();write(chunk,margin+indent,size,opts.color||blue);y-=space;}}};
 const heading=(value:string)=>{if(y<115)newPage();y-=14;text(value,{size:13,space:22,color:teal});};
 const header=(first:boolean)=>{page.drawRectangle({x:0,y:H-15,width:W,height:15,color:teal});page.drawLine({start:{x:margin,y:53},end:{x:W-margin,y:53},thickness:.7,color:line});page.drawText('ფსიქოლოგიური ქეისების პორტალი',{x:margin,y:36,size:8,font,color:muted});page.drawText(`${number}`,{x:W-margin-10,y:36,size:8,font,color:muted});if(first){text('ფსიქოლოგიური შეფასების ანგარიში',{size:20,space:28,color:blue});text('კონფიდენციალური კლინიკური დოკუმენტი',{size:9,space:20,color:muted});}};
 header(true);
 heading('კლიენტის ინფორმაცია');
 text(`სახელი და გვარი: ${data.client.full_name}`);text(`კლიენტის კოდი / ID: ${data.client.code}`);text(`ასაკი: ${data.client.age}  •  სქესი: ${data.client.sex}`);text(`თერაპევტი: ${therapistName}`);text(`ანგარიშის თარიღი: ${new Date().toLocaleDateString('ka-GE')}`);
 heading('ფსიქოლოგიური შეფასების სიტყვიერი მოკლე ახსნა');
 text(data.client.note?.trim()||'შეფასება არ არის დამატებული.',{size:10,space:16});
 heading('ფსიქომეტრიული მონაცემები');
 text('ქვემოთ მოცემული სკრინინგული ინდექსები ეფუძნება სამუშაო ქართულ ფორმებს. ოფიციალური თარგმანებითა და სკორინგით ვალიდაცია აუცილებელია.',{size:8,color:muted,space:13});
 for(const t of TESTS){
  const list=data.assessments.filter(a=>a.test_id===t.id).sort((a,b)=>a.created_at.localeCompare(b.created_at));
  if(y<100)newPage();
  const latest=list[list.length-1];
  const stage=latest?(latest.stage==='pre'?'პრე':'პოსტ'):'—';
  const val=latest?`${latest.result.score} / ${latest.result.max}`:'არ ჩატარებულა';
  const zone=latest?.result.zone;
  const shade=zone==='red'?rgb(.85,.34,.32):zone==='yellow'?rgb(.88,.64,.22):zone==='green'?rgb(.21,.57,.43):muted;
  page.drawRectangle({x:margin,y:y-8,width:7,height:9,color:shade});
  write(`${t.title}    ${val}    [${stage}]`,margin+15,10,blue);y-=17;
  if(latest){text(latest.result.label,{size:8,color:muted,space:12,indent:15});}
 }
 heading('QEEG — Absolute Power (QEEG PRO)');
 text('ქვემოთ მოცემული ინტერპრეტაცია ეფუძნება მხოლოდ კლინიცისტის მიერ შეყვანილ Absolute Power მონაცემთა ნიშნულებს. PDF-ის სხვა გვერდები, Relative Power, ასიმეტრია და კავშირადობა არ გამოიყენება.',{size:9,color:muted,space:14});
 let findings:Record<string,{status:string;region:string}>={};try{findings=JSON.parse(data.client.findings||'{}');}catch{}
 const interpretations=waveInterpretation(findings);
 if(interpretations.length){for(const x of interpretations){text(`• ${x}`,{size:9,space:14});y-=6;}}else text('ტალღების ნიშნულები ჯერ არ არის შეყვანილი; ინტერპრეტაცია არ გენერირებულა.',{size:9,color:muted});
 text('შენიშვნა: QEEG დამოუკიდებლად არ ადგენს ფსიქიატრიულ ან ნევროლოგიურ დიაგნოზს. შედეგები უნდა შეფასდეს არტეფაქტების, ასაკის, მდგომარეობის, რეფერენსული ბაზისა და კლინიკური კონტექსტის გათვალისწინებით.',{size:8,color:muted,space:13});
 if(data.files.length){
  const latest=data.files[0];const response=await fetch(`/api/qeeg?id=${encodeURIComponent(latest.id)}`,{cache:'no-store'});
  if(!response.ok)throw Error('QEEG ფაილის წაკითხვა ვერ მოხერხდა');
  const src=await response.arrayBuffer();
  const doc=await PDFDocument.load(src,{ignoreEncryption:false});
  if(doc.getPageCount()<2)throw Error('ატვირთულ QEEG PDF-ს მეორე გვერდი არ აქვს. ანგარიში არ შეიქმნა.');
  const [embedded]=await pdf.embedPdf(src,[1]);
  newPage();heading('QEEG რუკა — მხოლოდ ატვირთული PDF-ის გვერდი 2');
  const availableHeight=y-110,scale=Math.min((W-2*margin)/embedded.width,availableHeight/embedded.height);
  const width=embedded.width*scale,height=embedded.height*scale;
  page.drawPage(embedded,{x:(W-width)/2,y:y-height-5,width,height});
  y-=height+15;
 }
 const out=await pdf.save();const blob=new Blob([new Uint8Array(out)],{type:'application/pdf'});
 const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`ანგარიში_${data.client.code.replace(/[^\w-]/g,'_')}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),20000);
}
