import type {Metadata} from "next";
import "./globals.css";
export const metadata:Metadata={title:"roskins — предметы Roblox",description:"roskins — площадка объявлений игровых предметов. Покупай и продавай другим игрокам.",icons:{icon:"/favicon.svg"}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>;}
