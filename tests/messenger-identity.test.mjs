import test from "node:test";
import assert from "node:assert/strict";
import { schemas } from "../src/contract.ts";
import { messengerIdentitySchema, messengerAgentName, messengerLogoSchema } from "../src/schemas/messenger-identity.ts";
test("the shared settings contract defaults to named support and accepts explicit AI or custom names", () => {
 assert.equal(messengerAgentName(),"Alex M.");assert.equal(messengerAgentName({name_style:"female"}),"Emma R.");
 assert.equal(messengerAgentName({mode:"ai"}),"Summer");assert.equal(messengerAgentName({custom_name:" Jamie L. "}),"Jamie L.");
 const settings={enabled:true,guests_enabled:true,display_name:"Example Care",allowed_origins:["https://example.test"],privacy_url:"",fallback_url:"",office_hours:"",logo_url:"https://example.test/logo.png",identity:{mode:"ai",custom_name:"Atlas"}};
 assert.equal(schemas.messengerSettings.parse(settings).identity.custom_name,"Atlas");
 for(const value of [{mode:"robot"},{custom_name:"Bad\nName"},{name_style:"male"}])assert.equal(messengerIdentitySchema.safeParse(value).success,false);
 for(const value of ["javascript:alert(1)","https://user:secret@example.test/logo.png","http://example.test/logo.png","https://example.test/logo.png?token=secret"])assert.equal(messengerLogoSchema.safeParse(value).success,false);
});

test("an identity can use a company teammate's photo or a suggested teammate photo", () => {
 const teammate=messengerIdentitySchema.parse({custom_name:"Maya Bennett",teammate_id:"8dece789-f3da-43d0-947a-cd91774c7b34"});
 assert.equal(teammate.teammate_id,"8dece789-f3da-43d0-947a-cd91774c7b34");assert.equal(messengerAgentName(teammate),"Maya Bennett");
 assert.equal(messengerIdentitySchema.parse({custom_name:"Clara Hayes",suggested_photo:"clara.hayes"}).suggested_photo,"clara.hayes");
 for(const value of [{teammate_id:"not-a-uuid"},{suggested_photo:"../etc/passwd"},{suggested_photo:"https://example.test/a.jpg"},{suggested_photo:"Maya.Bennett"}])assert.equal(messengerIdentitySchema.safeParse(value).success,false);
});


test("first-name display keeps the employee link, survives profile renames and leaves AI names intact", () => {
 const identity = { mode: "human", name_style: "neutral", custom_name: "Julia Park", teammate_id: "8dece789-f3da-43d0-947a-cd91774c7b34", name_format: "first" };
 const parsed = messengerIdentitySchema.parse(identity);
 assert.equal(messengerAgentName(parsed), "Julia");
 assert.equal(parsed.teammate_id, identity.teammate_id);
 assert.equal(parsed.custom_name, "Julia Park");
 assert.equal(messengerAgentName({ ...parsed, custom_name: "Julia Reed" }), "Julia");
 assert.equal(messengerAgentName({ ...parsed, name_format: "full" }), "Julia Park");
 assert.equal(messengerAgentName({ ...parsed, mode: "ai", custom_name: "Summer AI" }), "Summer AI");
 assert.equal(messengerIdentitySchema.safeParse({ ...parsed, name_format: "nickname" }).success, false);
 const settings = schemas.messengerSettings.parse({ enabled: true, guests_enabled: false, display_name: "Northstar Care", allowed_origins: ["https://clinic.example.test"], privacy_url: "", fallback_url: "", office_hours: "", identity });
 assert.equal(settings.identity.name_format, "first");
});
