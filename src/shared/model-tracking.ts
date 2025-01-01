import { ClineMessage, ClineApiReqInfo } from "./ExtensionMessage"
import { findLast } from "./array"

/**
 * Represents usage statistics for a model or task
 */
export interface ModelUsageStats {
    tokensIn: number
    tokensOut: number
    cacheWrites?: number
    cacheReads?: number
    cost: number
}

/**
 * Represents a model usage period during a task
 */
export interface ModelChange {
    modelId: string
    modelProvider: string
    startTs: number // Timestamp when this model became active
    endTs?: number  // Timestamp when this model was replaced (undefined if still active)
    usage: ModelUsageStats // Usage statistics for this model during its active period
}

/**
 * OpenRouter generation details format
 */
interface OpenRouterStats {
    id: string
    model: string
    total_cost: number
    tokens_prompt: number
    tokens_completion: number
    created_at: string
}

/**
 * Manages model changes and usage statistics during a task.
 * Uses a top-down approach where task totals are the source of truth,
 * and per-model stats are tracked as portions of these totals.
 */
/**
 * Gets a ModelTracker instance from an array of ClineMessages.
 * 
 * This function finds the latest api_req_started message that contains model changes
 * and creates a ModelTracker instance from those changes.
 */
export function getModelTracker(messages: ClineMessage[]): ModelTracker {
    console.log('getModelTracker called with messages:', messages.map(m => ({
        type: m.type,
        say: m.say,
        ts: new Date(m.ts).toISOString()
    })))
    
    // Find all api_req_started messages to accumulate all model changes
    const allModelChanges: ModelChange[] = []
    
    for (const message of messages) {
        if (message.type === "say" && 
            message.say === "api_req_started" && 
            message.text !== undefined) {
            try {
                const parsedData = JSON.parse(message.text) as ClineApiReqInfo
                console.log('Processing api_req_started:', {
                    ts: new Date(message.ts).toISOString(),
                    modelChanges: parsedData.modelChanges?.map(c => ({
                        model: `${c.modelProvider}/${c.modelId}`,
                        startTs: new Date(c.startTs).toISOString(),
                        endTs: c.endTs ? new Date(c.endTs).toISOString() : undefined,
                        usage: c.usage
                    }))
                })
                
                if (parsedData.modelChanges) {
                    // Add any new model changes that aren't already in the list
                    parsedData.modelChanges.forEach(change => {
                        const exists = allModelChanges.some(
                            existing => 
                                existing.modelId === change.modelId && 
                                existing.modelProvider === change.modelProvider && 
                                existing.startTs === change.startTs
                        )
                        if (!exists) {
                            allModelChanges.push(change)
                        }
                    })
                }
            } catch (error) {
                console.error("Error parsing JSON:", error)
            }
        }
    }

    console.log('Creating ModelTracker with changes:', allModelChanges.map(c => ({
        model: `${c.modelProvider}/${c.modelId}`,
        startTs: new Date(c.startTs).toISOString(),
        endTs: c.endTs ? new Date(c.endTs).toISOString() : undefined,
        usage: c.usage
    })))
    
    return new ModelTracker(allModelChanges)
}

export class ModelTracker {
    private changes: ModelChange[] = []
    private taskTotals: ModelUsageStats = {
        tokensIn: 0,
        tokensOut: 0,
        cost: 0,
        cacheWrites: 0,
        cacheReads: 0
    }
    private currentGenerationStats: Partial<ModelUsageStats> = {}
    private processedRequests: Set<string> = new Set()

    constructor(initialChanges?: ModelChange[]) {
        if (initialChanges) {
            this.changes = [...initialChanges]
            // Calculate initial task totals from changes
            this.taskTotals = this.calculateTaskTotals(initialChanges)
        }
    }

