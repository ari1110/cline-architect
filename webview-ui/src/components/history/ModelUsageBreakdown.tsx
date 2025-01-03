import React from 'react';
import { ModelChange } from '../../../../src/shared/model-tracking';
import { formatLargeNumber } from '../../utils/format';

type ModelUsageEntry = {
    modelProvider: string;
    modelId: string;
    usage: {
        cost: number;
        tokensIn: number;
        tokensOut: number;
        cacheWrites: number;
        cacheReads: number;
    }
};

type ModelUsageMap = Record<string, ModelUsageEntry>;

export interface ModelUsageBreakdownProps {
    modelChanges: ModelChange[];
    compact?: boolean;
}

export const calculateModelUsage = (modelChanges: ModelChange[]): ModelUsageEntry[] => {
    const modelUsage = modelChanges.reduce((acc: ModelUsageMap, change: ModelChange) => {
        if (!change.usage) return acc;
        
        const modelKey = `${change.modelProvider}-${change.modelId}`;
        
        if (!acc[modelKey]) {
            acc[modelKey] = {
                modelProvider: change.modelProvider,
                modelId: change.modelId,
                usage: {
                    cost: 0,
                    tokensIn: 0,
                    tokensOut: 0,
                    cacheWrites: 0,
                    cacheReads: 0
                }
            };
        }
        
        acc[modelKey].usage.cost += change.usage.cost;
        acc[modelKey].usage.tokensIn += change.usage.tokensIn;
        acc[modelKey].usage.tokensOut += change.usage.tokensOut;
        if (change.usage.cacheWrites) acc[modelKey].usage.cacheWrites += change.usage.cacheWrites;
        if (change.usage.cacheReads) acc[modelKey].usage.cacheReads += change.usage.cacheReads;
        
        return acc;
    }, {} as ModelUsageMap);

    return Object.values(modelUsage);
};

export const ModelUsageBreakdown: React.FC<ModelUsageBreakdownProps> = ({ modelChanges, compact = false }) => {
    const modelUsageEntries = calculateModelUsage(modelChanges);

    return (
        <div style={{ 
            ...(compact ? {} : {
                marginTop: 8,
                paddingTop: 8,
                borderTop: '1px solid var(--vscode-textBlockQuote-border)'
            })
        }}>
            {modelUsageEntries.map((entry) => (
                <div 
                    key={`${entry.modelProvider}-${entry.modelId}`}
                    style={{ 
                        marginTop: 4,
                        padding: compact ? "2px 6px" : "6px 10px",
                        backgroundColor: "var(--vscode-textBlockQuote-background)",
                        borderRadius: 3,
                        fontSize: "0.85em",
                        border: compact ? "none" : "1px solid var(--vscode-textBlockQuote-border)",
                        display: compact ? "flex" : "block",
                        justifyContent: compact ? "space-between" : "initial",
                        alignItems: compact ? "center" : "initial"
                    }}>
                    {compact ? (
                        <>
                            <span style={{ fontWeight: 500 }}>
                                {entry.modelProvider}/{entry.modelId}
                            </span>
                            <span>${entry.usage.cost.toFixed(4)}</span>
                        </>
                    ) : (
                        <>
                            <div style={{ 
                                display: "flex", 
                                justifyContent: "space-between",
                                marginBottom: 2
                            }}>
                                <span style={{ 
                                    fontWeight: 600,
                                    color: 'var(--vscode-textLink-foreground)',
                                    opacity: 0.8
                                }}>
                                    {entry.modelProvider}/{entry.modelId}
                                </span>
                                <span style={{ fontWeight: 500 }}>${entry.usage.cost.toFixed(4)}</span>
                            </div>
                            <div style={{ 
                                display: "flex", 
                                gap: 12, 
                                opacity: 0.7,
                                marginTop: 4
                            }}>
                                <span>↑{formatLargeNumber(entry.usage.tokensIn)} ↓{formatLargeNumber(entry.usage.tokensOut)}</span>
                                {!!entry.usage.cacheWrites && (
                                    <span>Cache: +{formatLargeNumber(entry.usage.cacheWrites)} → {formatLargeNumber(entry.usage.cacheReads || 0)}</span>
                                )}
                            </div>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
};

export default ModelUsageBreakdown;
