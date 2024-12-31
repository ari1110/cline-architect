import { ModelChange, ModelTracker } from "../shared/model-tracking"
import { ClineMessage } from "../shared/ExtensionMessage"

/**
 * Manages the state of an active conversation, including model changes
 */
export class ConversationState {
    private modelTracker: ModelTracker
    private messages: ClineMessage[] = []

    constructor(initialChanges?: ModelChange[]) {
        this.modelTracker = new ModelTracker(initialChanges)
    }

    /**
     * Records a model change in the conversation
     */
    recordModelChange(modelId: string, modelProvider: string, timestamp: number) {
        this.modelTracker.addChange(modelId, modelProvider, timestamp)
    }

    /**
     * Updates usage statistics for the current model
     */
    updateModelStats(timestamp: number, stats: Partial<import('../shared/model-tracking').ModelUsageStats> | { 
        data: { 
            id: string;
            model: string;
            total_cost: number;
            tokens_prompt: number;
            tokens_completion: number;
            created_at: string;
        }
    }) {
        if ('data' in stats) {
            // OpenRouter details
            this.modelTracker.updateUsageStats(timestamp, stats.data)
        } else {
            // Regular stats
            this.modelTracker.updateUsageStats(timestamp, stats)
        }
    }

    /**
     * Gets the model info for a specific message timestamp
     */
    getModelForMessage(timestamp: number) {
        return this.modelTracker.getModelForTimestamp(timestamp)
    }

    /**
     * Gets the currently active model
     */
    getCurrentModel() {
        return this.modelTracker.getCurrentModel()
    }

    /**
     * Gets all model changes that occurred during the conversation
     */
    getModelChanges(): ModelChange[] {
        return this.modelTracker.getAllChanges()
    }

    /**
     * Gets the total usage stats for the entire task/conversation
     */
    getTaskTotals() {
        return this.modelTracker.getTaskTotals()
    }

    /**
     * Gets per-model usage breakdowns that sum to the task totals
     */
    getModelStats() {
        return this.modelTracker.getModelStats()
    }

    /**
     * Adds a message to the conversation
     */
    addMessage(message: ClineMessage) {
        // Get the model that was active at this message's timestamp
        const model = this.getModelForMessage(message.ts)
        if (model) {
            message.modelId = model.modelId
            message.modelProvider = model.modelProvider
        }
        this.messages.push(message)
    }

    /**
     * Gets all messages in the conversation
     */
    getMessages(): ClineMessage[] {
        return [...this.messages]
    }

    /**
     * Gets the complete state of the conversation including usage statistics
     */
    getState() {
        return {
            messages: this.getMessages(),
            modelChanges: this.getModelChanges(),
            currentModel: this.getCurrentModel(),
            taskTotals: this.getTaskTotals(),
            modelStats: this.getModelStats()
        }
    }
}
