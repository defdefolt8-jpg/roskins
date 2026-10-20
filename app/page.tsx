import Script from "next/script";
import {markup} from "./markup";
export const dynamic = "force-dynamic";
export default function Page(){return <><div dangerouslySetInnerHTML={{__html:markup}}/><Script src="/market.js" strategy="afterInteractive"/></>;}
