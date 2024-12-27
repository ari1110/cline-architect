import React, { memo, useMemo } from 'react'
import styled from 'styled-components'
import { useExtensionState } from '../../context/ExtensionStateContext'
import { ModelTracker } from '../../../../src/shared/model-tracking'

const Container = styled.div`
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 2px 6px;
	background-color: color-mix(in srgb, var(--vscode-badge-foreground) 15%, transparent);
	border-radius: 3px;
	margin-right: 8px;
    margin-bottom: 6px;
	font-size: 11px;
	flex-shrink: 0;
	width: fit-content;
`

const Icon = styled.span`
    font-size: 14px;
`

interface StaticModelIdentifierProps {
    timestamp: number
    modelProvider?: string
    modelId?: string
}

export const StaticModelIdentifier: React.FC<StaticModelIdentifierProps> = ({ timestamp, modelProvider, modelId }) => {
    const { currentTask } = useExtensionState()

    // Get the model name based on the timestamp and model changes
    const modelName = useMemo(() => {
        // If model info is provided directly (history view), use it
        if (modelProvider && modelId) {
            return `${modelProvider} ${modelId}`
        }

        // Otherwise use model changes (chat view)
        if (currentTask?.historyItem.modelChanges?.length) {
            const modelTracker = new ModelTracker(currentTask.historyItem.modelChanges)
            const model = modelTracker.getModelForTimestamp(timestamp)
            if (model) {
                return `${model.modelProvider} ${model.modelId}`
            }
        }

        // Fallback to task's model info
        if (currentTask?.historyItem.modelProvider && currentTask?.historyItem.modelId) {
            return `${currentTask.historyItem.modelProvider} ${currentTask.historyItem.modelId}`
        }

        return 'Unknown Model'
    }, [timestamp, currentTask?.historyItem, modelProvider, modelId])

    return (
        <Container>
            <Icon className="codicon codicon-robot" />
            <span>{modelName}</span>
        </Container>
    )
}

export default memo(StaticModelIdentifier)
