import test from 'node:test';
import assert from 'node:assert/strict';
import * as probe from '../../scripts/verify-production.mjs';
const { productionDeployment, deploymentOrigin } = probe;
const sample={id:1,sha:'a'.repeat(40),environment:'Production',creator:{login:'vercel[bot]'}};
test('production selection requires correct commit, provider and production target',()=>{
 assert.equal(productionDeployment([sample],'a'.repeat(40)).id,1);
 for(const changed of [{environment:'Preview'},{sha:'b'.repeat(40)},{creator:{login:'unknown'}}])assert.equal(productionDeployment([{...sample,...changed}],'a'.repeat(40)),undefined);
});
test('production URLs never include credentials or GitHub tokens; allow Vercel or explicit custom origin',()=>{
 assert.equal(deploymentOrigin('https://app.vercel.app/path'),'https://app.vercel.app');
 assert.equal(deploymentOrigin('https://church.example/a','https://church.example'),'https://church.example');
 for(const value of ['http://app.vercel.app','https://u:p@app.vercel.app','https://api.github.com','https://app.vercel.app.evil.test','https://localhost','https://127.0.0.1'])assert.throws(()=>deploymentOrigin(value));
});

test('public readiness uses the configured domain or repository homepage, not protected deployment URLs',()=>{
 assert.equal(typeof probe.publicVerificationOrigin,'function');
 const generated='https://app-random-team.vercel.app';
 assert.equal(probe.publicVerificationOrigin(generated,undefined,'https://app.vercel.app'),'https://app.vercel.app');
 assert.equal(probe.publicVerificationOrigin(generated,'https://church.example','https://app.vercel.app'),'https://church.example');
 assert.equal(probe.publicVerificationOrigin(generated,undefined,null),generated);
});
test('invalid public destinations fail closed without trying protected URL alternatives',()=>{
 assert.equal(typeof probe.publicVerificationOrigin,'function');
 for(const value of ['http://app.vercel.app','https://u:p@app.vercel.app','https://app.vercel.app:444','https://api.github.com','https://localhost'])
   assert.throws(()=>probe.publicVerificationOrigin('https://app-deploy.vercel.app',undefined,value));
 assert.throws(()=>probe.publicVerificationOrigin('https://app-deploy.vercel.app','http://church.example','https://app.vercel.app'));
});

const origin='https://community45.example';
const contactText='45공동체 운영 담당자에게 문의해 주세요.';
const aboutBody=(canonical=origin+'/about',contact=contactText)=>`<link rel="canonical" href="${canonical}"><h1>삼덕사오</h1>Google Calendar <a href="/privacy">개인정보처리방침</a>${contact}`;
const privacyBody=(canonical=origin+'/privacy',contact=contactText)=>`<link href="${canonical}" rel="canonical"><h1>개인정보처리방침</h1>calendar.calendarlist.readonly gmail.send Limited Use ${contact}`;
test('public readiness verifies both new branding and the actual installation canonical',()=>{
 assert.equal(probe.publicPageMatches('public-about',aboutBody(),origin,{}),true);
 assert.equal(probe.publicPageMatches('public-privacy',privacyBody(),origin,{}),true);
 assert.equal(probe.publicPageMatches('public-about',aboutBody().replace('삼덕사오','56사랑'),origin,{}),false);
 assert.equal(probe.publicPageMatches('public-about',aboutBody('https://other.example/about'),origin,{}),false);
 assert.equal(probe.publicPageMatches('public-about',aboutBody().replace(/<link[^>]+>/,''),origin,{}),false);
 assert.equal(probe.publicPageMatches('public-privacy',privacyBody().replace('gmail.send',''),origin,{}),false);
});
test('public readiness accepts unconfigured contact guidance and checks configured email consistently',()=>{
 const configured={supportEmail:'care45@example.org'};
 const email='<a href="mailto:care45@example.org">운영 담당자</a>';
 for(const [kind,body] of [['public-about',aboutBody],['public-privacy',privacyBody]]){
   const canonical=origin+(kind==='public-about'?'/about':'/privacy');
   assert.equal(probe.publicPageMatches(kind,body(canonical,email),origin,configured),true);
   assert.equal(probe.publicPageMatches(kind,body(),origin,configured),false);
   assert.equal(probe.publicPageMatches(kind,body(canonical,email),origin,{}),false);
   assert.equal(probe.publicPageMatches(kind,body(canonical,email+'<a href="mailto:old-operator@example.org">다른 담당자</a>'),origin,configured),false);
 }
});
