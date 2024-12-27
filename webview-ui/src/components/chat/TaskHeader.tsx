import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import React, { memo, useEffect, useMemo, useRef, useState } from "react"
import { useWindowSize } from "react-use"
import { ClineMessage } from "../../../../src/shared/ExtensionMessage"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "../../utils/vscode"
import Thumbnails from "../common/Thumbnails"
import ModelIdentifier from "./ModelIdentifier"
import { mentionRegexGlobal } from "../../../../src/shared/context-mentions"
import { formatLargeNumber } from "../../utils/format"
import { normalizeApiConfiguration } from "../settings/ApiOptions"
import { ModelChange } from "../../../../src/shared/model-tracking"

interface TaskHeaderProps {
        task: ClineMessage
        tokensIn: number
        tokensOut: number
        doesModelSupportPromptCache: boolean
        cacheWrites?: number
        cacheReads?: number
        totalCost: number
        modelChanges?: ModelChange[]
        onClose: () => void
}

const TaskHeader: React.FC<TaskHeaderProps> = ({
        task,
        tokensIn,
        tokensOut,
        doesModelSupportPromptCache,
        cacheWrites,
        cacheReads,
        totalCost,
        modelChanges,
        onClose,
}) => {
        const { apiConfiguration } = useExtensionState()
        const [isTaskExpanded, setIsTaskExpanded] = useState(true)
        const [isTextExpanded, setIsTextExpanded] = useState(false)
        const [showSeeMore, setShowSeeMore] = useState(false)
        const [isModelStatsExpanded, setIsModelStatsExpanded] = useState(false)
        const textContainerRef = useRef<HTMLDivElement>(null)
        const textRef = useRef<HTMLDivElement>(null)

        /*
        When dealing with event listeners in React components that depend on state variables, we face a challenge. We want our listener to always use the most up-to-date version of a callback function that relies on current state, but we don't want to constantly add and remove event listeners as that function updates. This scenario often arises with resize listeners or other window events. Simply adding the listener in a useEffect with an empty dependency array risks using stale state, while including the callback in the dependencies can lead to unnecessary re-registrations of the listener. There are react hook libraries that provide a elegant solution to this problem by utilizing the useRef hook to maintain a reference to the latest callback function without triggering re-renders or effect re-runs. This approach ensures that our event listener always has access to the most current state while minimizing performance overhead and potential memory leaks from multiple listener registrations. 
        Sources
        - https://usehooks-ts.com/react-hook/use-event-listener
        - https://streamich.github.io/react-use/?path=/story/sensors-useevent--docs
        - https://github.com/streamich/react-use/blob/master/src/useEvent.ts
        - https://stackoverflow.com/questions/55565444/how-to-register-event-with-useeffect-hooks

        Before:
        
        const updateMaxHeight = useCallback(() => {
                if (isExpanded && textContainerRef.current) {
                        const maxHeight = window.innerHeight * (3 / 5)
                        textContainerRef.current.style.maxHeight = `${maxHeight}px`
                }
        }, [isExpanded])

        useEffect(() => {
                updateMaxHeight()
        }, [isExpanded, updateMaxHeight])

        useEffect(() => {
                window.removeEventListener("resize", updateMaxHeight)
                window.addEventListener("resize", updateMaxHeight)
                return () => {
                        window.removeEventListener("resize", updateMaxHeight)
                }
        }, [updateMaxHeight])

        After:
        */

        const { height: windowHeight, width: windowWidth } = useWindowSize()

        useEffect(() => {
                if (isTextExpanded && textContainerRef.current) {
                        const maxHeight = windowHeight * (1 / 2)
                        textContainerRef.current.style.maxHeight = `${maxHeight}px`
                }
        }, [isTextExpanded, windowHeight])

        useEffect(() => {
                if (textRef.current && textContainerRef.current) {
                        let textContainerHeight = textContainerRef.current.clientHeight
                        if (!textContainerHeight) {
                                textContainerHeight = textContainerRef.current.getBoundingClientRect().height
                        }
                        const isOverflowing = textRef.current.scrollHeight > textContainerHeight
                        // necessary to show see more button again if user resizes window to expand and then back to collapse
                        if (!isOverflowing) {
                                setIsTextExpanded(false)
                        }
                        setShowSeeMore(isOverflowing)
                }
        }, [task.text, windowWidth])

        const { selectedProvider, selectedModelId, isCostAvailable } = useMemo(() => {
                const { selectedProvider, selectedModelId } = normalizeApiConfiguration(apiConfiguration)
                const isCostAvailable = (
                        apiConfiguration?.apiProvider !== "openai" &&
                        apiConfiguration?.apiProvider !== "ollama" &&
                        apiConfiguration?.apiProvider !== "lmstudio" &&
                        apiConfiguration?.apiProvider !== "gemini"
                )
                return { selectedProvider, selectedModelId, isCostAvailable }
        }, [apiConfiguration])

        const shouldShowPromptCacheInfo = doesModelSupportPromptCache && apiConfiguration?.apiProvider !== "openrouter"

        type ModelStats = {
                tokensIn: number;
                tokensOut: number;
                cost: number;
        };

        const { currentModelStats } = useMemo(() => {
                if (!modelChanges || modelChanges.length === 0) {
                        return { currentModelStats: null as ModelStats | null };
                }
                const usageMap: Record<string, ModelStats> = {};
                let currentModelStats = null;

                modelChanges.forEach(change => {
                        if (change.usage) {
                                const key = `${change.modelProvider}/${change.modelId}`;
                                if (!usageMap[key]) {
                                        usageMap[key] = { tokensIn: 0, tokensOut: 0, cost: 0 };
                                }
                                usageMap[key].tokensIn += change.usage.tokensIn;
                                usageMap[key].tokensOut += change.usage.tokensOut;
                                usageMap[key].cost += change.usage.cost;

                                // Track current model's stats
                                if (change.modelProvider === selectedProvider && change.modelId === selectedModelId) {
                                        currentModelStats = usageMap[key];
                                }
                        }
                });
                return { 
                        currentModelStats
                };
        }, [modelChanges, selectedProvider, selectedModelId]);

        return (
                <div style={{ padding: "10px 13px 10px 13px" }}>
                        <div
                                style={{
                                        backgroundColor: "var(--vscode-badge-background)",
                                        color: "var(--vscode-badge-foreground)",
                                        borderRadius: "3px",
                                        padding: "9px 10px 9px 14px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 6,
                                        position: "relative",
                                        zIndex: 1,
                                }}>
                                <div
                                        style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                        }}>
                                        <div
                                                style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                                flexGrow: 1,
                                                minWidth: 0 // This allows the div to shrink below its content size
                                                }}
                                                onClick={() => setIsTaskExpanded(!isTaskExpanded)}>
                                                <div 
                                                        style={{ 
                                                                display: "flex",
                                                                alignItems: "center",
                                                                cursor: "pointer",
                                                                userSelect: "none",
                                                                WebkitUserSelect: "none",
                                                                MozUserSelect: "none",
                                                                msUserSelect: "none",
                                                                flexShrink: 0
                                                        }}
                                                        onClick={() => setIsTaskExpanded(!isTaskExpanded)}>
                                                        <span className={`codicon codicon-chevron-${isTaskExpanded ? "down" : "right"}`}></span>
                                                </div>
                                                <div
                                                        style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                flexGrow: 1,
                                                                minWidth: 0, // This allows the div to shrink below its content size
                                                        }}>
                                                        <span style={{ fontWeight: "bold", marginRight: '8px' }}>Task{!isTaskExpanded && ":"}</span>
                                                        <div style={{ 
                                                                flexGrow: 1, 
                                                                display: 'flex', 
                                                                justifyContent: 'center' 
                                                        }}>
                                                                <ModelIdentifier 
                                                                        modelName={`${selectedProvider.split('-')[0].charAt(0).toUpperCase() + selectedProvider.split('-')[0].slice(1)} ${selectedModelId}`} 
                                                                />
                                                        </div>
                                                </div>
                                        </div>
                                        {!isTaskExpanded && isCostAvailable && currentModelStats && (
                                                <div
                                                        style={{
                                                                marginLeft: 10,
                                                                backgroundColor: "color-mix(in srgb, var(--vscode-badge-foreground) 70%, transparent)",
                                                                color: "var(--vscode-badge-background)",
                                                                padding: "2px 4px",
                                                                borderRadius: "500px",
                                                                fontSize: "11px",
                                                                fontWeight: 500,
                                                                display: "inline-block",
                                                                flexShrink: 0,
                                                        }}>
                                                        ${currentModelStats.cost.toFixed(4)}
                                                </div>
                                        )}
                                        <VSCodeButton appearance="icon" onClick={onClose} style={{ marginLeft: 6, flexShrink: 0 }}>
                                                <span className="codicon codicon-close"></span>
                                        </VSCodeButton>
                                </div>
                                {isTaskExpanded && (
                                        <>
                                                <div
                                                        ref={textContainerRef}
                                                        style={{
                                                                marginTop: -2,
                                                                fontSize: "var(--vscode-font-size)",
                                                                overflowY: isTextExpanded ? "auto" : "hidden",
                                                                wordBreak: "break-word",
                                                                overflowWrap: "anywhere",
                                                                position: "relative",
                                                        }}>
                                                        <div
                                                                ref={textRef}
                                                                style={{
                                                                        display: "-webkit-box",
                                                                        WebkitLineClamp: isTextExpanded ? "unset" : 3,
                                                                        WebkitBoxOrient: "vertical",
                                                                        overflow: "hidden",
                                                                        whiteSpace: "pre-wrap",
                                                                        wordBreak: "break-word",
                                                                        overflowWrap: "anywhere",
                                                                }}>
                                                                {highlightMentions(task.text, false)}
                                                        </div>
                                                        {!isTextExpanded && showSeeMore && (
                                                                <div
                                                                        style={{
                                                                                position: "absolute",
                                                                                right: 0,
                                                                                bottom: 0,
                                                                                display: "flex",
                                                                                alignItems: "center",
                                                                        }}>
                                                                        <div
                                                                                style={{
                                                                                        width: 30,
                                                                                        height: "1.2em",
                                                                                        background:
                                                                                                "linear-gradient(to right, transparent, var(--vscode-badge-background))",
                                                                                }}
                                                                        />
                                                                        <div
                                                                                style={{
                                                                                        cursor: "pointer",
                                                                                        color: "var(--vscode-textLink-foreground)",
                                                                                        paddingRight: 0,
                                                                                        paddingLeft: 3,
                                                                                        backgroundColor: "var(--vscode-badge-background)",
                                                                                }}
                                                                                onClick={() => setIsTextExpanded(!isTextExpanded)}>
                                                                                See more
                                                                        </div>
                                                                </div>
                                                        )}
                                                </div>
                                                {isTextExpanded && showSeeMore && (
                                                        <div
                                                                style={{
                                                                        cursor: "pointer",
                                                                        color: "var(--vscode-textLink-foreground)",
                                                                        marginLeft: "auto",
                                                                        textAlign: "right",
                                                                        paddingRight: 2,
                                                                }}
                                                                onClick={() => setIsTextExpanded(!isTextExpanded)}>
                                                                See less
                                                        </div>
                                                )}
                                                {task.images && task.images.length > 0 && <Thumbnails images={task.images} />}
                                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                        <div
                                                                style={{
                                                                        display: "flex",
                                                                        justifyContent: "space-between",
                                                                        alignItems: "center",
                                                                }}>
                                                                <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                                                                        <span style={{ fontWeight: "bold" }}>Current Model Tokens:</span>
                                                                        <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                                                                                <i
                                                                                        className="codicon codicon-arrow-up"
                                                                                        style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "-2px" }}
                                                                                />
                                                                                {formatLargeNumber(currentModelStats?.tokensIn || 0)}
                                                                        </span>
                                                                        <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                                                                                <i
                                                                                        className="codicon codicon-arrow-down"
                                                                                        style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "-2px" }}
                                                                                />
                                                                                {formatLargeNumber(currentModelStats?.tokensOut || 0)}
                                                                        </span>
                                                                </div>
                                                                {!isCostAvailable && <ExportButton />}
                                                        </div>

                                                        {shouldShowPromptCacheInfo && (cacheReads !== undefined || cacheWrites !== undefined) && (
                                                                <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                                                                        <span style={{ fontWeight: "bold" }}>Cache:</span>
                                                                        <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                                                                                <i
                                                                                        className="codicon codicon-database"
                                                                                        style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "-1px" }}
                                                                                />
                                                                                +{formatLargeNumber(cacheWrites || 0)}
                                                                        </span>
                                                                        <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                                                                                <i
                                                                                        className="codicon codicon-arrow-right"
                                                                                        style={{ fontSize: "12px", fontWeight: "bold", marginBottom: 0 }}
                                                                                />
                                                                                {formatLargeNumber(cacheReads || 0)}
                                                                        </span>
                                                                </div>
                                                        )}
                                                        {isCostAvailable && (
                                                                <>
                                                                        <div
                                                                                style={{
                                                                                        display: "flex",
                                                                                        justifyContent: "space-between",
                                                                                        alignItems: "center",
                                                                                }}>
                                                                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                                                        <span style={{ fontWeight: "bold" }}>Current Model Cost:</span>
                                                                                        <span>${currentModelStats?.cost.toFixed(4) || "0.0000"}</span>
                                                                                </div>
                                                                                <div style={{ display: "flex", gap: "8px" }}>
                                                                                        {modelChanges && modelChanges.length > 1 && (
                                                                                                <div
                                                                                                        onClick={() => setIsModelStatsExpanded(!isModelStatsExpanded)}
                                                                                                        style={{
                                                                                                                cursor: "pointer",
                                                                                                                display: "flex",
                                                                                                                alignItems: "center",
                                                                                                                gap: "4px",
                                                                                                                color: "var(--vscode-textLink-foreground)",
                                                                                                        }}>
                                                                                                        <span className={`codicon codicon-chevron-${isModelStatsExpanded ? "down" : "right"}`}></span>
                                                                                                        <span>Per Model Usage</span>
                                                                                                </div>
                                                                                        )}
                                                                                        <ExportButton />
                                                                                </div>
                                                                        </div>
                                                                        {isModelStatsExpanded && (
                                                                                <div style={{ 
                                                                                        marginTop: 8,
                                                                                        paddingTop: 8,
                                                                                        borderTop: '1px solid var(--vscode-textBlockQuote-border)',
                                                                                }}>
                                                                                        {modelChanges?.map((change: ModelChange) => change.usage && (
                                                                                <div 
                                                                                        key={`${change.modelProvider}-${change.modelId}-${change.startTs}`}
                                                                                        style={{ 
                                                                                                marginTop: 4,
                                                                                                padding: "6px 10px",
                                                                                                backgroundColor: "var(--vscode-textBlockQuote-background)",
                                                                                                borderRadius: 3,
                                                                                                fontSize: "0.85em",
                                                                                                border: "1px solid var(--vscode-textBlockQuote-border)"
                                                                                        }}>
                                                                                        <div style={{ 
                                                                                                display: "flex", 
                                                                                                justifyContent: "space-between",
                                                                                                marginBottom: 2
                                                                                        }}>
                                                                                                <span style={{ 
                                                                                                        fontWeight: 600,
                                                                                                        color: 'var(--vscode-textLink-foreground)',
                                                                                                        opacity: 0.8
                                                                                                }}>
                                                                                                        {change.modelProvider}/{change.modelId}
                                                                                                </span>
                                                                                                <span style={{ fontWeight: 500 }}>${change.usage.cost.toFixed(4)}</span>
                                                                                        </div>
                                                                                        <div style={{ 
                                                                                                display: "flex", 
                                                                                                gap: 12, 
                                                                                                opacity: 0.7,
                                                                                                marginTop: 4
                                                                                        }}>
                                                                                                <span>↑{formatLargeNumber(change.usage.tokensIn)} ↓{formatLargeNumber(change.usage.tokensOut)}</span>
                                                                                                {!!change.usage.cacheWrites && (
                                                                                                        <span>Cache: +{formatLargeNumber(change.usage.cacheWrites)} → {formatLargeNumber(change.usage.cacheReads || 0)}</span>
                                                                                                )}
                                                                                        </div>
                                                                                </div>
                                                                        ))}
                                                                                </div>
                                                                        )}
                                                                </>
                                                        )}
                                                </div>
                                        </>
                                )}
                        </div>
                        {/* {apiProvider === "" && (
                                <div
                                        style={{
                                                backgroundColor: "color-mix(in srgb, var(--vscode-badge-background) 50%, transparent)",
                                                color: "var(--vscode-badge-foreground)",
                                                borderRadius: "0 0 3px 3px",
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                padding: "4px 12px 6px 12px",
                                                fontSize: "0.9em",
                                                marginLeft: "10px",
                                                marginRight: "10px",
                                        }}>
                                        <div style={{ fontWeight: "500" }}>Credits Remaining:</div>
                                        <div>
                                                {formatPrice(Credits || 0)}
                                                {(Credits || 0) < 1 && (
                                                        <>
                                                                {" "}
                                                                <VSCodeLink style={{ fontSize: "0.9em" }} href={getAddCreditsUrl(vscodeUriScheme)}>
                                                                        (get more?)
                                                                </VSCodeLink>
                                                        </>
                                                )}
                                        </div>
                                </div>
                        )} */}
                </div>
        )
}

export const highlightMentions = (text?: string, withShadow = true) => {
        if (!text) return text
        const parts = text.split(mentionRegexGlobal)
        return parts.map((part, index) => {
                if (index % 2 === 0) {
                        // This is regular text
                        return part
                } else {
                        // This is a mention
                        return (
                                <span
                                        key={index}
                                        className={withShadow ? "mention-context-highlight-with-shadow" : "mention-context-highlight"}
                                        style={{ cursor: "pointer" }}
                                        onClick={() => vscode.postMessage({ type: "openMention", text: part })}>
                                        @{part}
                                </span>
                        )
                }
        })
}

const ExportButton = () => (
        <VSCodeButton
                appearance="icon"
                onClick={() => vscode.postMessage({ type: "exportCurrentTask" })}
                style={
                        {
                                // marginBottom: "-2px",
                                // marginRight: "-2.5px",
                        }
                }>
                <div style={{ fontSize: "10.5px", fontWeight: "bold", opacity: 0.6 }}>EXPORT</div>
        </VSCodeButton>
)

export default memo(TaskHeader)
