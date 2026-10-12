import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

function safeLink(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? url : '';
  } catch { return ''; }
}

export default function MathMarkdown({ text }: { text: string }) {
  return <div className="math-markdown">
    <ReactMarkdown skipHtml remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, {
      trust: false, throwOnError: false, strict: 'warn', maxExpand: 1000, maxSize: 20,
    }]]} urlTransform={safeLink} components={{
      a: ({ children, href }) => href ? <a href={safeLink(href)} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
      // AI-supplied remote URLs never cause automatic image fetches or tracking requests.
      img: ({ alt }) => <span className="ai-image-reference">{alt ? `[Ảnh: ${alt}]` : '[Ảnh trong phản hồi đã được bỏ qua]'}</span>,
    }}>{text.slice(0, 24_000)}</ReactMarkdown>
  </div>;
}
