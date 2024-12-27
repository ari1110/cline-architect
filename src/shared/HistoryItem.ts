import { ModelChange } from "./model-tracking"

export type HistoryItem = {
	id: string
	ts: number
	task: string
	tokensIn: number
	tokensOut: number
	cacheWrites?: number
	cacheReads?: number
	totalCost: number
	modelId?: string
	modelProvider?: string
	modelChanges?: ModelChange[] // Track model changes during the conversation
}
