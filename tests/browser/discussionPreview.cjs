// Isolated browser harness: actual panel and CSS, synthetic users/messages, no live writes.
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const {pathToFileURL} = require("node:url");

async function main() {
  const root = path.resolve(__dirname, "../../frontend");
  const {build} = await import(pathToFileURL(path.join(root, "node_modules/vite/dist/node/index.js")).href);
  const component = path.join(root, "src/components/ProjectDiscussion.tsx").replaceAll("\\", "/");
  const entry = `import React from 'react'; import {createRoot} from 'react-dom/client'; import Discussion from '${component}';
    function App(){const [id,setId]=React.useState(null); const close=React.useCallback(()=>setId(null),[]);
      return <main style={{padding:40}}><h1>Isolated discussion verification</h1>
        <button onClick={()=>setId(1)}>Open active discussion</button><button onClick={()=>setId(2)}>Open archived discussion</button>
        {id&&<Discussion key={id} projectId={id} projectName="SmartTask Project" isArchived={id===2} onClose={close}/>}</main>}
    createRoot(document.getElementById('root')).render(<App/>);`;
  const fixture = `const messages=Array.from({length:5},(_,i)=>({messageId:i+1,projectId:1,authorId:i%2?2:1,
    authorName:i%2?'Team Member':'Administrator',body:i===4?'Ready for review. <b>This stays plain text.</b>':'Project update '+(i+1),createdAt:'2026-10-26T07:00:00Z'}));
    export async function getDiscussion(id,signal,before){return {messages:before?messages.slice(0,2):messages.slice(2),nextBefore:before?null:3,isArchived:id===2}};
    export async function sendDiscussionMessage(id,body){const message={messageId:messages.length+1,projectId:id,authorId:1,authorName:'Administrator',body,createdAt:new Date().toISOString()};messages.push(message);return message}`;
  const output = await build({configFile: false, root, logLevel: "error", build: {write: false, minify: false, rolldownOptions: {input: "virtual:discussion-preview"}},
    plugins: [{name: "discussion-fixture", enforce: "pre", resolveId(id) {
      if (["virtual:discussion-preview", "../services/discussionApi", "../context/AuthContext"].includes(id)) return "\0" + id;
    }, load(id) {
      if (id === "\0virtual:discussion-preview") return {code: entry, moduleType: "tsx"};
      if (id === "\0../services/discussionApi") return fixture;
      if (id === "\0../context/AuthContext") return "export function useAuth(){return {user:{userId:1,role:'ADMIN'}}}";
    }}]});
  const code = output.output.find(item => item.type === "chunk").code;
  const assets = path.join(root, "dist/assets");
  const css = fs.readFileSync(path.join(assets, fs.readdirSync(assets).find(name => name.endsWith(".css"))));
  const server = http.createServer((req, res) => {
    if (req.url === "/preview.js") {res.setHeader("Content-Type", "text/javascript"); res.end(code);}
    else if (req.url === "/style.css") {res.setHeader("Content-Type", "text/css"); res.end(css);}
    else {res.setHeader("Content-Type", "text/html"); res.end('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/preview.js"></script></body></html>');}
  });
  server.listen(0, "127.0.0.1", () => console.log("Discussion preview http://127.0.0.1:" + server.address().port));
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
