const fs = require('node:fs');
const path = require('node:path');
const QRCode = require('qrcode');
const root = path.resolve(__dirname, '..');
const base = (process.env.PUBLIC_URL || 'https://SEU-DOMINIO.pages.dev/').replace(/\/?$/, '/');
const worksFile = process.env.WORKS_FILE ? path.resolve(process.env.WORKS_FILE) : path.join(root, 'data/trabalhos.json');
const { works } = JSON.parse(fs.readFileSync(worksFile, 'utf8').replace(/^\uFEFF/, ''));
const csvCell = value => `"${String(value ?? '').replaceAll('"','""')}"`;
const csv = [['ID','Número','Modalidade','Título','URL'], ...works.map(w => [w.id,w.number,w.modality,w.title,new URL(`?trabalho=${encodeURIComponent(w.id)}`,base).href])].map(row=>row.map(csvCell).join(',')).join('\r\n');
fs.writeFileSync(path.join(root,'qrcodes/trabalhos.csv'), '\ufeff'+csv, 'utf8');
const cards=[];
(async()=>{
 for(const work of works){const folder=work.modality==='Oral'?'orais':work.modality==='Pôster'?'posteres':'online';const dir=path.join(root,'qrcodes',folder);fs.mkdirSync(dir,{recursive:true});const url=new URL(`?trabalho=${encodeURIComponent(work.id)}`,base).href;const filename=`${work.id}.png`;await QRCode.toFile(path.join(dir,filename),url,{width:480,margin:2,errorCorrectionLevel:'M'});cards.push(`<article><img src="${folder}/${filename}" alt="QR Code ${work.id}"><b>${work.id} · ${work.title}</b><small>${work.school}</small></article>`);}
 const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>QR Codes — Feira GLOBE</title><style>body{font:12px Arial;margin:0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10mm;padding:10mm}article{break-inside:avoid;border:1px solid #aaa;padding:5mm;display:flex;flex-direction:column;align-items:center;text-align:center;gap:3mm}img{width:42mm;height:42mm}b{font-size:11px}small{font-size:9px}@media print{.grid{padding:0}}</style><div class="grid">${cards.join('')}</div></html>`;
 fs.writeFileSync(path.join(root,'qrcodes/imprimir.html'),html,'utf8');console.log(`QR Codes e impressão gerados: ${works.length}; URL base: ${base}`);
})().catch(error=>{console.error(error);process.exitCode=1;});
