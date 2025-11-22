import type { HistoricalBalancePoint } from '../services/transactions-service';

export interface ChartHoverData {
    timestamp: number;
    balance: number;
    visible: boolean;
}

export interface BalanceChartOptions {
    width?: number;
    height?: number;
    color?: string;
    gradientId?: string;
    onHover?: (data: ChartHoverData) => void;
}

/**
 * Render an interactive balance chart as SVG
 */
export function renderBalanceChart(
    data: HistoricalBalancePoint[],
    containerId: string,
    options: BalanceChartOptions = {}
): void {
    const {
        width = 300,
        height = 60,
        color = '#27C193',
        gradientId = 'chartGradient',
        onHover,
    } = options;

    if (!data || data.length === 0) {
        return;
    }

    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`[renderBalanceChart] Container ${containerId} not found`);
        return;
    }

    // Clear existing content
    container.innerHTML = '';

    // Calculate min/max for scaling
    const balances = data.map(d => d.balance);
    const minBalance = Math.min(...balances);
    const maxBalance = Math.max(...balances);
    const range = maxBalance - minBalance || 1; // Avoid division by zero

    // Padding for the chart
    const padding = { top: 4, right: 4, bottom: 4, left: 4 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', `${height}`);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cursor = 'crosshair';

    // Create defs for gradient
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '0%');
    gradient.setAttribute('y2', '100%');
    
    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('style', `stop-color: ${color}; stop-opacity: 0.3`);
    
    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('style', `stop-color: ${color}; stop-opacity: 0`);
    
    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    svg.appendChild(defs);

    // Convert data points to SVG coordinates
    const points: { x: number; y: number; data: HistoricalBalancePoint }[] = data.map((point, index) => {
        const x = padding.left + (index / (data.length - 1)) * chartWidth;
        const y = padding.top + chartHeight - ((point.balance - minBalance) / range) * chartHeight;
        return { x, y, data: point };
    });

    // Create path for the line
    let pathData = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        
        // Use smooth curves (quadratic bezier)
        const cpX = (prev.x + curr.x) / 2;
        pathData += ` Q ${cpX} ${prev.y} ${curr.x} ${curr.y}`;
    }

    // Create area path (for gradient fill)
    const areaPath = pathData + 
        ` L ${points[points.length - 1].x} ${height - padding.bottom}` +
        ` L ${points[0].x} ${height - padding.bottom} Z`;

    // Add area (gradient fill)
    const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    area.setAttribute('d', areaPath);
    area.setAttribute('fill', `url(#${gradientId})`);
    svg.appendChild(area);

    // Add line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', pathData);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(line);

    // Create invisible hover area
    const hoverArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hoverArea.setAttribute('x', String(padding.left));
    hoverArea.setAttribute('y', String(padding.top));
    hoverArea.setAttribute('width', String(chartWidth));
    hoverArea.setAttribute('height', String(chartHeight));
    hoverArea.setAttribute('fill', 'transparent');
    hoverArea.style.cursor = 'crosshair';
    svg.appendChild(hoverArea);

    // Create hover indicator (circle and vertical line)
    const hoverGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    hoverGroup.setAttribute('id', `${containerId}-hover-group`);
    hoverGroup.style.display = 'none';
    hoverGroup.style.pointerEvents = 'none';

    const hoverLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hoverLine.setAttribute('stroke', 'rgba(255, 255, 255, 0.5)');
    hoverLine.setAttribute('stroke-width', '1');
    hoverLine.setAttribute('stroke-dasharray', '2 2');
    hoverGroup.appendChild(hoverLine);

    const hoverCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hoverCircle.setAttribute('r', '4');
    hoverCircle.setAttribute('fill', color);
    hoverCircle.setAttribute('stroke', 'white');
    hoverCircle.setAttribute('stroke-width', '2');
    hoverGroup.appendChild(hoverCircle);

    svg.appendChild(hoverGroup);

    // Add hover event listeners
    let currentHoverIndex: number | null = null;

    const updateHover = (clientX: number, clientY?: number) => {
        const rect = svg.getBoundingClientRect();
        const x = clientX - rect.left;
        
        // Find the closest data point
        let closestIndex = 0;
        let minDistance = Math.abs(x - points[0].x);
        
        for (let i = 1; i < points.length; i++) {
            const distance = Math.abs(x - points[i].x);
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
            }
        }

        const point = points[closestIndex];
        
        // Update hover indicator
        hoverLine.setAttribute('x1', String(point.x));
        hoverLine.setAttribute('y1', String(padding.top));
        hoverLine.setAttribute('x2', String(point.x));
        hoverLine.setAttribute('y2', String(height - padding.bottom));
        
        hoverCircle.setAttribute('cx', String(point.x));
        hoverCircle.setAttribute('cy', String(point.y));
        
        hoverGroup.style.display = 'block';
        currentHoverIndex = closestIndex;

        // Call onHover callback with mouse position for tooltip
        if (onHover) {
            onHover({
                timestamp: point.data.timestamp,
                balance: point.data.balance,
                visible: true,
            });
        }

        // Update tooltip position if it exists
        const tooltip = document.getElementById(`${containerId}-tooltip`);
        if (tooltip && clientY !== undefined) {
            const containerRect = container.getBoundingClientRect();
            const x = clientX - containerRect.left;
            const y = clientY - containerRect.top;
            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y - 35}px`; // Position above the cursor
        }
    };

    const hideHover = () => {
        hoverGroup.style.display = 'none';
        currentHoverIndex = null;
        
        if (onHover) {
            onHover({
                timestamp: 0,
                balance: 0,
                visible: false,
            });
        }
    };

    hoverArea.addEventListener('mousemove', (e) => {
        updateHover(e.clientX, e.clientY);
    });

    hoverArea.addEventListener('mouseleave', () => {
        hideHover();
    });

    svg.addEventListener('mousemove', (e) => {
        const rect = svg.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
            updateHover(e.clientX, e.clientY);
        } else {
            hideHover();
        }
    });

    container.appendChild(svg);
}

/**
 * Format timestamp for display
 */
export function formatChartTime(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Format balance for display
 */
export function formatChartBalance(balance: number): string {
    if (balance < 0.01) return '<$0.01';
    if (balance < 1000) return `$${balance.toFixed(2)}`;
    if (balance < 1000000) return `$${(balance / 1000).toFixed(2)}K`;
    return `$${(balance / 1000000).toFixed(2)}M`;
}

