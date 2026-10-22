import test from 'node:test';
import assert from 'node:assert/strict';
import { messengerPresentationSchema } from '../src/schemas/messenger.ts';
import { operationById } from '../src/contract.ts';
test('presentation defaults are company neutral and include no automatic links', () => {
 const value=messengerPresentationSchema.parse({});
 assert.ok(value.actions.every(action=>action.type!=='link'));assert.ok(!JSON.stringify(value).includes('Summer'));
 assert.equal(messengerPresentationSchema.parse({actions:[]}).actions.length,0);
 assert.equal(value.lead_capture.follow_up_url,'');assert.equal(value.lead_capture.phone_required,false);
});
test('welcome links reject active schemes, credentials and secret query parameters', () => {
 for(const url of ['javascript:alert(1)','http://example.test','https://user:password@example.test','https://example.test/?token=private'])
  assert.equal(messengerPresentationSchema.safeParse({actions:[{type:'link',label:'Book',url,show_on_home:true,show_in_chat:true}]}).success,false);
 assert.equal(messengerPresentationSchema.safeParse({actions:[{type:'link',label:'Book',url:'https://example.test/book',show_on_home:true,show_in_chat:true}]}).success,true);
});
test('required fields must appear and custom contact labels round trip through the API schema', () => {
 assert.equal(messengerPresentationSchema.safeParse({lead_capture:{phone_required:true,show_phone:false}}).success,false);
 const settings={enabled:true,guests_enabled:true,display_name:'Acme',allowed_origins:['https://acme.test'],privacy_url:'',fallback_url:'',office_hours:'',presentation:{welcome_title:'Welcome to Acme',lead_capture:{show_phone:true,phone_required:true,email_label:'Work email'}}};
 const op=operationById.get('messenger.installations.update');
 const value=op.body.parse({expected_version:1,settings});
 assert.equal(value.settings.presentation.welcome_title,'Welcome to Acme');assert.equal(value.settings.presentation.lead_capture.email_label,'Work email');
 assert.equal(operationById.get('messenger.leads.list').scope,'cases.read');assert.equal(operationById.get('messenger.leads.handoff').mcp,'none');
});

test('company colors accept only hex values through the shared API and MCP contract', () => {
 const defaults=messengerPresentationSchema.parse({});assert.deepEqual(defaults.colors,{accent:'#a95424',customer_bubble:'#eef1e7'});
 const colors={accent:'#2457C5',customer_bubble:'#12224A'};
 assert.deepEqual(messengerPresentationSchema.parse({colors}).colors,{accent:'#2457c5',customer_bubble:'#12224a'});
 for(const accent of ['red','#abc','#123456\n','#12345678','url(https://example.test)',';color:red','#abcxyz'])assert.equal(messengerPresentationSchema.safeParse({colors:{accent}}).success,false);
 const settings={enabled:true,guests_enabled:true,display_name:'Example',allowed_origins:['https://example.test'],privacy_url:'',fallback_url:'',office_hours:'',presentation:{colors}};
 const saved=operationById.get('messenger.installations.update').body.parse({expected_version:1,settings});assert.equal(saved.settings.presentation.colors.accent,'#2457c5');
});

test('required registration and custom fields round trip without ambiguous keys',()=>{
 const form=messengerPresentationSchema.parse({lead_capture:{required_before_chat:true,custom_fields:[{key:'interest',label:'Interested in',type:'select',required:true,options:['Demo','Support']}]}}).lead_capture;
 assert.equal(form.required_before_chat,true);assert.equal(form.custom_fields[0].required,true);
 for(const custom_fields of [[{key:'email',label:'Email'}],[{key:'x',label:'X'},{key:'x',label:'Duplicate'}],[{key:'x',label:'X',type:'select',options:[]}],Array.from({length:11},(_,i)=>({key:'x_'+i,label:'Field'}))])assert.equal(messengerPresentationSchema.safeParse({lead_capture:{custom_fields}}).success,false);
});

test('multiple consent policy links round trip through installation API and MCP schemas',()=>{
 const consent_text='I agree to the [Terms of Service](https://example.test/terms) and acknowledge the [Privacy Policy](https://example.test/privacy).';
 const settings={enabled:true,guests_enabled:true,display_name:'Example',allowed_origins:['https://example.test'],privacy_url:'',fallback_url:'',office_hours:'',presentation:{lead_capture:{consent_text}}};
 for(const id of ['messenger.installations.create','messenger.installations.update']){
  const operation=operationById.get(id);
  const value=operation.body.parse({...(id.endsWith('update')?{expected_version:1}:{id:'11111111-1111-4111-8111-111111111111'}),settings});
  assert.equal(value.settings.presentation.lead_capture.consent_text,consent_text);
 }
 for(const url of ['javascript:alert(1)','http://example.test/privacy','data:text/html,hello','https://user:password@example.test/privacy','https://example.test/?token=private'])
  assert.equal(messengerPresentationSchema.safeParse({lead_capture:{consent_text:`Read [Privacy Policy](${url}).`}}).success,false,url);
 assert.equal(messengerPresentationSchema.parse({lead_capture:{consent_text:'Plain consent still works.'}}).lead_capture.consent_text,'Plain consent still works.');
});
