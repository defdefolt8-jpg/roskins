import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const file=existsSync('.next/standalone/server.js')?'.next/standalone/server.js':'node_modules/next/dist/bin/next';
const args=file.endsWith('server.js')?[file]:[file,'start','-H','0.0.0.0','-p',process.env.PORT||'3000'];
const child=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,HOSTNAME:'0.0.0.0',NEXT_TELEMETRY_DISABLED:'1'},windowsHide:true});
child.on('exit',code=>process.exit(code??1));
