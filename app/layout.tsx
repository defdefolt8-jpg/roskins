import type {Metadata} from "next";
import "./globals.css";
export const metadata:Metadata={title:"Roskins — трейд-плаза Adopt Me",description:"Находи встречные предложения для обмена в Adopt Me. Выбери, что отдаёшь и что ищешь, договорись с игроком и обменяйся внутри игры.",icons:{icon:"/favicon.svg"}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>;}
