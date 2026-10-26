const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),{webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..');
function load(relative,resolve){const code=ts.transpileModule(fs.readFileSync(path.join(root,relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const sandbox={exports:{},require:resolve,Response,Request,URL,crypto:webcrypto,console};vm.createContext(sandbox);vm.runInContext(code,sandbox);return sandbox.exports;}
(async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const engine=new PGlite();
 await engine.exec(fs.readFileSync(path.join(root,'migrations/0001_plaza_postgres.sql'),'utf8'));
 // PGlite is PostgreSQL in WASM. Session advisory locks are unavailable there;
 // the test pool serializes leased clients, as pg_advisory_xact_lock does live.
 let releaseGate=Promise.resolve();
 const query=async(sql,args)=>{if(sql.includes('pg_advisory_xact_lock'))return {rows:[],rowCount:0};try{const r=await engine.query(sql,args);return {rows:r.rows,rowCount:r.affectedRows??r.rows.length};}catch(e){console.error('PG TEST QUERY:',sql,e.message);throw e;}};
 const pool={query,async connect(){const before=releaseGate;let release;releaseGate=new Promise(r=>release=r);await before;return {query,release};}};
 const {PostgresDatabase}=await import('../lib/postgres-db.mjs');const db=new PostgresDatabase(pool),env={DB:db};
 const passwords=await import('../lib/auth-password.mjs'),model=await import('../lib/plaza-model.mjs');
 const config=load('lib/legal-config.ts',()=>{});
 const server={env,requestURL:r=>new URL(r.url)};
 const identity=load('app/plaza-auth.ts',n=>n.includes('server-env')?server:n.includes('chatgpt-auth')?{getChatGPTUser:async()=>null}:passwords);
 const pushes={deliverPush:async()=>{},isPushEndpoint:()=>false};
 const resolve=n=>n.includes('server-env')?server:n.includes('plaza-auth')?identity:n.includes('legal-config')?config:n.includes('push-delivery')?pushes:n.includes('auth-password')?passwords:model;
 const auth=load('app/api/account/[...path]/route.ts',resolve),plaza=load('app/api/plaza/[...path]/route.ts',resolve),community=load('app/api/community/[...path]/route.ts',resolve);
 const modules={account:auth,plaza,community},origin='https://localhost';
 async function request(group,action,body,cookie=''){const method=body===undefined?'GET':'POST';const response=await modules[group][method](new Request(origin+'/api/'+group+'/'+action,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},...(body===undefined?{}:{body:JSON.stringify(body)})}));return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 const password='Synthetic-only-password-471!';
 async function register(nick){const r=await request('account','register',{nickname:nick,roblox:nick+'_Rbx',password,termsAccepted:true,legalVersion:config.LEGAL_VERSION});assert.equal(r.status,201,JSON.stringify(r.body));r.id=(await request('plaza','me',undefined,r.cookie)).body.user.id;return r;}
 const a=await register('PgAlice'),b=await register('PgBob'),e=await register('PgEve');
 assert.equal((await request('account','register',{nickname:'PgNoTerms',roblox:'PgNoTerms_Rbx',password})).status,400);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM roskins_terms_acceptance').first()).n,3);
 assert.equal((await request('account','login',{nickname:'pgalice',password})).status,200);
 const turtle=model.CATALOG.find(x=>x.name==='Turtle').id,unicorn=model.CATALOG.find(x=>x.name==='Unicorn').id;
 const item=pet=>({pet,variant:'normal',fly:false,ride:true,quantity:1});
 const saved=await request('community','search-save',{pet:turtle,variant:'normal',readyOnly:true,fly:0,ride:1},b.cookie);assert.equal(saved.status,201,JSON.stringify(saved.body));
 const listing=await request('plaza','listings',{have:[item(turtle)],want:[item(unicorn)],note:'PostgreSQL test'},a.cookie);assert.equal(listing.status,201,JSON.stringify(listing.body));
 assert.equal((await request('community','notifications',undefined,b.cookie)).body.notifications.length,0);
 assert.equal((await request('plaza','listing-status',{id:listing.body.id,status:'ready'},a.cookie)).status,200);
 assert.equal((await request('community','notifications',undefined,b.cookie)).body.notifications.length,1);
 const reverse=await request('plaza','listings',{have:[item(unicorn)],want:[item(turtle)],note:''},b.cookie);assert.equal(reverse.status,201);
 assert.equal((await request('plaza','matches?listing='+reverse.body.id,undefined,b.cookie)).body.matches.length,1);
 const offer=await request('plaza','offers',{listingId:listing.body.id,have:[item(unicorn)],want:[item(turtle)],note:''},b.cookie);assert.equal(offer.status,201,JSON.stringify(offer.body));
 const other=await request('plaza','offers',{listingId:listing.body.id,have:[item(unicorn)],want:[item(turtle)],note:''},e.cookie);assert.equal(other.status,201);
 assert.equal((await request('plaza','messages?offer='+offer.body.id,undefined,e.cookie)).status,404);
 const text="It's a literal '?'; not SQL";
 assert.equal((await request('plaza','messages',{offerId:offer.body.id,body:text},b.cookie)).status,201);
 assert.equal((await request('plaza','messages?offer='+offer.body.id,undefined,a.cookie)).body.messages[0].body,text);
 const accepted=await request('plaza','offer-status',{id:offer.body.id,status:'accept'},a.cookie);assert.equal(accepted.status,200,JSON.stringify(accepted.body));
 assert.equal((await db.prepare('SELECT status FROM plaza_listings WHERE id=?').bind(listing.body.id).first()).status,'reserved');
 assert.equal((await db.prepare('SELECT status FROM plaza_offers WHERE id=?').bind(other.body.id).first()).status,'declined');
 assert.equal((await request('plaza','offer-status',{id:offer.body.id,status:'complete'},b.cookie)).status,200);
 assert.equal((await request('plaza','offer-status',{id:offer.body.id,status:'complete'},a.cookie)).body.offer.status,'completed');
 assert.equal((await db.prepare('SELECT status FROM plaza_listings WHERE id=?').bind(listing.body.id).first()).status,'completed');
 // Atomic batches roll back earlier changes when any statement fails.
 const before=(await db.prepare('SELECT nickname FROM profiles WHERE id=?').bind(a.id).first()).nickname;
 await assert.rejects(db.batch([db.prepare('UPDATE profiles SET nickname=? WHERE id=?').bind('RollbackTest',a.id),db.prepare('INSERT INTO roskins_terms_acceptance VALUES (?,?,?)').bind(a.id,config.LEGAL_VERSION,Date.now())]));
 assert.equal((await db.prepare('SELECT nickname FROM profiles WHERE id=?').bind(a.id).first()).nickname,before);
 // Cancellation trigger releases reservation, closing a listing declines offers.
 const next=await request('plaza','listings',{have:[item(turtle)],want:[],note:''},a.cookie);
 const second=await request('plaza','offers',{listingId:next.body.id,have:[item(unicorn)],want:[item(turtle)]},b.cookie);
 await request('plaza','offer-status',{id:second.body.id,status:'accept'},a.cookie);
 assert.equal((await request('plaza','offer-status',{id:second.body.id,status:'cancel'},b.cookie)).status,200);
 assert.equal((await db.prepare('SELECT status FROM plaza_listings WHERE id=?').bind(next.body.id).first()).status,'active');
 const third=await request('plaza','offers',{listingId:next.body.id,have:[item(unicorn)],want:[item(turtle)]},b.cookie);assert.equal(third.status,201);
 await request('plaza','listing-status',{id:next.body.id,status:'close'},a.cookie);
 assert.equal((await db.prepare('SELECT status FROM plaza_offers WHERE id=?').bind(third.body.id).first()).status,'declined');
 const recovery=await request('account','recover',{nickname:'PgAlice',password:'Replacement-test-password-42',recoveryCode:a.body.recoveryCode});assert.equal(recovery.status,200,JSON.stringify(recovery.body));
 assert.equal((await request('plaza','me',undefined,a.cookie)).body.user,null);
 assert.equal((await request('plaza','me',undefined,recovery.cookie)).body.user.id,a.id);
 await engine.close();console.log('PASS PostgreSQL engine + actual account/plaza/community handlers: schema/FKs/9 triggers, versioned registration, login/recovery/revocation, prepared parameters, search/ready notifications, matching, offers, private chat, reservation/decline/cancel/close/dual completion, transactional rollback.');
})().catch(e=>{console.error(e);process.exitCode=1;});