    private calculateTaskTotals(changes: ModelChange[]): ModelUsageStats {
        return changes.reduce((totals, change) => ({
            tokensIn: totals.tokensIn + (change.usage?.tokensIn || 0),
            tokensOut: totals.tokensOut + (change.usage?.tokensOut || 0),
            cost: totals.cost + (change.usage?.cost || 0),
            cacheWrites: (totals.cacheWrites || 0) + (change.usage?.cacheWrites || 0),
            cacheReads: (totals.cacheReads || 0) + (change.usage?.cacheReads || 0)
        }), {
            tokensIn: 0,
            tokensOut: 0,
            cost: 0,
            cacheWrites: 0,
            cacheReads: 0
        })
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
    updateUsageStats(timestamp: number, stats: Partial<ModelUsageStats & { timestamp?: number } & OpenRouterStats>) {
        const requestStartTime = stats.timestamp || timestamp

        // Skip if we've already processed this request
        if (stats.id && this.processedRequests.has(stats.id)) {
            return
        }
        if (stats.id) {
            this.processedRequests.add(stats.id)
        }

        // Find which model period this request belongs to
        const modelForRequest = this.changes.find(change => {
            const belongsToThisPeriod = change.startTs <= requestStartTime && 
                (!change.endTs || change.endTs > requestStartTime)
            
            // For OpenRouter responses, match just the model part after the provider
            if ('model' in stats && stats.model) {
                const openRouterModel = stats.model;
                const changeModel = `${change.modelProvider}/${change.modelId}`;
                return belongsToThisPeriod && changeModel.endsWith(openRouterModel);
            }
            
            return belongsToThisPeriod
        })

        // If we get total_cost, this is the final generation stats from OpenRouter
        if ('total_cost' in stats && 'model' in stats) {
            // Model matching is now handled in the find() above
            if (modelForRequest) {
                // Reset current generation stats and use the final values
                this.resetCurrentGenerationStats()
                
                // Update task totals (the source of truth)
                const oldTotals = { ...this.taskTotals }
                this.taskTotals.tokensIn += stats.tokens_prompt || 0
                this.taskTotals.tokensOut += stats.tokens_completion || 0
                // Use total_cost from OpenRouter as our cost value
                const cost = stats.total_cost || 0
                this.taskTotals.cost += cost
                if (stats.cacheWrites !== undefined) {
                    this.taskTotals.cacheWrites = (this.taskTotals.cacheWrites || 0) + stats.cacheWrites
                }
                if (stats.cacheReads !== undefined) {
                    this.taskTotals.cacheReads = (this.taskTotals.cacheReads || 0) + stats.cacheReads
                }

                // Initialize usage if needed
                if (!modelForRequest.usage) {
                    modelForRequest.usage = {
                        tokensIn: 0,
                        tokensOut: 0,
                        cost: 0,
                        cacheWrites: 0,
                        cacheReads: 0
                    }
                }
                
                // Accumulate the model's stats with the API response
                modelForRequest.usage = {
                    tokensIn: (modelForRequest.usage?.tokensIn || 0) + (stats.tokens_prompt || 0),
                    tokensOut: (modelForRequest.usage?.tokensOut || 0) + (stats.tokens_completion || 0),
                    cost: (modelForRequest.usage?.cost || 0) + cost,
                    cacheWrites: (modelForRequest.usage?.cacheWrites || 0) + (stats.cacheWrites || 0),
                    cacheReads: (modelForRequest.usage?.cacheReads || 0) + (stats.cacheReads || 0)
                }

                console.log('Model stats updated:', {
                    model: `${modelForRequest.modelProvider}/${modelForRequest.modelId}`,
                    stats: modelForRequest.usage
                })
            }
        } else {
            // Update model stats with regular stats
            if (modelForRequest) {
                // Initialize usage if needed
                if (!modelForRequest.usage) {
                    modelForRequest.usage = {
                        tokensIn: 0,
                        tokensOut: 0,
                        cost: 0,
                        cacheWrites: 0,
                        cacheReads: 0
                    }
                }

                // Update the model's stats
                modelForRequest.usage = {
                    tokensIn: (modelForRequest.usage.tokensIn || 0) + (stats.tokensIn || 0),
                    tokensOut: (modelForRequest.usage.tokensOut || 0) + (stats.tokensOut || 0),
                    cost: (modelForRequest.usage.cost || 0) + (stats.cost || 0),
                    cacheWrites: (modelForRequest.usage.cacheWrites || 0) + (stats.cacheWrites || 0),
                    cacheReads: (modelForRequest.usage.cacheReads || 0) + (stats.cacheReads || 0)
                }

                // Update task totals
                this.taskTotals.tokensIn += stats.tokensIn || 0
                this.taskTotals.tokensOut += stats.tokensOut || 0
                this.taskTotals.cost += stats.cost || 0
                if (stats.cacheWrites !== undefined) {
                    this.taskTotals.cacheWrites = (this.taskTotals.cacheWrites || 0) + stats.cacheWrites
                }
                if (stats.cacheReads !== undefined) {
                    this.taskTotals.cacheReads = (this.taskTotals.cacheReads || 0) + stats.cacheReads
                }

            }
        }
    }

    /**
     * Gets the total usage stats for the entire task
     */
    getTaskTotals(): ModelUsageStats {
        return { ...this.taskTotals }
    }

    /**
     * Gets per-model usage breakdowns that sum to the task totals.
     * Each model's stats represent its portion of the task totals.
     */
    getModelStats(): Record<string, ModelUsageStats> {
        const stats: Record<string, ModelUsageStats> = {}
        
        console.log('getModelStats called:', {
            changes: this.changes.map(c => ({
                model: `${c.modelProvider}/${c.modelId}`,
                startTs: new Date(c.startTs).toISOString(),
                endTs: c.endTs ? new Date(c.endTs).toISOString() : undefined,
                usage: c.usage
            }))
        })
        
        // Show stats for all models, both active and inactive
        for (const change of this.changes) {
            const key = `${change.modelProvider}/${change.modelId}`
            if (change.usage) {
                // Each model's stats reflect its usage during its active period
                stats[key] = {
                    tokensIn: change.usage.tokensIn,
                    tokensOut: change.usage.tokensOut,
                    cost: change.usage.cost,
                    cacheWrites: change.usage.cacheWrites || 0,
                    cacheReads: change.usage.cacheReads || 0
                }
            }
        }
        
        console.log('Returning stats:', stats)
        return stats
    }
    
    /**
     * Records a model change in the task
     */
    addChange(modelId: string, modelProvider: string, timestamp: number) {
        console.log('Model change requested:', {
            timestamp: new Date(timestamp).toISOString(),
            newModel: `${modelProvider}/${modelId}`
        })

        // If there are existing changes, close the last one
        if (this.changes.length > 0) {
            const lastChange = this.changes[this.changes.length - 1]
            if (!lastChange.endTs) {
                // Preserve the accumulated stats when ending the period
                const finalStats = lastChange.usage || {
                    tokensIn: 0,
                    tokensOut: 0,
                    cost: 0,
                    cacheWrites: 0,
                    cacheReads: 0
                }
                
                lastChange.endTs = timestamp
            }
        }
        
        // Add the new change with zeroed usage stats
        const newChange = {
            modelId,
            modelProvider,
            startTs: timestamp,
            usage: {
                tokensIn: 0,
                tokensOut: 0,
                cost: 0,
                cacheWrites: 0,
                cacheReads: 0
            }
        }
        this.changes.push(newChange)

        // Reset currentGenerationStats since we're starting a new model period
        this.resetCurrentGenerationStats()

        console.log('Model changed:', {
            from: this.changes.length > 1 ? 
                `${this.changes[this.changes.length - 2].modelProvider}/${this.changes[this.changes.length - 2].modelId}` : 
                'none',
            to: `${modelProvider}/${modelId}`
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
        console.log('getCurrentModel called:', {
            changes: this.changes.map(c => ({
                model: `${c.modelProvider}/${c.modelId}`,
                startTs: new Date(c.startTs).toISOString(),
                endTs: c.endTs ? new Date(c.endTs).toISOString() : undefined,
                isLast: c === lastChange
            }))
        })
        if (lastChange && !lastChange.endTs) {
            const result = {
                modelId: lastChange.modelId,
                modelProvider: lastChange.modelProvider
            }
            console.log('Returning current model:', result)
            return result
        }
        console.log('No current model (last change has endTs or no changes)')
        return undefined
    }
}
