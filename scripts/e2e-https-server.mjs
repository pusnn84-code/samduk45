import https from "node:https";
import {readFile} from "node:fs/promises";
import next from "next";

const database=new URL(process.env.DATABASE_URL??"");
if(process.env.CI!=="true"||process.env.E2E_DATABASE_READY!=="1"||!["localhost","127.0.0.1"].includes(database.hostname)||database.pathname!=="/prayer_e2e")throw new Error("DISPOSABLE_CI_HTTPS_ONLY");
const app=next({dev:false,hostname:"localhost",port:3443});
await app.prepare();
const handle=app.getRequestHandler();
const server=https.createServer({key:await readFile(process.env.E2E_TLS_KEY),cert:await readFile(process.env.E2E_TLS_CERT)},(req,res)=>handle(req,res));
server.listen(3443,"localhost",()=>console.log("Disposable HTTPS browser fixture ready."));
for(const signal of ["SIGTERM","SIGINT"])process.on(signal,()=>server.close(()=>process.exit(0)));
