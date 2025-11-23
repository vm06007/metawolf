import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { BalanceChart, BalanceChartProps } from '../components/BalanceChart';

/**
 * Render a React chart component into a DOM container
 * This allows us to use Recharts in vanilla TypeScript
 */
export function renderRechartsChart(
    containerId: string,
    props: BalanceChartProps
): () => void {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`[renderRechartsChart] Container ${containerId} not found`);
        return () => {};
    }

    // Clear existing content
    container.innerHTML = '';

    // Create a root div for React
    const rootDiv = document.createElement('div');
    rootDiv.style.width = '100%';
    rootDiv.style.height = '100%';
    container.appendChild(rootDiv);

    // Render React component
    const root = createRoot(rootDiv);
    root.render(React.createElement(BalanceChart, props));

    // Return cleanup function
    return () => {
        root.unmount();
    };
}

