import React, { createContext, useContext, useRef, useMemo } from 'react'
import ModelIdentifier from './ModelIdentifier'
import { useExtensionState } from '../../context/ExtensionStateContext'
import { normalizeApiConfiguration } from '../settings/ApiOptions'

// Create a context to manage model name storage
const ModelNameContext = createContext<{
    storeModelName: (timestamp: number, modelName: string) => void
    getModelName: (timestamp: number) => string
}>({
    storeModelName: () => {},
    getModelName: () => 'Unknown Model'
})

export const ModelNameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const modelNameRef = useRef<{ [key: number]: string }>({})

    const storeModelName = (timestamp: number, modelName: string) => {
        // Ensure we only store the model name if it hasn't been stored before
        if (!modelNameRef.current[timestamp]) {
            modelNameRef.current[timestamp] = modelName
        }
    }

    const getModelName = (timestamp: number) => {
        // Find the closest previous timestamp with a stored model name
        const prevTimestamp = Object.keys(modelNameRef.current)
            .map(Number)
            .filter(ts => ts <= timestamp)
            .sort((a, b) => b - a)[0]
        
        return modelNameRef.current[prevTimestamp] || 'Unknown Model'
    }

    return (
        <ModelNameContext.Provider value={{ storeModelName, getModelName }}>
            {children}
        </ModelNameContext.Provider>
    )
}

interface StaticModelIdentifierProps {
    timestamp: number
}

export const StaticModelIdentifier: React.FC<StaticModelIdentifierProps> = ({ timestamp }) => {
    const { apiConfiguration } = useExtensionState()
    const { storeModelName, getModelName } = useContext(ModelNameContext)

    // When an API request starts, store the model name
    React.useEffect(() => {
        const { selectedProvider, selectedModelId } = normalizeApiConfiguration(apiConfiguration)
        const modelName = `${selectedProvider}/${selectedModelId}`
        storeModelName(timestamp, modelName)
    }, [timestamp, apiConfiguration, storeModelName])

    // Retrieve the stored model name for this timestamp
    const modelName = useMemo(() => {
        const storedModelName = getModelName(timestamp)
        // If no model name is stored, try to get the current model name
        const fallbackModelName = (() => {
            const { selectedProvider, selectedModelId } = normalizeApiConfiguration(apiConfiguration)
            const formattedProvider = selectedProvider.split('-')[0].charAt(0).toUpperCase() + 
                                      selectedProvider.split('-')[0].slice(1)
            return `${formattedProvider} ${selectedModelId}`
        })()

        return storedModelName !== 'Unknown Model' 
            ? storedModelName 
            : fallbackModelName
    }, [timestamp, getModelName, apiConfiguration])

    return (
        <div style={{ marginBottom: '6px' }}>
            <ModelIdentifier modelName={modelName} />
        </div>
    )
}

export default StaticModelIdentifier
