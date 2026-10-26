// Actual notification bell with synthetic API responses; no live database or message writes.
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const {pathToFileURL} = require("node:url");
async function main() {
  const root = path.resolve(__dirname, "../../frontend");
  const {build} = await import(pathToFileURL(path.join(root,"node_modules/vite/dist/node/index.js")).href);
  const component = path.join(root,"src/components/layout/NotificationBell.tsx").replaceAll("\\","/");
  const entry = `import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter,useLocation} from 'react-router-dom'; import NotificationBell from '${component}';
    function App(){const location=useLocation();return <main className="min-h-screen bg-slate-50"><header style={{padding:'0 32px'}} className="flex h-20 items-center justify-between border-b border-slate-200 bg-white"><h1 className="text-xl font-bold text-slate-900">SmartTask · Notification preview</h1><NotificationBell/></header><p style={{padding:32}} className="text-sm text-slate-500">Synthetic verification data. Destination: {location.pathname}{location.search}</p></main>}
    createRoot(document.getElementById('root')).render(<React.StrictMode><MemoryRouter><App/></MemoryRouter></React.StrictMode>);`;
  const fixture = `const items=[
    {notificationId:4,kind:'DISCUSSION_MESSAGE',message:'Mahedee posted in “NexusFlow” discussion.',projectId:8,taskId:null,createdAt:'2026-10-26T08:30:00Z',readAt:null,canOpen:true},
    {notificationId:3,kind:'TASK_STATUS_CHANGED',message:'Mahedee marked “Develop UI” as Completed.',projectId:8,taskId:9,createdAt:'2026-10-26T08:25:00Z',readAt:null,canOpen:true},
    {notificationId:2,kind:'TASK_ASSIGNED',message:'System Administrator created and assigned task “Develop UI” to Mahedee.',projectId:8,taskId:9,createdAt:'2026-10-26T08:20:00Z',readAt:'2026-10-26T08:20:00Z',canOpen:true},
    {notificationId:1,kind:'PROJECT_CREATED',message:'System Administrator created project “NexusFlow”.',projectId:8,taskId:null,createdAt:'2026-10-26T08:15:00Z',readAt:'2026-10-26T08:15:00Z',canOpen:true}];
    export default {get:async()=>({data:{data:{notifications:items.map(item=>({...item})),unreadCount:items.filter(item=>!item.readAt).length,nextBefore:null}}}),patch:async(url,body)=>{const all=url.endsWith('read-all'); const id=Number(url.split('/')[2]);items.forEach(item=>{if(all?item.notificationId<=body.throughId:item.notificationId===id)item.readAt=new Date().toISOString()});return {data:{success:true}}}};`;
  const output = await build({configFile:false,root,logLevel:"error",build:{write:false,minify:false,rolldownOptions:{input:"virtual:notification-preview"}},plugins:[{name:"notification-fixture",enforce:"pre",resolveId(id){
    if(id === "virtual:notification-preview")return "\0notification-entry";
    if(id.endsWith("/services/api"))return "\0notification-api";
    if(id.endsWith("/context/AuthContext"))return "\0notification-auth";
  },load(id){
    if(id === "\0notification-entry")return {code:entry,moduleType:"tsx"};
    if(id === "\0notification-api")return fixture;
    if(id === "\0notification-auth")return "export function useAuth(){return {user:{userId:1,role:'ADMIN'}}}";
  }}]});
  const code = output.output.find(item=>item.type==="chunk").code;
  const assets = path.join(root,"dist/assets"),css = fs.readFileSync(path.join(assets,fs.readdirSync(assets).find(name=>name.endsWith(".css"))));
  const server = http.createServer((req,res)=>{
    if(req.url==="/preview.js"){res.setHeader("Content-Type","text/javascript");res.end(code);}
    else if(req.url==="/style.css"){res.setHeader("Content-Type","text/css");res.end(css);}
    else{res.setHeader("Content-Type","text/html");res.end('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/preview.js"></script></body></html>');}
  });
  server.listen(0,"127.0.0.1",()=>console.log("Notification preview http://127.0.0.1:"+server.address().port));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
