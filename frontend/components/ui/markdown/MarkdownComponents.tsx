'use client';

import type { Components } from 'react-markdown';
import { CodeText, PreBlock } from './CodeBlock';
import { hrStyle, linkStyle, quoteStyle, tableStyle, tableWrapStyle, tdStyle, thStyle } from './styles';

export const markdownComponents: Components = {
  pre: PreBlock,
  code: CodeText,
  a: ({ node: _node, children, ...props }) => (
    <a {...props} target="_blank" rel="noreferrer" style={linkStyle}>
      {children}
    </a>
  ),
  table: ({ node: _node, children, ...props }) => (
    <div style={tableWrapStyle}>
      <table {...props} style={tableStyle}>
        {children}
      </table>
    </div>
  ),
  th: ({ node: _node, children, ...props }) => (
    <th {...props} style={thStyle}>
      {children}
    </th>
  ),
  td: ({ node: _node, children, ...props }) => (
    <td {...props} style={tdStyle}>
      {children}
    </td>
  ),
  blockquote: ({ node: _node, children, ...props }) => (
    <blockquote {...props} style={quoteStyle}>
      {children}
    </blockquote>
  ),
  hr: () => <hr style={hrStyle} />,
};
