import Link from "next/link";

export default function NotFound() {
  return <main className="not-found"><div><strong>404</strong><h1>这个页面没有存档点</h1><p>链接可能已移动，或者你来到了地图边界。</p><Link className="primary-button" href="/">返回首页 <span>→</span></Link></div></main>;
}
