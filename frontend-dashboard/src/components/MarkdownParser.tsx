import React from 'react';

/**
 * Memformat teks dengan gaya inline:
 * - Mengubah teks yang diapit oleh double asterisks (**) menjadi elemen <strong>.
 * - Mengubah teks yang diapit backticks (`) menjadi elemen <code> untuk inline code.
 */
export function formatInlineStyles(text: string): (string | React.JSX.Element)[] {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, idx) => {
    // Jika teks diapit double asterisks, buat tebal (bold)
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} className="font-bold text-on-surface">{part.slice(2, -2)}</strong>;
    }
    // Jika teks diapit backticks, buat bergaya monospaced (code inline)
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={idx} className="bg-surface-container-highest px-1.5 py-0.5 rounded text-secondary font-code-sm text-xs">{part.slice(1, -1)}</code>;
    }
    // Jika teks biasa, kembalikan string mentah
    return part;
  });
}

/**
 * Parser Markdown ringan untuk merender output Gemini AI secara berstruktur.
 * Mendukung pembagian paragraf, heading (#, ##, ###), bullet lists (-, *), dan blok kode (```).
 */
export function parseMarkdown(text: string): (React.JSX.Element | null)[] | null {
  if (!text) return null;
  
  // Pisahkan teks menjadi beberapa blok berdasarkan baris kosong ganda
  const blocks = text.split(/\n\n+/);
  
  return blocks.map((block, bIdx) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // 1. Blok Kode: Jika teks diawali dengan triple backticks (```)
    if (trimmed.startsWith('```')) {
      const lines = trimmed.split('\n');
      const codeLines = lines.slice(1, lines.length - 1).join('\n');
      return (
        <div key={bIdx} className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/20 font-code-sm text-secondary-fixed text-xs overflow-x-auto my-2">
          <pre><code>{codeLines}</code></pre>
        </div>
      );
    }

    // 2. Headings: Jika teks diawali tanda pagar (#)
    if (trimmed.startsWith('#')) {
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const content = trimmed.replace(/^#+\s*/, '');
      const formatted = formatInlineStyles(content);
      
      if (level === 1) return <h1 key={bIdx} className="text-xl font-bold text-on-surface mt-4 mb-2 border-b border-outline-variant/20 pb-1">{formatted}</h1>;
      if (level === 2) return <h2 key={bIdx} className="text-lg font-bold text-primary mt-3 mb-1.5">{formatted}</h2>;
      return <h3 key={bIdx} className="text-md font-semibold text-primary mt-2 mb-1">{formatted}</h3>;
    }

    // 3. Bullet Lists: Jika teks diawali tanda strip (-), bintang (*), atau format angka (1.)
    if (trimmed.startsWith('*') || trimmed.startsWith('-') || /^\d+\./.test(trimmed)) {
      const lines = trimmed.split('\n');
      return (
        <ul key={bIdx} className="list-disc pl-md space-y-1.5 my-2 text-on-surface-variant text-sm">
          {lines.map((line, lIdx) => {
            const content = line.replace(/^[-*\d.]+\s*/, '');
            return (
              <li key={lIdx} className="leading-relaxed">
                {formatInlineStyles(content)}
              </li>
            );
          })}
        </ul>
      );
    }

    // 4. Paragraf biasa
    return (
      <p key={bIdx} className="leading-relaxed text-sm my-2 text-on-surface-variant text-justify">
        {formatInlineStyles(trimmed)}
      </p>
    );
  });
}

/**
 * Ekstrak potongan blok kode (code block) pertama dari respon Gemini AI
 * yang diapit oleh triple backticks. Berguna untuk mendeteksi auto-fix usulan kode perbaikan.
 */
export function extractFirstCodeBlock(text: string): string | null {
  const match = text.match(/```(?:python|javascript|code)?\n([\s\S]*?)\n```/);
  return match ? match[1].trim() : null;
}
