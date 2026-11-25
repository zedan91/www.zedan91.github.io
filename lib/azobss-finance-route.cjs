'use strict';

const { pipeline } = require('node:stream/promises');
const { makeService,assertId } = require('./azobss-finance-service.cjs');
const { exportReport } = require('./azobss-finance-reports.cjs');
const { MAX_FILE,fail,text } = require('./azobss-finance-model.cjs');

async function financeRoute(req,res,{pathname,parsed,getDb,adminIdentity,readBinary,send,secureHeaders,PDFDocument,secret}) {
  const noCache = {'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
  const json = (status,data) => send(res,status,JSON.stringify(data),'application/json; charset=utf-8',noCache);
  const identity=await adminIdentity(req,parsed);
  if (!identity?.isAdmin || identity.authMethod === 'api-secret') return json(403,{ok:false,error:'Administrator sign-in required.'});
  const route=pathname.slice('/api/admin/finance'.length);
  const method=req.method;
  const query=parsed.query;
  const service=()=>makeService(getDb(),secret);
  const filename=()=>text(String(query.filename || '').split(/[\\/]/).at(-1),180);
  const attach=(value,type)=>({
    ...noCache,'Content-Type':type,'Access-Control-Expose-Headers':'Content-Disposition',
    'Content-Disposition':'attachment; filename="'+value.replace(/[^a-z\d ._()-]/gi,'_')+'"'
  });
  async function body() {
    const value=await readBinary(req,128*1024);
    try {
      const parsed=JSON.parse(value.toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('shape');
      return parsed;
    } catch (_) {throw fail('Send a valid JSON object.');}
  }
  try {
    if (route === '/health' && method === 'GET') {
      const status=await service().settings();
      return json(200,{ok:true,provider:status.provider,syncAvailable:status.syncAvailable,lastSuccessfulSync:status.lastSuccessfulSync});
    }
    if (route === '/overview' && method === 'GET') {
      return json(200,{ok:true,...await service().overview(query.period,query.after?assertId(query.after):'')});
    }
    if (route === '/statements' && method === 'POST') {
      if (!filename()) throw fail('Choose a statement file.');
      const month = query.month ? String(query.month) : '';
      const raw=await readBinary(req,MAX_FILE);
      const result=await service().importStatement(raw,filename(),identity,query.action==='commit',text(query.previewKey,64),month);
      return json(200,{ok:true,...result});
    }
    if (route === '/opening' && method === 'POST') {
      return json(200,{ok:true,...await service().saveOpening(await body(),identity)});
    }
    if (route === '/report' && method === 'GET') {
      const format=text(query.format,10) || 'json';
      if (!['json','pdf','csv','xlsx'].includes(format)) throw fail('Unsupported report format.');
      const report=await service().report(query.period,query.closing);
      if (format==='json') {
        const {detail,...summary}=report;
        return json(200,{ok:true,...summary});
      }
      if (format==='pdf' && !PDFDocument) throw fail('PDF export is not available on this backend.',503);
      const file=await exportReport(report,format,PDFDocument);
      return send(res,200,file.body,file.type,attach(file.filename,file.type));
    }
    if (route === '/audit' && method === 'GET') {
      return json(200,{ok:true,events:await service().audit()});
    }
    if (route === '/backup' && method === 'GET') {
      const snapshot=service().backupStream();
      res.writeHead(200,secureHeaders(attach('azobss-finance-'+new Date().toISOString().slice(0,10)+'.ndjson','application/x-ndjson')));
      await pipeline(snapshot,res);
      return;
    }
    if (route === '/sync' && method === 'POST') {
      throw fail('Bank sync is awaiting an approved read-only provider. Import a statement to update the ledger.',409);
    }
    const entry=route.match(/^\/entries\/([^/]+)\/(review|match|documents)$/);
    if (entry && method === 'POST') {
      const id=assertId(entry[1]);
      if (entry[2]==='review') return json(200,{ok:true,row:await service().changes(id,await body(),identity)});
      if (entry[2]==='match') return json(200,{ok:true,...await service().matchSale(id,identity)});
      const raw=await readBinary(req,MAX_FILE);
      return json(200,{ok:true,...await service().addAttachment(id,raw,filename(),identity)});
    }
    const single=route.match(/^\/entries\/([^/]+)$/);
    if (single && method === 'GET') {
      return json(200,{ok:true,row:await service().entry(assertId(single[1]))});
    }
    const fileRoute=route.match(/^\/files\/([^/]+)$/);
    if (fileRoute && method === 'GET') {
      const file=await service().download(assertId(fileRoute[1]));
      return send(res,200,file.body,file.type,attach(file.filename,file.type));
    }
    return json(404,{ok:false,error:'Finance action not found.'});
  } catch (error) {
    if (res.destroyed || res.headersSent) {
      if (!res.destroyed) res.destroy();
      return;
    }
    if (error.statusCode) return json(error.statusCode,{ok:false,error:error.message});
    console.error('Business Finance request failed:',error.code || error.name);
    return json(503,{ok:false,error:'Business Finance could not complete this request. Please try again.'});
  }
}

module.exports={financeRoute};

