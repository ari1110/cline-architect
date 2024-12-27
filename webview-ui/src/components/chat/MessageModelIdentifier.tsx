import React, { memo } from 'react'
import styled from 'styled-components'
import { useExtensionState } from '../../context/ExtensionStateContext'
import { ClineMessage } from '../../../../src/shared/ExtensionMessage'

const Container = styled.div`
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 2px 6px;
	background-color: color-mix(in srgb, var(--vscode-badge-foreground) 15%, transparent);
	border-radius: 3px;
	margin-right: 8px;
    margin-bottom: 6px;
	font-size: 12px;
	flex-shrink: 0;
`

const Icon = styled.span`
	font-size: 14px;
`

interface MessageModelIdentifierProps {
    timestamp: number
}

const MessageModelIdentifier: React.FC<MessageModelIdentifierProps> = ({ timestamp }) => {
    const { clineMessages } = useExtensionState()
    
    // Find the message with this timestamp
    const message = clineMessages?.find((m: ClineMessage) => m.ts === timestamp)
    const modelName = message?.modelId && message?.modelProvider 
        ? `${message.modelProvider} ${message.modelId}`
        : 'Unknown Model'

    return (
        <Container>
            <Icon className="codicon codicon-robot" />
            <span>{modelName}</span>
        </Container>
    )
}

export default memo(MessageModelIdentifier)
