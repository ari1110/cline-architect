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
    private currentGenerationStats: Partial<ModelUsageStats> = {}

    constructor(initialChanges?: ModelChange[]) {
        if (initialChanges) {
            this.changes = [...initialChanges]
        }
    }

    private resetCurrentGenerationStats() {
        this.currentGenerationStats = {}
    }

    /**
     * Updates usage statistics for a model at a specific timestamp.
     * Important: Stats are only updated if they belong to the model that was active at the given timestamp.
     * This ensures delayed stats (like OpenRouter's generation details) are attributed to the correct model
     * period, even if they arrive after switching to a different model.
     */
    updateUsageStats(timestamp: number, stats: Partial<ModelUsageStats & { timestamp?: number }>) {
        // Use the provided timestamp from stats if available (e.g. from OpenRouter's delayed stats),
        // otherwise fall back to the passed timestamp
        const effectiveTimestamp = stats.timestamp || timestamp
        
        // Find which model was active at this timestamp
        const modelAtTimestamp = this.changes.find(change => 
            change.startTs <= effectiveTimestamp && 
            (!change.endTs || change.endTs > effectiveTimestamp)
        )
        
        if (!modelAtTimestamp) {return}

        // Initialize usage if needed
        if (!modelAtTimestamp.usage) {
            modelAtTimestamp.usage = {
                tokensIn: 0,
                tokensOut: 0,
                cost: 0
            }
        }
        
        // If we get cost or totalCost, this is the final generation stats
        if (stats.cost !== undefined || 'totalCost' in stats) {
            // Reset current generation stats and use the final values
            this.resetCurrentGenerationStats()
            // Set the values directly instead of adding to them
            modelAtTimestamp.usage.tokensIn = stats.tokensIn || 0
            modelAtTimestamp.usage.tokensOut = stats.tokensOut || 0
            modelAtTimestamp.usage.cost = stats.cost || (stats as any).totalCost || 0
            if (stats.cacheWrites !== undefined) {
                modelAtTimestamp.usage.cacheWrites = stats.cacheWrites
            }
            if (stats.cacheReads !== undefined) {
                modelAtTimestamp.usage.cacheReads = stats.cacheReads
            }
        } else {
            // Accumulate intermediate stats until we get final values
            this.currentGenerationStats.tokensIn = (this.currentGenerationStats.tokensIn || 0) + (stats.tokensIn || 0)
            this.currentGenerationStats.tokensOut = (this.currentGenerationStats.tokensOut || 0) + (stats.tokensOut || 0)
        }
    }

    /**
     * Gets usage stats for all models by taking a snapshot of each model's most recent usage.
     * Important: This does NOT recalculate or accumulate stats. For each model, it only uses
     * the most recent usage numbers, completely ignoring any older usage stats for that model.
     * This ensures that switching models does not affect the previous model's stats.
     */
    getModelStats(): Record<string, ModelUsageStats> {
        const stats: Record<string, ModelUsageStats> = {}
        
        // Process changes in reverse order (newest to oldest)
        for (let i = this.changes.length - 1; i >= 0; i--) {
            const change = this.changes[i]
            const key = `${change.modelProvider}/${change.modelId}`
            
            // Skip if we already have stats for this model (ensures we only use the most recent)
            // This prevents older usage stats from affecting the numbers we've already recorded
            if (!stats[key] && change.usage) {
                stats[key] = {
                    tokensIn: change.usage.tokensIn || 0,
                    tokensOut: change.usage.tokensOut || 0,
                    cost: change.usage.cost || 0
                }
                
                // Add cache stats if present
                if (change.usage.cacheWrites !== undefined) {
                    stats[key].cacheWrites = change.usage.cacheWrites
                }
                if (change.usage.cacheReads !== undefined) {
                    stats[key].cacheReads = change.usage.cacheReads
                }
            }
        }
        
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
