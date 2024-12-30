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
            
            // Set the token counts and cost directly from the stats
            if (stats.tokensIn !== undefined) {activeChange.usage.tokensIn = stats.tokensIn}
            if (stats.tokensOut !== undefined) {activeChange.usage.tokensOut = stats.tokensOut}
            if (stats.cacheWrites !== undefined) {activeChange.usage.cacheWrites = stats.cacheWrites}
            if (stats.cacheReads !== undefined) {activeChange.usage.cacheReads = stats.cacheReads}
            if (stats.cost !== undefined) {activeChange.usage.cost = stats.cost}
        }
    }

    /**
     * Gets aggregated usage stats for all models
     */
    getModelStats(): Record<string, ModelUsageStats> {
        const stats: Record<string, ModelUsageStats> = {}
        
        // Group changes by model and accumulate stats for each period the model was active
        let currentPeriod: { [key: string]: ModelUsageStats } = {}
        
        this.changes.forEach((change, index) => {
            const key = `${change.modelProvider}/${change.modelId}`
            
            // If this is a new model period, initialize its stats
            if (!currentPeriod[key]) {
                currentPeriod[key] = {
                    tokensIn: 0,
                    tokensOut: 0,
                    cost: 0
                }
            }
            
            // Add any usage stats from this period
            if (change.usage) {
                currentPeriod[key].tokensIn += change.usage.tokensIn || 0
                currentPeriod[key].tokensOut += change.usage.tokensOut || 0
                currentPeriod[key].cost += change.usage.cost || 0
                if (change.usage.cacheWrites !== undefined) {
                    currentPeriod[key].cacheWrites = (currentPeriod[key]?.cacheWrites ?? 0) + (change.usage.cacheWrites ?? 0)
                }
                if (change.usage.cacheReads !== undefined) {
                    currentPeriod[key].cacheReads = (currentPeriod[key]?.cacheReads ?? 0) + (change.usage.cacheReads ?? 0)
                }
            }
            
            // If this model period is ending (next change is different model or this is the last change)
            const nextChange = this.changes[index + 1]
            if (!nextChange || nextChange.modelId !== change.modelId || nextChange.modelProvider !== change.modelProvider) {
                // Add this period's stats to the total for this model
                if (!stats[key]) {
                    stats[key] = {
                        tokensIn: 0,
                        tokensOut: 0,
                        cost: 0
                    }
                }
                if (currentPeriod[key]) {
                    stats[key].tokensIn += currentPeriod[key].tokensIn
                    stats[key].tokensOut += currentPeriod[key].tokensOut
                    stats[key].cost += currentPeriod[key].cost
                    if (currentPeriod[key].cacheWrites !== undefined) {
                        stats[key] = stats[key] || {};
                        stats[key].cacheWrites = (stats[key]?.cacheWrites ?? 0) + (currentPeriod[key]?.cacheWrites ?? 0);
                    }
                    if (currentPeriod[key].cacheReads !== undefined) {
                        stats[key] = stats[key] || {};
                        stats[key].cacheReads = (stats[key]?.cacheReads ?? 0) + (currentPeriod[key]?.cacheReads ?? 0);
                    }
                }
                // Reset the current period for this model
                delete currentPeriod[key]
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
