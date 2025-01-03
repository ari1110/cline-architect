import { VSCodeCheckbox, VSCodeTextArea } from "@vscode/webview-ui-toolkit/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import debounce from "debounce"
import styled from "styled-components"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "../../utils/vscode"

interface CustomInstructionsMenuProps {
	style?: React.CSSProperties
}

const CustomInstructionsMenu = ({ style }: CustomInstructionsMenuProps) => {
	const state = useExtensionState()
	const { customInstructions, setCustomInstructions, customInstructionsEnabled, setCustomInstructionsEnabled } = state
	const [isExpanded, setIsExpanded] = useState(false)
	const [isHoveringCollapsibleSection, setIsHoveringCollapsibleSection] = useState(false)

	// Debounced update to extension to prevent stuttering
	const debouncedUpdateExtension = useMemo(
		() =>
			debounce((text: string, enabled: boolean) => {
				vscode.postMessage({ 
					type: "customInstructions", 
					text,
					bool: enabled
				})
			}, 500),
		[],
	)

	const updateCustomInstructions = useCallback(
		(text: string) => {
			setCustomInstructions(text)
			debouncedUpdateExtension(text, customInstructionsEnabled)
		},
		[setCustomInstructions, debouncedUpdateExtension, customInstructionsEnabled],
	)

	// Cleanup debounce on unmount
	useEffect(() => {
		return () => {
			debouncedUpdateExtension.clear()
		}
	}, [debouncedUpdateExtension])

	return (
		<div
			style={{
				padding: "0 15px",
				userSelect: "none",
				borderTop: isExpanded
					? `0.5px solid color-mix(in srgb, var(--vscode-titleBar-inactiveForeground) 20%, transparent)`
					: "none",
				overflowY: "auto",
				...style,
			}}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "8px",
					padding: isExpanded ? "8px 0" : "8px 0 0 0",
					cursor: "pointer",
				}}
				onMouseEnter={() => setIsHoveringCollapsibleSection(true)}
				onMouseLeave={() => setIsHoveringCollapsibleSection(false)}
				onClick={() => setIsExpanded((prev) => !prev)}>
				<VSCodeCheckbox
					style={{ pointerEvents: "auto" }}
					checked={customInstructionsEnabled}
					onClick={(e) => {
						e.stopPropagation()
						if (!customInstructions && !customInstructionsEnabled) {
							setIsExpanded(true)
						} else {
							const newEnabled = !customInstructionsEnabled
							setCustomInstructionsEnabled(newEnabled)
							vscode.postMessage({ 
								type: "customInstructions",
								text: customInstructions ?? "",
								bool: newEnabled
							})
						}
					}}
				/>
				<CollapsibleSection 
					isHovered={isHoveringCollapsibleSection}
					style={{ 
						maxWidth: "300px",
						display: "flex",
						alignItems: "center",
						gap: "4px",
						cursor: "pointer"
					}}>
					<div style={{ 
						display: "flex",
						alignItems: "center",
						gap: "4px",
						minWidth: 0,
						flex: 1
					}}>
						<span style={{ 
							whiteSpace: "nowrap",
							flexShrink: 0
						}}>Custom Instructions</span>
						<span
							style={{
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
								minWidth: 0,
								flex: 1
							}}>
							{!customInstructions ? "(None)" : customInstructionsEnabled ? "(Active)" : "(Inactive)"}
						</span>
					</div>
					<span
						className={`codicon codicon-chevron-${isExpanded ? "down" : "right"}`}
						style={{
							flexShrink: 0,
							marginLeft: isExpanded ? "2px" : "-2px",
						}}
					/>
				</CollapsibleSection>
			</div>
			{isExpanded && (
				<div style={{ padding: "0 0 10px 0" }}>
					<VSCodeTextArea
						value={customInstructions ?? ""}
						style={{ width: "100%" }}
						rows={4}
						placeholder={'e.g. "Run unit tests at the end", "Use TypeScript with async/await", "Speak in Spanish"'}
						onInput={(e: any) => updateCustomInstructions(e.target?.value ?? "")}>
					</VSCodeTextArea>
					<div
						style={{
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
							fontSize: "12px",
						}}>
						These instructions are added to the end of the system prompt sent with every request.
					</div>
				</div>
			)}
		</div>
	)
}

const CollapsibleSection = styled.div<{ isHovered?: boolean }>`
	color: ${(props) => (props.isHovered ? "var(--vscode-foreground)" : "var(--vscode-descriptionForeground)")};
	flex: 1;
	min-width: 0;
	cursor: pointer;

	&:hover {
		color: var(--vscode-foreground);
	}
`

export default CustomInstructionsMenu
