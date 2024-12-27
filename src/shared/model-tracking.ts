/**
 * Represents a model change during a conversation
 */
export interface ModelUsageStats {
    tokensIn: number
    tokensOut: number
    cacheWrites?: number
    cacheReads?: number
    cost: number
}

export interface ModelChange {
    modelId: string
    modelProvider: string
    startTs: number // Timestamp when this model became active
    endTs?: number  // Timestamp when this model was replaced (undefined if still active)
    usage?: ModelUsageStats // Usage statistics for this model during its active period
}

/**
 * Manages model changes and usage statistics during a conversation
 */
export class ModelTracker {
    private changes: ModelChange[] = []

    constructor(initialChanges?: ModelChange[]) {
        if (initialChanges) {
            this.changes = [...initialChanges]
        }
    }

    /**
     * Updates usage statistics for the currently active model.
     * Note: Usage stats are always attributed to the current model,
     * regardless of which model was active when the request was initiated.
     */
    updateUsageStats(timestamp: number, stats: Partial<ModelUsageStats>) {
        // Always attribute usage stats to the current active model
        const activeChange = this.changes[this.changes.length - 1]
        
        if (activeChange) {
            if (!activeChange.usage) {
                activeChange.usage = {
                    tokensIn: 0,
                    tokensOut: 0,
                    cost: 0
                }
            }
            
            activeChange.usage.tokensIn += stats.tokensIn || 0
            activeChange.usage.tokensOut += stats.tokensOut || 0
            if (stats.cacheWrites) {
                activeChange.usage.cacheWrites = (activeChange.usage.cacheWrites || 0) + stats.cacheWrites
            }
            if (stats.cacheReads) {
                activeChange.usage.cacheReads = (activeChange.usage.cacheReads || 0) + stats.cacheReads
            }
            activeChange.usage.cost += stats.cost || 0
        }
    }

    /**
     * Gets aggregated usage stats for all models
     */
    getModelStats(): Record<string, ModelUsageStats> {
        const stats: Record<string, ModelUsageStats> = {}
        
        this.changes.forEach(change => {
            if (change.usage) {
                const key = `${change.modelProvider}/${change.modelId}`
                if (!stats[key]) {
                    stats[key] = {
                        tokensIn: 0,
                        tokensOut: 0,
                        cost: 0
                    }
                }
                stats[key].tokensIn += change.usage.tokensIn
                stats[key].tokensOut += change.usage.tokensOut
                if (change.usage.cacheWrites) {
                    stats[key].cacheWrites = (stats[key].cacheWrites || 0) + change.usage.cacheWrites
                }
                if (change.usage.cacheReads) {
                    stats[key].cacheReads = (stats[key].cacheReads || 0) + change.usage.cacheReads
                }
                stats[key].cost += change.usage.cost
            }
        })
        
        return stats
    }
    
    /**
     * Records a model change in the conversation
     */
    addChange(modelId: string, modelProvider: string, timestamp: number) {
        // If there are existing changes, close the last one
        if (this.changes.length > 0) {
            const lastChange = this.changes[this.changes.length - 1]
            if (!lastChange.endTs) {
                lastChange.endTs = timestamp
            }
        }
        
        // Add the new change
        this.changes.push({
            modelId,
            modelProvider,
            startTs: timestamp
        })
    }

    /**
     * Gets the model info for a specific timestamp
     */
    getModelForTimestamp(timestamp: number): { modelId: string; modelProvider: string } | undefined {
        // Find the change that was active at this timestamp
        const activeChange = this.changes.find(change => 
            change.startTs <= timestamp && 
            (!change.endTs || change.endTs > timestamp)
        )
        
        if (activeChange) {
            return {
                modelId: activeChange.modelId,
                modelProvider: activeChange.modelProvider
            }
        }
        
        return undefined
    }

    /**
     * Gets all model changes in the conversation
     */
    getAllChanges(): ModelChange[] {
        return [...this.changes]
    }

    /**
     * Gets the currently active model
     */
    getCurrentModel(): { modelId: string; modelProvider: string } | undefined {
        const lastChange = this.changes[this.changes.length - 1]
        if (lastChange && !lastChange.endTs) {
            return {
                modelId: lastChange.modelId,
                modelProvider: lastChange.modelProvider
            }
        }
        return undefined
    }
}
