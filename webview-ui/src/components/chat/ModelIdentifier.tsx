import { memo, useState, useRef, useEffect } from "react"
import styled from "styled-components"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { normalizeApiConfiguration } from "../settings/ApiOptions"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import Fuse from "fuse.js"
import { highlight } from "../history/HistoryView"
import { vscode } from "../../utils/vscode"
import { ApiProvider } from "../../../../src/shared/api"

const Wrapper = styled.div`
	display: flex;
	justify-content: center;
	margin-bottom: 6px;
	position: relative;
`

const Container = styled.div`
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 2px 8px;
	background-color: color-mix(in srgb, var(--vscode-badge-foreground) 15%, transparent);
	border-radius: 3px;
	font-size: 12px;
	cursor: pointer;

	&:hover {
		background-color: color-mix(in srgb, var(--vscode-badge-foreground) 25%, transparent);
	}
`

const Icon = styled.span`
	display: flex;
	font-size: 14px;
`

const DropdownWrapper = styled.div`
	position: absolute;
	top: 100%;
	left: 50%;
	transform: translateX(-50%);
	width: 300px;
	margin-top: 4px;
	z-index: 1000;
`

const DropdownList = styled.div`
	background-color: var(--vscode-dropdown-background);
	border: 1px solid var(--vscode-list-activeSelectionBackground);
	border-radius: 3px;
	max-height: 200px;
	overflow-y: auto;
`

const DropdownItem = styled.div<{ isSelected: boolean }>`
	padding: 5px 10px;
	cursor: pointer;
	word-break: break-all;
	white-space: normal;
	background-color: ${({ isSelected }) => (isSelected ? "var(--vscode-list-activeSelectionBackground)" : "inherit")};

	&:hover {
		background-color: var(--vscode-list-activeSelectionBackground);
	}
`

const ModelIdentifier = () => {
	const { apiConfiguration, setApiConfiguration, openRouterModels } = useExtensionState()
	const [isDropdownVisible, setIsDropdownVisible] = useState(false)
	const [searchTerm, setSearchTerm] = useState("")
	const [selectedIndex, setSelectedIndex] = useState(-1)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const itemRefs = useRef<(HTMLDivElement | null)[]>([])

	const { selectedProvider, selectedModelId } = normalizeApiConfiguration(apiConfiguration)
	const modelName = `${selectedProvider.split('-')[0].charAt(0).toUpperCase() + selectedProvider.split('-')[0].slice(1)} ${selectedModelId}`

	const modelIds = Object.keys(openRouterModels).sort((a, b) => a.localeCompare(b))
	const searchableItems = modelIds.map((id) => ({
		id,
		html: id,
	}))

	const fuse = new Fuse(searchableItems, {
		keys: ["html"],
		threshold: 0.6,
		shouldSort: true,
		isCaseSensitive: false,
		ignoreLocation: false,
		includeMatches: true,
		minMatchCharLength: 1,
	})

	const modelSearchResults = searchTerm
		? highlight(fuse.search(searchTerm), "model-item-highlight")
		: searchableItems

	const handleModelChange = (newModelId: string) => {
		const newConfig = {
			...apiConfiguration,
			apiProvider: "openrouter" as ApiProvider,
			openRouterModelId: newModelId,
			openRouterModelInfo: openRouterModels[newModelId],
			// Clear other provider-specific fields to avoid conflicts
			apiModelId: undefined,
		}
		setApiConfiguration(newConfig)
		// Notify extension about configuration change
		vscode.postMessage({ 
			type: "apiConfiguration", 
			apiConfiguration: newConfig 
		})
		setIsDropdownVisible(false)
		setSearchTerm("")
	}

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsDropdownVisible(false)
				setSearchTerm("")
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => {
			document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [])

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (!isDropdownVisible) return

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault()
				setSelectedIndex((prev) => (prev < modelSearchResults.length - 1 ? prev + 1 : prev))
				break
			case "ArrowUp":
				event.preventDefault()
				setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
				break
			case "Enter":
				event.preventDefault()
				if (selectedIndex >= 0 && selectedIndex < modelSearchResults.length) {
					handleModelChange(modelSearchResults[selectedIndex].id)
				}
				break
			case "Escape":
				setIsDropdownVisible(false)
				setSearchTerm("")
				setSelectedIndex(-1)
				break
		}
	}

	return (
		<Wrapper ref={dropdownRef}>
			<Container onClick={() => setIsDropdownVisible(!isDropdownVisible)}>
				<Icon className="codicon codicon-robot" />
				<span>{modelName}</span>
			</Container>
			{isDropdownVisible && (
				<DropdownWrapper>
					<VSCodeTextField
						placeholder="Search models..."
						value={searchTerm}
						onInput={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
						onKeyDown={handleKeyDown}
						style={{ width: "100%", marginBottom: "4px" }}
					/>
					<DropdownList>
						{modelSearchResults.map((item, index) => (
							<DropdownItem
								key={item.id}
								ref={(el) => (itemRefs.current[index] = el)}
								isSelected={index === selectedIndex}
								onMouseEnter={() => setSelectedIndex(index)}
								onClick={() => handleModelChange(item.id)}
								dangerouslySetInnerHTML={{
									__html: item.html,
								}}
							/>
						))}
					</DropdownList>
				</DropdownWrapper>
			)}
		</Wrapper>
	)
}

export default memo(ModelIdentifier)
