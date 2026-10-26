import { cp, mkdir, copyFile } from 'node:fs/promises';
await mkdir('.next/standalone/.next/static',{recursive:true});
await cp('.next/static','.next/standalone/.next/static',{recursive:true});
await cp('public','.next/standalone/public',{recursive:true});
console.log('Standalone server and public assets packaged.');
