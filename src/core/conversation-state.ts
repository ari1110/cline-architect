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
     * Gets the complete state of the conversation
     */
    getState() {
        return {
            messages: this.getMessages(),
            modelChanges: this.getModelChanges(),
            currentModel: this.getCurrentModel()
        }
    }
}
