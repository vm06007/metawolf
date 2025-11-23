import React, { useRef, useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import type { HistoricalBalancePoint } from '../services/transactions-service';

export interface BalanceChartProps {
    data: HistoricalBalancePoint[];
    width?: number;
    height?: number;
    color?: string;
    gradientId?: string;
    onHover?: (data: { timestamp: number; balance: number; visible: boolean }) => void;
}

export const BalanceChart: React.FC<BalanceChartProps> = ({
    data,
    width = 300,
    height = 60,
    color = '#27C193',
    gradientId = 'chartGradient',
    onHover,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(width);

    useEffect(() => {
        if (containerRef.current) {
            setContainerWidth(containerRef.current.clientWidth || width);
        }
    }, [width]);

    if (!data || data.length === 0) {
        return null;
    }

    // Transform data for Recharts (timestamp should be in seconds for Recharts)
    const chartData = data.map(point => ({
        timestamp: point.timestamp / 1000, // Convert to seconds
        value: point.balance,
        balance: point.balance,
    }));

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const formatBalance = (balance: number) => {
        if (balance < 0.01) return '<$0.01';
        if (balance < 1000) return `$${balance.toFixed(2)}`;
        if (balance < 1000000) return `$${(balance / 1000).toFixed(2)}K`;
        return `$${(balance / 1000000).toFixed(2)}M`;
    };

    return (
        <div ref={containerRef} style={{ width: '100%', height, position: 'relative' }}>
            <AreaChart
                data={chartData}
                width={containerWidth}
                height={height}
                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                onMouseMove={(val: any) => {
                    if (val?.activePayload && onHover) {
                        const payload = val.activePayload[0]?.payload;
                        if (payload) {
                            onHover({
                                timestamp: payload.timestamp * 1000,
                                balance: payload.balance,
                                visible: true,
                            });
                        }
                    }
                }}
                onMouseLeave={() => {
                    if (onHover) {
                        onHover({
                            timestamp: 0,
                            balance: 0,
                            visible: false,
                        });
                    }
                }}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <XAxis
                    dataKey="timestamp"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    hide
                />
                <YAxis
                    hide
                    domain={[
                        (dataMin: number) => dataMin * 0.98,
                        (dataMax: number) => dataMax * 1.005,
                    ]}
                />
                <Tooltip
                    cursor={{ strokeDasharray: '2 2', strokeWidth: 0.6 }}
                    content={({ active, payload, label }: any) => {
                        if (active && payload && payload.length) {
                            return (
                                <div style={{
                                    background: 'rgba(0, 0, 0, 0.9)',
                                    color: 'white',
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                }}>
                                    {formatTime(label)} - {formatBalance(payload[0].value)}
                                </div>
                            );
                        }
                        return null;
                    }}
                />
                <Area
                    type="linear"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    fillOpacity={0.8}
                    animationDuration={0}
                />
            </AreaChart>
        </div>
    );
};

