"use client";

import { useState } from "react";

type Tab = "React" | "Angular" | "CSS" | "Sass";

const codeSnippets = {
    React: `import React from "react";
class Component extends React.Component {
  render() {
    return (
      <div>
        <h1>codepunk</h1>
        <p>This is a simple React
component.</p>
      </div>
    );
  }
}

export default codepunk;`,
    Angular: `import { Component } from '@angular/core';

@Component({
  selector: 'app-codepunk',
  template: \`
    <div>
      <h1>codepunk</h1>
      <p>This is an Angular component</p>
    </div>
  \`
})
export class CodepunkComponent { }`,
    CSS: `.codepunk {
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: #1a1a1a;
  border-radius: 8px;
}

.codepunk h1 {
  color: #adff85;
  font-size: 24px;
  margin-bottom: 16px;
}`,
    Sass: `$primary-color: #adff85;
$background-color: #1a1a1a;

.codepunk {
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: $background-color;
  border-radius: 8px;
  
  h1 {
    color: $primary-color;
    font-size: 24px;
    margin-bottom: 16px;
  }
}`
};

export function CodeEditor() {
    const [activeTab, setActiveTab] = useState<Tab>("React");

    return (
        <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-800">
                {(Object.keys(codeSnippets) as Tab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-3 text-sm font-medium transition-colors ${
                            activeTab === tab
                                ? "bg-[#2a2a2a] text-white border-b-2 border-[#adff85]"
                                : "text-gray-400 hover:text-white hover:bg-[#2a2a2a]"
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Code Content */}
            <div className="p-6">
                <pre className="text-sm text-gray-300 font-mono leading-relaxed overflow-x-auto">
                    <code className="language-javascript">
                        {codeSnippets[activeTab].split('\n').map((line, index) => (
                            <div key={index} className="flex">
                                <span className="text-gray-600 select-none w-8 text-right mr-4 flex-shrink-0">
                                    {index + 1}
                                </span>
                                <span className="flex-1">
                                    <SyntaxHighlightedLine line={line} />
                                </span>
                            </div>
                        ))}
                    </code>
                </pre>
            </div>

            {/* Documentation Footer */}
            <div className="border-t border-gray-800 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <span>Documentation</span>
                    <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 8l4 4m0 0l-4 4m4-4H3"
                        />
                    </svg>
                </div>
                <button className="text-gray-400 hover:text-white transition-colors">
                    <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
}

function SyntaxHighlightedLine({ line }: { line: string }) {
    // Simple client-side syntax highlighting using React components
    const tokens = tokenizeLine(line);
    
    return (
        <>
            {tokens.map((token, index) => (
                <span key={index} className={getTokenClass(token.type)}>
                    {token.value}
                </span>
            ))}
        </>
    );
}

function tokenizeLine(line: string) {
    const tokens: Array<{ type: string; value: string }> = [];
    const keywords = /\b(import|export|class|function|const|let|var|return|from|extends|default|render)\b/g;
    const strings = /"([^"]*)"/g;
    const components = /\b(React|Component|div|h1|p)\b/g;
    const numbers = /\b(\d+)\b/g;
    const brackets = /[{}()[\]]/g;
    const comments = /\/\*[\s\S]*?\*\/|\/\/.*$/g;
    
    let lastIndex = 0;
    const matches: Array<{ index: number; length: number; type: string }> = [];
    
    // Find all matches
    let match;
    while ((match = keywords.exec(line)) !== null) {
        matches.push({ index: match.index, length: match[0].length, type: 'keyword' });
    }
    while ((match = strings.exec(line)) !== null) {
        matches.push({ index: match.index, length: match[0].length, type: 'string' });
    }
    while ((match = components.exec(line)) !== null) {
        matches.push({ index: match.index, length: match[0].length, type: 'component' });
    }
    while ((match = numbers.exec(line)) !== null) {
        matches.push({ index: match.index, length: match[0].length, type: 'number' });
    }
    while ((match = brackets.exec(line)) !== null) {
        matches.push({ index: match.index, length: match[0].length, type: 'bracket' });
    }
    while ((match = comments.exec(line)) !== null) {
        matches.push({ index: match.index, length: match[0].length, type: 'comment' });
    }
    
    // Sort matches by index
    matches.sort((a, b) => a.index - b.index);
    
    // Build tokens
    matches.forEach((match) => {
        if (match.index > lastIndex) {
            tokens.push({
                type: 'text',
                value: line.slice(lastIndex, match.index)
            });
        }
        tokens.push({
            type: match.type,
            value: line.slice(match.index, match.index + match.length)
        });
        lastIndex = match.index + match.length;
    });
    
    // Add remaining text
    if (lastIndex < line.length) {
        tokens.push({
            type: 'text',
            value: line.slice(lastIndex)
        });
    }
    
    // If no matches, return the whole line as text
    if (tokens.length === 0) {
        tokens.push({ type: 'text', value: line });
    }
    
    return tokens;
}

function getTokenClass(type: string): string {
    switch (type) {
        case 'keyword':
            return 'text-red-400';
        case 'string':
            return 'text-green-400';
        case 'component':
            return 'text-blue-400';
        case 'number':
            return 'text-yellow-400';
        case 'bracket':
            return 'text-purple-400';
        case 'comment':
            return 'text-gray-500';
        default:
            return 'text-gray-300';
    }
}


