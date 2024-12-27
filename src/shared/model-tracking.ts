/**
 * Represents a model change during a conversation
 */
export interface ModelChange {
    modelId: string
    modelProvider: string
    startTs: number // Timestamp when this model became active
    endTs?: number  // Timestamp when this model was replaced (undefined if still active)
}

/**
 * Manages model changes during a conversation
 */
export class ModelTracker {
    private changes: ModelChange[] = []

    constructor(initialChanges?: ModelChange[]) {
        if (initialChanges) {
            this.changes = [...initialChanges]
        }
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
