import { memo } from "react"
import styled from "styled-components"

interface ModelIdentifierProps {
	modelName: string
}

const Container = styled.div`
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 2px 6px;
	background-color: color-mix(in srgb, var(--vscode-badge-foreground) 15%, transparent);
	border-radius: 3px;
	margin-right: 8px;
	font-size: 12px;
	flex-shrink: 0;
`

const Icon = styled.span`
	font-size: 14px;
`

const ModelIdentifier = ({ modelName }: ModelIdentifierProps) => {
	return (
		<Container>
			<Icon className="codicon codicon-robot" />
			<span>{modelName}</span>
		</Container>
	)
}

export default memo(ModelIdentifier)
